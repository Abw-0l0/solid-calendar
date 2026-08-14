import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

export interface LogLine {
  seq: number;
  time: string;
  channel: string;
  detail: string;
}

/**
 * A rolling log of bus activity.
 *
 * Lifted from `examples/index.html`, which is the most useful thing on that page: the
 * calendar's behaviour is mostly invisible until you can see what it emitted and when.
 * Kept as a component so any docs page can drop one in beside a calendar.
 */
@Component({
  selector: 'event-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="log">
      <header>
        <span>Event bus</span>
        <button class="clear" type="button" (click)="clear()">Clear</button>
      </header>
      <ol>
        @for (line of lines(); track line.seq) {
          <li>
            <span class="t">{{ line.time }}</span>
            <span class="ch">{{ line.channel }}</span>
            <span class="d">{{ line.detail }}</span>
          </li>
        } @empty {
          <li class="empty">Interact with the calendar — clicks, drags and view changes appear here.</li>
        }
      </ol>
    </div>
  `,
  styles: [
    `
      .log {
        border: 1px solid var(--sc-border);
        border-radius: var(--doc-radius);
        overflow: hidden;
        background: var(--sc-bg-alt);
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.4rem 0.5rem 0.4rem 0.75rem;
        border-bottom: 1px solid var(--sc-border-light);
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--sc-text-secondary);
        flex: none;
      }
      .clear {
        font: inherit;
        font-size: 0.68rem;
        text-transform: none;
        letter-spacing: 0;
        padding: 0.1rem 0.4rem;
        border-radius: 4px;
        border: 1px solid var(--sc-border);
        background: var(--sc-bg);
        color: var(--sc-text-secondary);
        cursor: pointer;
      }
      ol {
        list-style: none;
        margin: 0;
        padding: 0.35rem 0;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
        font-family: var(--doc-mono);
        font-size: 0.72rem;
        line-height: 1.5;
      }
      li {
        display: grid;
        grid-template-columns: 4.5rem 8.5rem 1fr;
        gap: 0.4rem;
        padding: 0.1rem 0.75rem;
      }
      li:hover {
        background: color-mix(in srgb, var(--sc-primary) 8%, transparent);
      }
      .t {
        color: var(--sc-text-muted);
      }
      .ch {
        color: var(--sc-primary);
        font-weight: 600;
      }
      .d {
        color: var(--sc-text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .empty {
        display: block;
        padding: 0.5rem 0.75rem;
        color: var(--sc-text-muted);
        font-family: var(--sc-font-family);
        font-size: 0.78rem;
        white-space: normal;
      }
    `,
  ],
})
export class EventLogComponent {
  private readonly entries = signal<LogLine[]>([]);
  private seq = 0;

  /** Newest first, capped — an unbounded log in a long-lived page is a slow leak. */
  readonly lines = computed(() => this.entries());

  push(channel: string, detail: string): void {
    const now = new Date();
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');

    this.entries.update((current) => [{ seq: this.seq++, time, channel, detail }, ...current].slice(0, 60));
  }

  clear(): void {
    this.entries.set([]);
  }
}
