import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

interface Token {
  text: string;
  cls: string;
}

/**
 * A code sample with copy-to-clipboard.
 *
 * The highlighter is deliberately tiny — comments, strings, numbers and a keyword list,
 * nothing more. A real grammar would mean a parser dependency, and this site exists to
 * show off a zero-dependency library; shipping a 200 kB tokeniser to colour its examples
 * would be a poor advertisement. Tokens are rendered through Angular's text interpolation,
 * so nothing here can inject markup.
 */
@Component({
  selector: 'code-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      @if (title()) {
        <div class="head">
          <span class="file">{{ title() }}</span>
          <button class="copy" type="button" (click)="copy()">{{ copied() ? 'Copied' : 'Copy' }}</button>
        </div>
      } @else {
        <button class="copy floating" type="button" (click)="copy()">{{ copied() ? 'Copied' : 'Copy' }}</button>
      }
      <pre><code>@for (t of tokens(); track $index) {<span [class]="t.cls">{{ t.text }}</span>}</code></pre>
    </div>
  `,
  styles: [
    `
      .wrap {
        position: relative;
        margin: 1.25rem 0;
        border-radius: var(--doc-radius);
        overflow: hidden;
        border: 1px solid var(--sc-border);
        background: var(--doc-code-bg);
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.35rem 0.5rem 0.35rem 0.85rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .file {
        font-family: var(--doc-mono);
        font-size: 0.75rem;
        color: var(--doc-code-comment);
      }
      pre {
        margin: 0;
        padding: 0.85rem 1rem;
        overflow-x: auto;
        font-family: var(--doc-mono);
        font-size: 0.8rem;
        line-height: 1.6;
        color: var(--doc-code-text);
      }
      code {
        background: none;
        border: none;
        padding: 0;
        font-size: inherit;
        white-space: pre;
      }
      .copy {
        font: inherit;
        font-size: 0.72rem;
        padding: 0.15rem 0.5rem;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.06);
        color: var(--doc-code-text);
        cursor: pointer;
      }
      .copy:hover {
        background: rgba(255, 255, 255, 0.14);
      }
      .copy.floating {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        opacity: 0;
        transition: opacity 150ms ease;
      }
      .wrap:hover .copy.floating {
        opacity: 1;
      }
      .c {
        color: var(--doc-code-comment);
        font-style: italic;
      }
      .s {
        color: var(--doc-code-string);
      }
      .k {
        color: var(--doc-code-keyword);
      }
      .n {
        color: #fbbf24;
      }
    `,
  ],
})
export class CodeBlockComponent {
  readonly code = input.required<string>();
  readonly title = input<string>('');

  protected readonly copied = signal(false);

  protected readonly tokens = computed(() => tokenise(this.code().trim()));

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code().trim());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1400);
    } catch {
      // Clipboard access is denied in some embedding contexts. Nothing useful to do,
      // and a thrown error here would be noise rather than information.
    }
  }
}

const KEYWORDS = new Set([
  'import', 'export', 'from', 'const', 'let', 'var', 'function', 'return', 'class',
  'extends', 'implements', 'interface', 'type', 'new', 'await', 'async', 'if', 'else',
  'for', 'of', 'in', 'while', 'try', 'catch', 'finally', 'throw', 'this', 'null',
  'undefined', 'true', 'false', 'default', 'readonly', 'private', 'public', 'protected',
  'static', 'get', 'set', 'void', 'as', 'typeof', 'instanceof', 'break', 'continue',
]);

/** Single pass over the source, emitting a class per run of characters. */
function tokenise(src: string): Token[] {
  const tokens: Token[] = [];
  let plain = '';

  const flush = () => {
    if (plain) {
      tokens.push({ text: plain, cls: '' });
      plain = '';
    }
  };
  const push = (text: string, cls: string) => {
    flush();
    tokens.push({ text, cls });
  };

  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);

    const lineComment = /^\/\/[^\n]*/.exec(rest);
    if (lineComment) {
      push(lineComment[0], 'c');
      i += lineComment[0].length;
      continue;
    }

    const blockComment = /^\/\*[\s\S]*?\*\//.exec(rest);
    if (blockComment) {
      push(blockComment[0], 'c');
      i += blockComment[0].length;
      continue;
    }

    const str = /^(['"`])(?:\\.|(?!\1)[\s\S])*\1/.exec(rest);
    if (str) {
      push(str[0], 's');
      i += str[0].length;
      continue;
    }

    const word = /^[A-Za-z_$][\w$]*/.exec(rest);
    if (word) {
      if (KEYWORDS.has(word[0])) push(word[0], 'k');
      else plain += word[0];
      i += word[0].length;
      continue;
    }

    const num = /^\d[\d_.]*/.exec(rest);
    if (num) {
      push(num[0], 'n');
      i += num[0].length;
      continue;
    }

    plain += src[i];
    i++;
  }

  flush();
  return tokens;
}
