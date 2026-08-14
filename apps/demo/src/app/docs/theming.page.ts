import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { CalendarConfig } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import { DemoFrameComponent } from '../shell/demo-frame.component';
import { ThemeService } from '../shell/theme.service';
import { demoDataSource } from '../data';

interface Token {
  name: string;
  value: string;
  kind: 'color' | 'length' | 'raw';
  note: string;
}

/** Transcribed from the :root block of calendar.css, in source order. */
const TOKENS: Token[] = [
  { name: '--sc-bg', value: '#ffffff', kind: 'color', note: 'Grid and card background.' },
  { name: '--sc-bg-alt', value: '#f9fafb', kind: 'color', note: 'Toolbar, headers, dropdowns.' },
  { name: '--sc-border', value: '#d1d5db', kind: 'color', note: 'Structural borders.' },
  { name: '--sc-border-light', value: '#e5e7eb', kind: 'color', note: 'Slot lines inside the grid.' },
  { name: '--sc-text', value: '#1f2937', kind: 'color', note: 'Primary text.' },
  { name: '--sc-text-secondary', value: '#6b7280', kind: 'color', note: 'Times, secondary labels.' },
  { name: '--sc-text-muted', value: '#747474', kind: 'color', note: 'Time-axis labels.' },
  { name: '--sc-primary', value: '#3b82f6', kind: 'color', note: 'Active states, focus, links.' },
  { name: '--sc-primary-hover', value: '#2563eb', kind: 'color', note: 'Hover of the above.' },
  { name: '--sc-danger', value: '#ef4444', kind: 'color', note: 'Destructive and cancelled.' },
  { name: '--sc-success', value: '#10b981', kind: 'color', note: 'Positive states.' },
  { name: '--sc-warning', value: '#f59e0b', kind: 'color', note: 'Warning states.' },
  { name: '--sc-today-bg', value: '#eff6ff', kind: 'color', note: "Today's column tint." },
  { name: '--sc-holiday-color', value: '#ef4444', kind: 'color', note: 'Holiday header text.' },
  { name: '--sc-saturday-color', value: '#3b82f6', kind: 'color', note: 'Saturday header text.' },
  { name: '--sc-non-business-bg', value: 'rgba(229, 231, 235, 0.5)', kind: 'raw', note: 'Closed-hours shading. Keep it translucent.' },
  { name: '--sc-now-indicator', value: '#ef4444', kind: 'color', note: 'The current-time line.' },
  { name: '--sc-selection-bg', value: 'rgba(59, 130, 246, 0.15)', kind: 'raw', note: 'Drag-selection mirror.' },
  { name: '--sc-slot-height', value: '12px', kind: 'length', note: 'Height of one 10-minute slot. The density dial.' },
  { name: '--sc-header-height', value: '48px', kind: 'length', note: 'Toolbar height.' },
  { name: '--sc-time-axis-width', value: '56px', kind: 'length', note: 'Left gutter width.' },
  { name: '--sc-column-min-width', value: '120px', kind: 'length', note: 'Below this, columns scroll.' },
  { name: '--sc-column-header-height', value: '36px', kind: 'length', note: 'Column header height.' },
  { name: '--sc-column-gap', value: '1px', kind: 'length', note: 'Gap between columns.' },
  { name: '--sc-toolbar-gap', value: '8px', kind: 'length', note: 'Toolbar control spacing.' },
  { name: '--sc-font-family', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", kind: 'raw', note: 'Inherited by everything.' },
  { name: '--sc-font-size-xs', value: '10px', kind: 'length', note: 'Badges, dense labels.' },
  { name: '--sc-font-size-sm', value: '12px', kind: 'length', note: 'Card text.' },
  { name: '--sc-font-size-base', value: '14px', kind: 'length', note: 'Toolbar and body.' },
  { name: '--sc-shadow-sm', value: '0 1px 2px rgba(0, 0, 0, 0.05)', kind: 'raw', note: 'Cards.' },
  { name: '--sc-shadow-md', value: '0 4px 6px rgba(0, 0, 0, 0.1)', kind: 'raw', note: 'Dragged cards.' },
  { name: '--sc-shadow-dropdown', value: '0 4px 12px rgba(0, 0, 0, 0.15)', kind: 'raw', note: 'Dropdowns and the date picker.' },
  { name: '--sc-transition-fast', value: '150ms ease', kind: 'raw', note: 'Hover feedback.' },
  { name: '--sc-transition-normal', value: '250ms ease', kind: 'raw', note: 'Panels and dropdowns.' },
  { name: '--sc-z-grid', value: '1', kind: 'raw', note: 'Base layer.' },
  { name: '--sc-z-events', value: '10', kind: 'raw', note: 'Cards above the grid.' },
  { name: '--sc-z-now-indicator', value: '20', kind: 'raw', note: 'Above cards.' },
  { name: '--sc-z-sticky-header', value: '30', kind: 'raw', note: 'Column headers.' },
  { name: '--sc-z-toolbar', value: '45', kind: 'raw', note: 'Toolbar.' },
  { name: '--sc-z-dropdown', value: '50', kind: 'raw', note: 'Open dropdowns.' },
  { name: '--sc-z-modal', value: '100', kind: 'raw', note: 'Highest.' },
];

const EDITABLE = [
  '--sc-primary',
  '--sc-bg',
  '--sc-bg-alt',
  '--sc-text',
  '--sc-border',
  '--sc-today-bg',
  '--sc-now-indicator',
  '--sc-holiday-color',
];

@Component({
  selector: 'page-theming',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, DemoFrameComponent, CodeBlockComponent],
  template: `
    <div class="doc-content">
      <h1>Theming</h1>
      <p class="doc-lead">
        {{ tokens.length }} CSS custom properties, declared on <code>:root</code> and documented in the
        stylesheet as a public API. There is no theme object, no Sass to compile and no build step — restyling
        is overriding values in the cascade.
      </p>

      <h2>Edit them live</h2>
      <p>
        These write to <code>document.documentElement.style</code>. Note that the site's own chrome changes
        with the calendar: this page is themed by the same tokens, which is the most direct proof that they
        are enough to build with.
      </p>

      <div class="editor">
        @for (name of editable; track name) {
          <label class="swatch">
            <input type="color" [value]="current(name)" (input)="set(name, $any($event.target).value)" />
            <code>{{ name }}</code>
          </label>
        }
        <div class="editor-actions">
          <button class="btn" type="button" (click)="theme.resetTokens()">Reset</button>
          <button class="btn" type="button" (click)="theme.toggle()">
            Switch to {{ theme.mode() === 'light' ? 'dark' : 'light' }}
          </button>
        </div>
      </div>

      <label class="field density">
        <span>--sc-slot-height — grid density ({{ slotHeight() }}px per 10 minutes)</span>
        <input type="range" min="6" max="28" [value]="slotHeight()" (input)="setDensity($any($event.target).value)" />
      </label>

      <demo-frame label="Themed live" [height]="540">
        <sc-calendar [config]="config" />
      </demo-frame>

      <code-block [code]="overrideCss()" title="the overrides above, as CSS" />

      <h2>Scoping to one calendar</h2>
      <p>
        Tokens are inherited, so setting them on an ancestor themes only what is inside it. Two calendars on
        one page can look completely different.
      </p>
      <code-block [code]="scoped" />

      <h2>Dark mode</h2>
      <p>
        There is no built-in dark theme and no <code>prefers-color-scheme</code> block in the stylesheet, so
        dark mode is a block of overrides you write. This site's is below — nine values, and nothing else.
      </p>
      <code-block [code]="darkMode" />
      <div class="note">
        <strong>Two consumed properties are not declared.</strong>
        <code>--sc-container-height</code> falls back to <code>calc(100vh - 120px)</code>, and the card
        settings icon uses <code>--theme-primary</code> with a fallback of <code>#007CBE</code> — a leftover
        from the product this was extracted from. Set that one if the gear icon looks out of place.
      </div>

      <h2>Every token</h2>
      <div class="table-scroll">
        <table class="doc-table">
          <thead><tr><th>Token</th><th>Default</th><th>Affects</th></tr></thead>
          <tbody>
            @for (t of tokens; track t.name) {
              <tr>
                <td><code>{{ t.name }}</code></td>
                <td>
                  @if (t.kind === 'color') {
                    <span class="chip" [style.background]="t.value"></span>
                  }
                  <code>{{ t.value }}</code>
                </td>
                <td>{{ t.note }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <h2>Class hooks</h2>
      <p>Where a token is not enough, every element carries a stable <code>sc-</code> class.</p>
      <code-block [code]="classes" />
      <div class="note note--warn">
        <strong>Restyling by class is a looser contract than the tokens.</strong>
        Class names are stable in practice, but only the custom properties are documented as public. Prefer a
        token where one exists.
      </div>

      <h2>Printing</h2>
      <p>
        The stylesheet ships <code>&#64;media print</code> rules, and the toolbar's print button calls
        <code>window.print()</code> unless you replace <code>onPrint</code>.
      </p>
    </div>
  `,
  styles: [
    `
      .editor {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem 1.1rem;
        align-items: center;
        padding: 0.9rem 1rem;
        border: 1px solid var(--sc-border-light);
        border-radius: var(--doc-radius);
        background: var(--sc-bg-alt);
      }
      .swatch {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.75rem;
        cursor: pointer;
      }
      .swatch input {
        width: 30px;
        height: 24px;
        padding: 0;
        border: 1px solid var(--sc-border);
        border-radius: 4px;
        background: none;
        cursor: pointer;
      }
      .editor-actions {
        display: flex;
        gap: 0.4rem;
        margin-left: auto;
      }
      .density {
        margin-top: 1rem;
        max-width: 460px;
      }
      .density input {
        width: 100%;
        accent-color: var(--sc-primary);
      }
      .chip {
        display: inline-block;
        width: 11px;
        height: 11px;
        border-radius: 3px;
        border: 1px solid var(--sc-border);
        margin-right: 0.35rem;
        vertical-align: -1px;
      }
    `,
  ],
})
export class ThemingPage {
  protected readonly theme = inject(ThemeService);
  protected readonly config: CalendarConfig = { dataSource: demoDataSource };

  protected readonly tokens = TOKENS;
  protected readonly editable = EDITABLE;
  protected readonly slotHeight = signal(12);

  protected current(name: string): string {
    const override = this.theme.overrides()[name];
    if (override) return override;
    // Read what the cascade currently resolves to, so the picker starts on the real value
    // rather than the light-theme default while the dark theme is active.
    const live = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return live || TOKENS.find((t) => t.name === name)?.value || '#000000';
  }

  protected set(name: string, value: string): void {
    this.theme.setToken(name, value);
  }

  protected setDensity(value: string): void {
    this.slotHeight.set(Number(value));
    this.theme.setToken('--sc-slot-height', `${value}px`);
  }

  protected readonly overrideCss = computed(() => {
    const entries = Object.entries(this.theme.overrides());
    if (entries.length === 0) {
      return ':root {\n  /* Nothing overridden yet — pick a colour above. */\n}';
    }
    return [':root {', ...entries.map(([k, v]) => `  ${k}: ${v};`), '}'].join('\n');
  });

  protected readonly scoped = `
/* Only the calendar inside this element is affected. */
.compact-calendar {
  --sc-slot-height: 8px;
  --sc-font-size-sm: 11px;
  --sc-column-min-width: 90px;
}

.brand-calendar {
  --sc-primary: #8935ff;
  --sc-today-bg: #f5f0ff;
}
`;

  protected readonly darkMode = `
[data-theme='dark'] {
  --sc-bg: #0f172a;
  --sc-bg-alt: #1e293b;
  --sc-border: #334155;
  --sc-border-light: #1e293b;
  --sc-text: #e2e8f0;
  --sc-text-secondary: #94a3b8;
  --sc-primary: #60a5fa;
  --sc-today-bg: #1e3a5f;
  --sc-non-business-bg: rgba(15, 23, 42, 0.6);
}
`;

  protected readonly classes = `
.sc-calendar-container            /* the root; position: relative */
.sc-toolbar                       /* header bar */
.sc-grid  .sc-time-axis  .sc-timeslot  .sc-time-label
.sc-column[data-resource-id][data-date]
.sc-column-header  .sc-column-body
.sc-event[data-event-id]
.sc-event--cancelled  --timeblock  --secondary  --group  --dragging
.sc-event-content  -title  -time  -service  -badges  -resize-handle
.sc-non-business                  /* closed-hours shading */
.sc-now-indicator                 /* the current-time line */
.sc-selection-mirror              /* drawn while drag-selecting */
.sc-date-header-cell--today  --holiday  --saturday
.sc-privacy-blur
`;
}
