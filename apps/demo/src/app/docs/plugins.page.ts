import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CalendarConfig, CalendarPlugin } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import { DemoFrameComponent } from '../shell/demo-frame.component';
import { TODAY, demoDataSource } from '../data';
import { temporal } from 'steadycalendar';

/**
 * A HolidayProvider, which is also a plugin. Registering it in `plugins` is enough — the
 * calendar adopts anything exposing `getHoliday` as `config.holidayProvider` on its own.
 *
 * The dates are fabricated so the demo always has one nearby; a real one would call a
 * package or an API and cache per year.
 */
class DemoHolidayPlugin implements CalendarPlugin {
  readonly name = 'demo-holidays';

  private readonly table = new Map<string, { name: string; name_en: string }>([
    [temporal.addDaysToString(TODAY, 1), { name: 'Stadsfest', name_en: 'City Festival' }],
    [temporal.addDaysToString(TODAY, 6), { name: 'Hostdag', name_en: 'Harvest Day' }],
    [temporal.addDaysToString(TODAY, -4), { name: 'Vardag', name_en: 'Care Day' }],
  ]);

  private preloaded: string | null = null;

  init(): void {
    // Nothing to wire: this plugin is consulted, it does not subscribe.
  }

  getHoliday(dateStr: string) {
    return this.table.get(dateStr) ?? null;
  }

  getHolidayName(dateStr: string, locale?: string): string {
    const hit = this.getHoliday(dateStr);
    if (!hit) return '';
    return locale?.startsWith('en') ? hit.name_en : hit.name;
  }

  /** Called whenever the visible range changes — the hook for warming a cache. */
  preload(start: string, end: string): void {
    this.preloaded = `${start} to ${end}`;
  }

  get lastPreload(): string | null {
    return this.preloaded;
  }

  destroy(): void {
    this.table.clear();
  }
}

/** A plugin that only listens. The context gives it state, bus and config. */
class AuditPlugin implements CalendarPlugin {
  readonly name = 'audit';
  private off: Array<() => void> = [];
  readonly seen = signal(0);

  init(context: { bus: any }): void {
    this.off = [
      context.bus.on('event:drop', () => this.seen.update((n) => n + 1)),
      context.bus.on('event:resize', () => this.seen.update((n) => n + 1)),
    ];
  }

  destroy(): void {
    for (const off of this.off) off();
    this.off = [];
  }
}

@Component({
  selector: 'page-plugins',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, DemoFrameComponent, CodeBlockComponent, RouterLink],
  template: `
    <div class="doc-content">
      <h1>Plugins</h1>
      <p class="doc-lead">
        A plugin is an object with a name, an <code>init</code> and a <code>destroy</code>. It receives the
        state, the bus and the config, which is the same access the library's own modules have — there is no
        reduced plugin API.
      </p>

      <h2>The interface</h2>
      <code-block [code]="iface" />
      <p>
        Plugins are registered before the first render, so a plugin that affects painting — a holiday source,
        say — is in place for the very first frame rather than filling in on a later pass. Duplicate names are
        skipped with a warning.
      </p>

      <h2>Live: a holiday provider and an audit listener</h2>
      <div class="pill-row">
        <button class="btn" [class.btn--active]="enabled()" type="button" (click)="enabled.set(true)">
          Plugins on
        </button>
        <button class="btn" [class.btn--active]="!enabled()" type="button" (click)="enabled.set(false)">
          Plugins off
        </button>
        <span class="meter">gestures seen by the audit plugin: <code>{{ audit.seen() }}</code></span>
      </div>

      <demo-frame [label]="enabled() ? 'Two plugins registered' : 'No plugins'" [height]="500">
        <sc-calendar [config]="config()" />
      </demo-frame>
      <p class="meter">
        Last <code>preload()</code> range: <code>{{ holidayPlugin.lastPreload ?? '—' }}</code>. Page forward
        and back — it is called each time the visible range changes.
      </p>

      <h2>Holiday providers are adopted automatically</h2>
      <p>
        <code>PluginManager.register</code> only calls <code>plugin.init()</code>, so a provider passed in
        <code>plugins</code> would never have reached <code>config.holidayProvider</code> and holidays would
        silently never render. The calendar therefore scans registered plugins for a
        <code>getHoliday</code> method and adopts the first one it finds. An explicitly configured provider
        always wins.
      </p>
      <code-block [code]="holidayProvider" />
      <div class="note">
        <strong>This mutates your config object.</strong>
        Adoption assigns to <code>config.holidayProvider</code>, so a frozen config throws and a config shared
        between two calendars leaks the provider across both. The
        <a routerLink="/angular">Angular wrapper</a> passes each instance a fresh shallow copy for exactly
        this reason.
      </div>

      <h2>The provider interface</h2>
      <code-block [code]="providerIface" />
      <p>
        <code>getHoliday</code> is called once per rendered date, so cache per year if your source is
        expensive — <code>preload(start, end)</code> is the hook, called whenever the visible range changes.
      </p>

      <h2>DragPersistencePlugin</h2>
      <p>
        The one plugin that ships with the library. It listens for <code>event:drop</code> and
        <code>event:resize</code>, applies your guards, writes, and emits <code>data:refresh</code> on
        success. See <a routerLink="/interactions">interactions</a> for the full options.
      </p>

      <h2>Reaching a plugin later</h2>
      <code-block [code]="lookup" />

      <h2>Writing one</h2>
      <code-block [code]="writing" />
      <div class="note note--warn">
        <strong>Unsubscribe in <code>destroy</code>.</strong>
        <code>PluginManager.destroy()</code> calls yours, but nothing audits whether you released your
        subscriptions. A plugin holding a bus handler that closes over an Angular component keeps that
        component alive after the route changes.
      </div>
    </div>
  `,
  styles: [
    `
      .meter {
        font-size: 0.85rem;
        color: var(--sc-text-secondary);
        align-self: center;
      }
    `,
  ],
})
export class PluginsPage {
  protected readonly enabled = signal(true);
  protected readonly holidayPlugin = new DemoHolidayPlugin();
  protected readonly audit = new AuditPlugin();

  protected readonly config = computed<CalendarConfig>(() => ({
    dataSource: demoDataSource,
    ...(this.enabled() ? { plugins: [this.holidayPlugin, this.audit] } : {}),
  }));

  protected readonly iface = `
interface CalendarPlugin {
  name: string;
  init(context: { state: CalendarState; bus: EventBus; config: CalendarConfig }): void;
  destroy(): void;
}

new CalendarApp({ plugins: [new MyPlugin()], dataSource });
`;

  protected readonly holidayProvider = `
import holiday_jp from '@holiday-jp/holiday_jp';

class JapaneseHolidays {
  name = 'japanese-holidays';

  getHoliday(dateStr) {
    const year = Number(dateStr.slice(0, 4));
    // holiday_jp stores each date at UTC midnight, so the range and the keys must be
    // read in UTC too. Local getters shift every holiday back a day under a negative
    // UTC offset — New Year's Day becomes 31 December and falls outside the year.
    const found = holiday_jp.between(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year, 11, 31)));
    const hit = found.find((h) => new Date(h.date).toISOString().slice(0, 10) === dateStr);
    return hit ? { name: hit.name, name_en: hit.name_en } : null;
  }

  init() {}
  destroy() {}
}

// No holidayProvider key needed — it is adopted from plugins.
new CalendarApp({ plugins: [new JapaneseHolidays()], dataSource });
`;

  protected readonly providerIface = `
interface HolidayProvider {
  // Return null for an ordinary day.
  getHoliday(dateStr: string): { name: string; name_en?: string } | null;

  // Optional: lets you pick a name per locale.
  getHolidayName?(dateStr: string, locale?: string): string;

  // Optional: called when the visible range changes. Warm your cache here.
  preload?(start: string, end: string): void;
}
`;

  protected readonly lookup = `
const audit = calendar.pluginManager.get('audit');

// Or by capability, which is how holiday providers are found internally.
const provider = calendar.pluginManager.find((p) => typeof p.getHoliday === 'function');
`;

  protected readonly writing = `
class AutoScrollToFirstBooking {
  name = 'auto-scroll-first';
  #off = [];

  init({ state, bus }) {
    this.#off.push(
      bus.on('events:loaded', ({ events }) => {
        const earliest = events.map((e) => e.startTime).sort()[0];
        if (earliest) scrollGridTo(earliest);
      }),
    );
  }

  destroy() {
    for (const off of this.#off) off();
    this.#off = [];
  }
}
`;
}
