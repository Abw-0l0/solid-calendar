import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CalendarConfig } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import { DemoFrameComponent } from '../shell/demo-frame.component';
import { demoDataSource } from '../data';

interface OptionRow {
  name: string;
  type: string;
  fallback: string;
  note: string;
}

@Component({
  selector: 'page-configuration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, DemoFrameComponent, CodeBlockComponent, RouterLink],
  template: `
    <div class="doc-content">
      <h1>Configuration</h1>
      <p class="doc-lead">
        Everything is one plain object handed to the constructor. There is no builder, no module and no
        dependency injection — which also means the object is read live, so changing it after
        <code>init()</code> does nothing until you build a new calendar.
      </p>

      <h2>Try a few</h2>
      <p>
        These three change the config object, so each toggle rebuilds the calendar. That is the honest cost:
        the wrapper cannot mutate a live instance because the library offers no way to.
      </p>

      <div class="controls">
        <label class="checkbox">
          <input type="checkbox" [checked]="withRooms()" (change)="withRooms.set($any($event.target).checked)" />
          Secondary resources
        </label>
        <label class="checkbox">
          <input type="checkbox" [checked]="japanese()" (change)="japanese.set($any($event.target).checked)" />
          Japanese locale and translations
        </label>
        <label class="checkbox">
          <input type="checkbox" [checked]="cancelAll()" (change)="cancelAll.set($any($event.target).checked)" />
          Treat every booking as cancelled (custom <code>statusResolver</code>)
        </label>
      </div>

      <demo-frame label="Rebuilt on each change" [height]="500">
        <sc-calendar [config]="config()" />
      </demo-frame>

      <code-block [code]="currentConfigSource()" title="the config above" />

      <h2>Every option</h2>
      <div class="table-scroll">
        <table class="doc-table">
          <thead>
            <tr><th>Option</th><th>Type</th><th>Default</th><th>Notes</th></tr>
          </thead>
          <tbody>
            @for (row of options; track row.name) {
              <tr>
                <td><code>{{ row.name }}</code></td>
                <td><code>{{ row.type }}</code></td>
                <td>{{ row.fallback }}</td>
                <td>{{ row.note }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <h2>Callbacks, twice over</h2>
      <p>
        <code>onEventClick</code>, <code>onSlotSelect</code>, <code>onDateHeaderClick</code> and
        <code>onPrint</code> exist at the top level <em>and</em> under <code>callbacks</code>. Both fire — the
        top-level one first — so setting both calls your handler twice. The nested form is the older shape;
        prefer the top level unless you need <code>callbacks.onCardSettingsClick</code>, which has no
        top-level equivalent.
      </p>
      <code-block [code]="callbacks" />

      <h2>Resolvers</h2>
      <p>
        Two small functions decide what an incoming record <em>is</em>, and they run before anything is
        rendered. If your schema does not use a <code>title</code> field to mean "time block", or a
        <code>status</code> of exactly <code>'Cancelled'</code>, replace them.
      </p>
      <code-block [code]="resolvers" />

      <div class="note">
        <strong>Also see</strong>
        <a routerLink="/field-mapping">field mapping</a> for reading your own field names,
        <a routerLink="/i18n">locale and language</a> for <code>locale</code> and <code>translations</code>,
        and <a routerLink="/cards">cards and privacy</a> for <code>cardDisplaySettings</code>,
        <code>badgeTypes</code> and <code>privacySuppression</code>.
      </div>
    </div>
  `,
  styles: [
    `
      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem 1.5rem;
        padding: 0.85rem 1rem;
        border: 1px solid var(--sc-border-light);
        border-radius: var(--doc-radius);
        background: var(--sc-bg-alt);
      }
      .controls .checkbox {
        margin: 0;
      }
    `,
  ],
})
export class ConfigurationPage {
  protected readonly withRooms = signal(true);
  protected readonly japanese = signal(false);
  protected readonly cancelAll = signal(false);

  /**
   * A computed config: a new object each time an input changes, and stable in between.
   * That is exactly the contract the wrapper wants — the rebuild is the intended effect
   * here, not an accident.
   */
  protected readonly config = computed<CalendarConfig>(() => ({
    dataSource: demoDataSource,
    locale: this.japanese() ? 'ja-JP' : 'en-US',
    ...(this.japanese() ? { translations: JA } : {}),
    ...(this.cancelAll() ? { statusResolver: () => ({ cancelled: true }) } : {}),
    ...(this.withRooms() ? {} : { fieldMap: { dataset: { secondaryResources: 'none' } } }),
  }));

  protected readonly currentConfigSource = computed(() => {
    const lines = ['new CalendarApp({', '  el: \'#calendar\',', '  dataSource,'];
    lines.push(`  locale: '${this.japanese() ? 'ja-JP' : 'en-US'}',`);
    if (this.japanese()) lines.push('  translations: JA_TRANSLATIONS,');
    if (this.cancelAll()) lines.push('  statusResolver: () => ({ cancelled: true }),');
    if (!this.withRooms()) {
      lines.push('  // Point the dataset key at a name the payload does not have,');
      lines.push('  // and the secondary resources simply never resolve.');
      lines.push('  fieldMap: { dataset: { secondaryResources: \'none\' } },');
    }
    lines.push('});');
    return lines.join('\n');
  });

  protected readonly options: OptionRow[] = [
    { name: 'el', type: 'string | HTMLElement', fallback: "'#calendar'", note: 'A string goes to querySelector. The Angular wrapper always overrides this.' },
    { name: 'loaderEl', type: 'string | HTMLElement', fallback: '.sc-loader in container', note: 'Shown and hidden with the loading state.' },
    { name: 'dataSource', type: 'DataSource', fallback: '—', note: 'fetchResources and fetchEvents, or URL equivalents.' },
    { name: 'headless', type: 'boolean', fallback: 'false', note: 'Load data and manage state, render nothing at all.' },
    { name: 'fieldMap', type: 'FieldMap', fallback: 'DEFAULT_FIELD_MAP', note: 'How incoming field names are read.' },
    { name: 'eventTypeResolver', type: '(raw) => "timeblock" | "event"', fallback: 'title present → timeblock', note: 'Decides booking versus time block.' },
    { name: 'statusResolver', type: '(raw) => { cancelled?, completed? }', fallback: "status === 'Cancelled'", note: 'Cancelled events cannot be dragged or resized.' },
    { name: 'plugins', type: 'CalendarPlugin[]', fallback: '[]', note: 'Registered before the first render.' },
    { name: 'preferences', type: '{ fetch, save }', fallback: '—', note: 'Persists view, date, mode and filters. Requires contextId.' },
    { name: 'contextId', type: 'string', fallback: '—', note: 'Identifies whose preferences these are. Without it the bridge no-ops.' },
    { name: 'cardDisplaySettings', type: 'CardDisplaySettings', fallback: 'null', note: 'Which text fields and badges a card shows.' },
    { name: 'holidayProvider', type: 'HolidayProvider', fallback: '—', note: 'A registered plugin exposing getHoliday is adopted automatically.' },
    { name: 'holidays', type: 'Record<string, string>', fallback: '—', note: 'The simple source: a date-to-name map.' },
    { name: 'locale', type: 'string', fallback: "'en-US'", note: 'Date and number formatting only. Not strings.' },
    { name: 'timezone', type: 'string (IANA)', fallback: 'system zone', note: 'Resolves "today". Module-global — one zone per page.' },
    { name: 'translations', type: 'Record<string, string>', fallback: 'DEFAULT_TRANSLATIONS', note: 'Every user-visible string. Partial maps are safe.' },
    { name: 'badgeTypes', type: 'Record<string, any>', fallback: '{}', note: 'Styling for badge ids. Required for badges to render at all.' },
    { name: 'privacySuppression', type: '{ textFieldIds?, badgeIds? }', fallback: '[] / []', note: 'What privacy mode blurs.' },
    { name: 'onEventClick', type: '(event: InternalEvent) => void', fallback: '—', note: 'Fires only for events carrying sourceData.' },
    { name: 'onSlotSelect', type: '(detail) => void', fallback: '—', note: 'Both a click and a drag-range arrive here.' },
    { name: 'onDateHeaderClick', type: '(date: string) => void', fallback: '—', note: 'Clicking a column or month-cell header.' },
    { name: 'onPrint', type: '() => void', fallback: 'window.print()', note: 'The stylesheet ships @media print rules.' },
    { name: 'callbacks.resolveEventFields', type: '(raw, mapped) => { textFields?, badges? }', fallback: '—', note: 'The main hook for card content.' },
  ];

  protected readonly callbacks = `
new CalendarApp({
  // Fires first.
  onEventClick(event) { console.log('top level', event.id); },

  callbacks: {
    // Then this one. Both run — do not set both for the same handler.
    onEventClick(event) { console.log('nested', event.id); },

    // No top-level equivalent: only reachable here.
    onCardSettingsClick() { openCardSettingsDialog(); },
  },
});
`;

  protected readonly resolvers = `
new CalendarApp({
  // Default: a non-empty title means a time block rather than a booking.
  eventTypeResolver: (raw) => (raw.kind === 'block' ? 'timeblock' : 'event'),

  // Default: cancelled when status is exactly the string 'Cancelled'.
  // Cancelled events render struck through and refuse to drag or resize.
  statusResolver: (raw) => ({
    cancelled: raw.state === 'void' || raw.state === 'no_show',
    completed: raw.state === 'done',
  }),
});
`;
}

/** Only the keys this page shows off; every other key falls back to English individually. */
const JA: Record<string, string> = {
  schedule: 'スケジュール',
  today: '今日',
  resources: 'スタッフ',
  resourceDisplay: 'スタッフ表示',
  print: '印刷',
  privacyMode: 'プライバシー',
  addReservation: '新規予約',
  selectAll: 'すべて選択',
};
