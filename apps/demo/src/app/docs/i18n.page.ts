import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import type { CalendarConfig } from 'steadycalendar';
import { DEFAULT_TRANSLATIONS, JA_TRANSLATIONS } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import { DemoFrameComponent } from '../shell/demo-frame.component';
import { demoDataSource } from '../data';

type Language = 'en' | 'ja' | 'sv' | 'mixed';

@Component({
  selector: 'page-i18n',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, DemoFrameComponent, CodeBlockComponent],
  template: `
    <div class="doc-content">
      <h1>Locale and language</h1>
      <p class="doc-lead">
        <code>locale</code> formats dates and numbers. <code>translations</code> supplies strings. They are
        completely independent, which is why a language the library has never heard of works with no
        contribution to the library at all.
      </p>

      <h2>Four combinations</h2>
      <div class="pill-row">
        <button class="btn" [class.btn--active]="lang() === 'en'" type="button" (click)="lang.set('en')">
          en-US, defaults
        </button>
        <button class="btn" [class.btn--active]="lang() === 'ja'" type="button" (click)="lang.set('ja')">
          ja-JP + JA_TRANSLATIONS
        </button>
        <button class="btn" [class.btn--active]="lang() === 'sv'" type="button" (click)="lang.set('sv')">
          sv-SE, hand-written
        </button>
        <button class="btn" [class.btn--active]="lang() === 'mixed'" type="button" (click)="lang.set('mixed')">
          ja-JP dates, English strings
        </button>
      </div>

      <demo-frame [label]="frameLabel()" [height]="480">
        <sc-calendar [config]="config()" />
      </demo-frame>
      <code-block [code]="sample()" />

      <p>
        The last combination is the one that shows they are orthogonal: Japanese date formatting — the
        <code>年月日</code> title format and Japanese weekday characters — with an entirely English toolbar.
        Neither setting reaches into the other.
      </p>

      <h2>What <code>locale</code> actually changes</h2>
      <div class="table-scroll">
        <table class="doc-table">
          <thead><tr><th>Surface</th><th>Effect</th></tr></thead>
          <tbody>
            <tr><td>Toolbar title</td><td>Formatted per locale; <code>ja-JP</code> switches to the <code>年月日</code> form.</td></tr>
            <tr><td>Column headers</td><td>Weekday names from <code>Intl</code>.</td></tr>
            <tr><td>Time labels</td><td>12- or 24-hour clock as the locale dictates.</td></tr>
            <tr><td>Durations</td><td>The minute suffix — <code>分</code> under <code>ja-JP</code>.</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Values are normalised, so <code>'ja'</code> becomes <code>'ja-JP'</code> and <code>'en'</code> becomes
        <code>'en-US'</code>. Anything else is passed to <code>Intl</code> as given.
      </p>

      <h2>Every translation key</h2>
      <p>
        Rendered from the library's own <code>DEFAULT_TRANSLATIONS</code>, so this list cannot drift out of
        date. Each key falls back to its English default individually — a partial map is always safe.
      </p>
      <div class="table-scroll">
        <table class="doc-table">
          <thead><tr><th>Key</th><th>English default</th></tr></thead>
          <tbody>
            @for (entry of translationKeys; track entry[0]) {
              <tr><td><code>{{ entry[0] }}</code></td><td>{{ entry[1] }}</td></tr>
            }
          </tbody>
        </table>
      </div>
      <p>
        <code>&#123;count&#125;</code> is the only placeholder, used by
        <code>multipleResources</code>. Substitution happens through the exported
        <code>translate(translations, key, vars)</code> helper.
      </p>

      <h2>The keys that are not in that list</h2>
      <div class="note note--warn">
        <strong>View names and resource modes are looked up as translation keys too.</strong>
        The view switcher reads <code>translations['resourceTimeGridDay']</code> and the mode switcher reads
        <code>translations['primaryView']</code>, but neither appears in
        <code>DEFAULT_TRANSLATIONS</code>. They fall back to built-in English labels, so you only notice when
        translating a UI and finding those two dropdowns still in English.
      </div>
      <code-block [code]="viewKeys" />

      <h2>Right-to-left</h2>
      <p>
        There is no RTL mode. The stylesheet uses physical properties — <code>left</code> and
        <code>right</code> rather than <code>inset-inline</code> — and events are positioned with absolute
        offsets computed from the left edge. Setting <code>dir="rtl"</code> flips the text but not the grid,
        so treat RTL as unsupported today rather than as a styling exercise.
      </p>
    </div>
  `,
})
export class I18nPage {
  protected readonly lang = signal<Language>('en');

  protected readonly translationKeys = Object.entries(DEFAULT_TRANSLATIONS as Record<string, string>);

  protected readonly config = computed<CalendarConfig>(() => {
    switch (this.lang()) {
      case 'ja':
        return { dataSource: demoDataSource, locale: 'ja-JP', translations: JA_TRANSLATIONS };
      case 'sv':
        return { dataSource: demoDataSource, locale: 'sv-SE', translations: SV };
      case 'mixed':
        return { dataSource: demoDataSource, locale: 'ja-JP' };
      default:
        return { dataSource: demoDataSource };
    }
  });

  protected readonly frameLabel = computed(
    () =>
      ({
        en: 'en-US with the built-in English strings',
        ja: 'Japanese formatting and Japanese strings',
        sv: 'Swedish formatting, strings written by hand',
        mixed: 'Japanese formatting, English strings — they are independent',
      })[this.lang()],
  );

  protected readonly sample = computed(() => SAMPLES[this.lang()]);

  protected readonly viewKeys = `
new CalendarApp({
  translations: {
    // In DEFAULT_TRANSLATIONS.
    today: 'Idag',
    print: 'Skriv ut',

    // Not in DEFAULT_TRANSLATIONS, but read by the view switcher.
    resourceTimeGridDay: 'Dag',
    resourceTimeGridWeek: 'Vecka',
    dayGridMonth: 'Manad',
    list: 'Lista',

    // Read by the resource-mode switcher.
    primaryView: 'Per person',
    secondaryView: 'Per rum',
    integratedView: 'Allt',
    flatView: 'Per datum',
  },
});
`;
}

const SV: Record<string, string> = {
  schedule: 'Schema',
  today: 'Idag',
  previous: 'Foregaende',
  next: 'Nasta',
  print: 'Skriv ut',
  resources: 'Personal',
  resourceDisplay: 'Personalvisning',
  selectAll: 'Valj alla',
  addReservation: 'Ny bokning',
  privacyMode: 'Sekretess',
  listTime: 'Tid',
  listClient: 'Kund',
  listResource: 'Personal',
  listService: 'Tjanst',
  listStatus: 'Status',
  listEmpty: 'Inga bokningar',
  unknownClient: 'Okand kund',
  reserved: 'Bokad',
  resourceTimeGridDay: 'Dag',
  resourceTimeGridThreeDay: '3 dagar',
  resourceTimeGridWeek: 'Vecka',
  dayGridMonth: 'Manad',
  list: 'Lista',
  primaryView: 'Per person',
  secondaryView: 'Per rum',
  integratedView: 'Allt',
  flatView: 'Per datum',
};

const SAMPLES: Record<Language, string> = {
  en: `
// The default. Neither option is set.
new CalendarApp({ dataSource });
`,
  ja: `
import { CalendarApp, JA_TRANSLATIONS } from 'steadycalendar';

new CalendarApp({
  locale: 'ja-JP',              // formatting
  translations: JA_TRANSLATIONS, // strings
  dataSource,
});
`,
  sv: `
// A language the library has never heard of. No contribution needed —
// every key it does not know falls back to English on its own.
new CalendarApp({
  locale: 'sv-SE',
  translations: {
    today: 'Idag',
    print: 'Skriv ut',
    resources: 'Personal',
    listClient: 'Kund',
    // ...and the view and mode keys, which are not in DEFAULT_TRANSLATIONS.
    resourceTimeGridDay: 'Dag',
    primaryView: 'Per person',
  },
  dataSource,
});
`,
  mixed: `
// Japanese dates, English strings. The two settings never consult each other.
new CalendarApp({ locale: 'ja-JP', dataSource });
`,
};
