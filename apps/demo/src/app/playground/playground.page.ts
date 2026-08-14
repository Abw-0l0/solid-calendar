import { ChangeDetectionStrategy, Component, computed, signal, viewChild } from '@angular/core';
import type { CalendarApp, CalendarConfig, ResourceMode } from 'steadycalendar';
import { DEFAULT_TRANSLATIONS, JA_TRANSLATIONS, RESOURCE_MODES, VIEW_TYPES } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { EventLogComponent } from '../shell/event-log.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import type { EventDropDetail, EventResizeDetail, SlotSelectDetail } from '../calendar/sc-calendar.types';
import { HOLIDAYS, STAFF, TODAY, createDemoDataSource } from '../data';

type Preset = 'default' | 'japanese' | 'swedish';

const TRANSLATION_PRESETS: Record<Preset, Record<string, string> | undefined> = {
  default: undefined,
  japanese: JA_TRANSLATIONS as Record<string, string>,
  swedish: {
    schedule: 'Schema',
    today: 'Idag',
    print: 'Skriv ut',
    resources: 'Personal',
    resourceDisplay: 'Personalvisning',
    selectAll: 'Valj alla',
    addReservation: 'Ny bokning',
    privacyMode: 'Sekretess',
    resourceTimeGridDay: 'Dag',
    resourceTimeGridWeek: 'Vecka',
    dayGridMonth: 'Manad',
    list: 'Lista',
    primaryView: 'Per person',
    secondaryView: 'Per rum',
    integratedView: 'Allt',
    flatView: 'Per datum',
  },
};

const TIMEZONES = ['Europe/Lisbon', 'UTC', 'Asia/Tokyo', 'America/New_York', 'Australia/Sydney', 'Pacific/Kiritimati'];

@Component({
  selector: 'page-playground',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, EventLogComponent, CodeBlockComponent],
  template: `
    <div class="doc-content doc-content--wide">
      <div class="pg">
        <aside class="panel">
          <header class="panel-head">
            <h1>Playground</h1>
            <p>Every setting, live. Cheap changes go through state setters; structural ones rebuild.</p>
          </header>

          <section>
            <h2 class="sec">State — no rebuild</h2>

            <label class="field">
              <span>Date</span>
              <input type="date" [value]="date() ?? ''" (change)="date.set($any($event.target).value)" />
            </label>

            <label class="field">
              <span>View</span>
              <select [value]="view()" (change)="view.set($any($event.target).value)">
                @for (v of viewKeys; track v) {
                  <option [value]="v">{{ v }}</option>
                }
              </select>
            </label>

            <label class="field">
              <span>Resource mode</span>
              <select
                [value]="resourceMode()"
                [disabled]="!isResourceView()"
                (change)="resourceMode.set($any($event.target).value)">
                @for (m of modeKeys; track m) {
                  <option [value]="m">{{ m }}</option>
                }
              </select>
            </label>

            <span class="sub">Resource filter</span>
            @for (s of staff; track s.id) {
              <label class="checkbox">
                <input type="checkbox" [checked]="isVisible(s.id)" (change)="toggleResource(s.id)" />
                <span class="dot" [style.background]="s.color"></span>{{ s.name }}
              </label>
            }

            <label class="checkbox top-gap">
              <input type="checkbox" [checked]="privacyMode()" (change)="privacyMode.set($any($event.target).checked)" />
              Privacy mode
            </label>
          </section>

          <section>
            <h2 class="sec">Structural — rebuilds</h2>

            <label class="field">
              <span>Locale</span>
              <select [value]="locale()" (change)="locale.set($any($event.target).value)">
                <option value="en-US">en-US</option>
                <option value="ja-JP">ja-JP</option>
                <option value="sv-SE">sv-SE</option>
                <option value="de-DE">de-DE</option>
              </select>
            </label>

            <label class="field">
              <span>Translations</span>
              <select [value]="preset()" (change)="preset.set($any($event.target).value)">
                <option value="default">English defaults</option>
                <option value="japanese">JA_TRANSLATIONS</option>
                <option value="swedish">Swedish (hand-written)</option>
              </select>
            </label>

            <label class="field">
              <span>Timezone <em>(module-global)</em></span>
              <select [value]="timezone()" (change)="timezone.set($any($event.target).value)">
                @for (tz of timezones; track tz) {
                  <option [value]="tz">{{ tz }}</option>
                }
              </select>
            </label>

            <label class="field">
              <span>Simulated latency — {{ latency() }}ms</span>
              <input type="range" min="0" max="1500" step="100" [value]="latency()"
                     (input)="latency.set(+$any($event.target).value)" />
            </label>

            <label class="checkbox">
              <input type="checkbox" [checked]="rooms()" (change)="rooms.set($any($event.target).checked)" />
              Secondary resources (rooms)
            </label>
            <label class="checkbox">
              <input type="checkbox" [checked]="hours()" (change)="hours.set($any($event.target).checked)" />
              Business hours and overrides
            </label>
            <label class="checkbox">
              <input type="checkbox" [checked]="holidays()" (change)="holidays.set($any($event.target).checked)" />
              Public holidays
            </label>
            <label class="checkbox">
              <input type="checkbox" [checked]="customCards()" (change)="customCards.set($any($event.target).checked)" />
              Custom card fields and badges
            </label>
            <label class="checkbox">
              <input type="checkbox" [checked]="blockDrops()" (change)="blockDrops.set($any($event.target).checked)" />
              Reject drops onto Corin Vale
            </label>
          </section>

          <section>
            <h2 class="sec">Instance</h2>
            <div class="pill-row">
              <button class="btn" type="button" (click)="refresh()">refresh()</button>
              <button class="btn" type="button" (click)="refreshAll()">refresh(true)</button>
              <button class="btn" type="button" (click)="today()">Today</button>
            </div>
            <dl class="stats">
              <div><dt>events</dt><dd>{{ eventCount() }}</dd></div>
              <div><dt>loading</dt><dd>{{ loading() ? 'yes' : 'no' }}</dd></div>
              <div><dt>rebuilds</dt><dd>{{ rebuilds() }}</dd></div>
            </dl>
          </section>
        </aside>

        <div class="stage">
          <div class="calendar-area">
            <sc-calendar
              [config]="config()"
              [(date)]="date"
              [(view)]="view"
              [(resourceMode)]="resourceMode"
              [(resourceFilters)]="resourceFilters"
              [(privacyMode)]="privacyMode"
              (ready)="onReady($event)"
              (eventsLoaded)="eventCount.set($event.length)"
              (loadingChange)="loading.set($event)"
              (eventClick)="log().push('event:click', $event.event.id)"
              (slotSelect)="onSlot($event)"
              (eventDrop)="onDrop($event)"
              (eventResize)="onResize($event)"
              (dateHeaderClick)="log().push('dateHeader:click', $event)" />
          </div>

          <div class="log-area">
            <event-log />
          </div>
        </div>

        <aside class="output">
          <h2 class="sec">The config</h2>
          <p class="hint">Everything selected on the left, as code you can paste.</p>
          <code-block [code]="configSource()" />
        </aside>
      </div>
    </div>
  `,
  styles: [
    `
      .pg {
        display: grid;
        grid-template-columns: 265px minmax(0, 1fr) 340px;
        height: calc(100vh - var(--doc-header-height));
        min-height: 0;
      }
      .panel,
      .output {
        overflow-y: auto;
        padding: 1.1rem 1rem 3rem;
        border-right: 1px solid var(--sc-border-light);
        min-height: 0;
      }
      .output {
        border-right: none;
        border-left: 1px solid var(--sc-border-light);
      }
      .panel-head h1 {
        font-size: 1.2rem;
        margin-bottom: 0.25rem;
      }
      .panel-head p {
        font-size: 0.8rem;
        color: var(--sc-text-secondary);
      }
      section {
        margin-bottom: 1.5rem;
      }
      .sec {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--sc-text-muted);
        border: none;
        padding: 0;
        margin: 0 0 0.6rem;
      }
      .sub {
        display: block;
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--sc-text-secondary);
        margin: 0.5rem 0 0.3rem;
      }
      .field em {
        font-weight: 400;
        font-style: normal;
        color: var(--sc-text-muted);
      }
      .field input[type='range'] {
        width: 100%;
        accent-color: var(--sc-primary);
      }
      .top-gap {
        margin-top: 0.75rem;
      }
      .dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        flex: none;
      }
      .stage {
        display: grid;
        grid-template-rows: minmax(0, 1fr) 190px;
        min-height: 0;
        min-width: 0;
      }
      .calendar-area {
        padding: 0.6rem 0.75rem 0;
        min-height: 0;
      }
      .log-area {
        padding: 0.6rem 0.75rem 0.75rem;
        min-height: 0;
      }
      .stats {
        display: flex;
        gap: 1rem;
        margin: 0.75rem 0 0;
        font-size: 0.8rem;
      }
      .stats div {
        display: flex;
        flex-direction: column;
      }
      .stats dt {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--sc-text-muted);
      }
      .stats dd {
        margin: 0;
        font-family: var(--doc-mono);
        font-weight: 600;
      }
      .hint {
        font-size: 0.78rem;
        color: var(--sc-text-secondary);
      }
      @media (max-width: 1240px) {
        .pg {
          grid-template-columns: 240px minmax(0, 1fr);
          height: auto;
        }
        .output {
          grid-column: 1 / -1;
          border-left: none;
          border-top: 1px solid var(--sc-border-light);
        }
        .stage {
          grid-template-rows: 560px 190px;
        }
      }
      @media (max-width: 820px) {
        .pg {
          grid-template-columns: 1fr;
        }
        .panel {
          border-right: none;
          border-bottom: 1px solid var(--sc-border-light);
        }
      }
    `,
  ],
})
export class PlaygroundPage {
  protected readonly staff = STAFF;
  protected readonly viewKeys = Object.keys(VIEW_TYPES);
  protected readonly modeKeys = Object.keys(RESOURCE_MODES) as ResourceMode[];
  protected readonly timezones = TIMEZONES;

  // Cheap: pushed through state setters.
  protected readonly date = signal<string | undefined>(TODAY);
  protected readonly view = signal<string | undefined>('resourceTimeGridDay');
  protected readonly resourceMode = signal<ResourceMode | undefined>('primaryView');
  protected readonly resourceFilters = signal<string[] | undefined>(STAFF.map((s) => s.id));
  protected readonly privacyMode = signal<boolean | undefined>(false);

  // Structural: each one changes the config object, so each one rebuilds.
  protected readonly locale = signal('en-US');
  protected readonly preset = signal<Preset>('default');
  protected readonly timezone = signal('Europe/Lisbon');
  protected readonly latency = signal(200);
  protected readonly rooms = signal(true);
  protected readonly hours = signal(true);
  protected readonly holidays = signal(true);
  protected readonly customCards = signal(false);
  protected readonly blockDrops = signal(false);

  protected readonly eventCount = signal(0);
  protected readonly loading = signal(false);
  protected readonly rebuilds = signal(0);

  private calendar?: CalendarApp;
  protected readonly log = viewChild.required(EventLogComponent);

  protected readonly config = computed<CalendarConfig>(() => {
    const translations = TRANSLATION_PRESETS[this.preset()];

    const config: CalendarConfig = {
      dataSource: createDemoDataSource({
        latency: this.latency(),
        includeRooms: this.rooms(),
        includeBusinessHours: this.hours(),
      }),
      locale: this.locale(),
      timezone: this.timezone(),
      ...(translations ? { translations } : {}),
      ...(this.holidays() ? { holidays: HOLIDAYS } : {}),
      ...(this.customCards()
        ? {
            cardDisplaySettings: {
              textItems: [
                { id: 'client', name: 'Client', visible: true, order: 1 },
                { id: 'time', name: 'Time', visible: true, order: 2 },
                { id: 'service', name: 'Service', visible: true, order: 3 },
              ],
              badgeItems: [{ id: 'room', name: 'Room', visible: true, order: 1 }],
            },
            badgeTypes: {
              room: { style: 'filled', bgColor: '#334155', textColor: '#f8fafc', maxWidth: 80 },
            },
            privacySuppression: { textFieldIds: ['client'], badgeIds: [] },
            callbacks: {
              resolveEventFields: (raw: any, mapped: any) => ({
                textFields: {
                  client: mapped?.clientName ?? '',
                  service: mapped?.serviceName ?? '',
                },
                badges: raw?.secondaryResources?.length
                  ? [{ typeId: 'room', label: String(raw.secondaryResources[0].id).toUpperCase() } as any]
                  : [],
              }),
            },
          }
        : {}),
    };

    return config;
  });

  protected isResourceView(): boolean {
    const v = this.view();
    return !!v && !!VIEW_TYPES[v]?.isResource;
  }

  protected isVisible(id: string): boolean {
    return this.resourceFilters()?.includes(id) ?? false;
  }

  protected toggleResource(id: string): void {
    const current = this.resourceFilters() ?? [];
    this.resourceFilters.set(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  protected onReady(calendar: CalendarApp): void {
    this.calendar = calendar;
    this.rebuilds.update((n) => n + 1);
    this.log().push('ready', `rebuild #${this.rebuilds()}`);
  }

  protected refresh(): void {
    void this.calendar?.dataBridge.refresh();
    this.log().push('data:refresh', 'events');
  }

  protected refreshAll(): void {
    void this.calendar?.dataBridge.refresh(true);
    this.log().push('data:refresh', 'events + static');
  }

  protected today(): void {
    this.date.set(TODAY);
  }

  protected onSlot({ date, startTime, endTime, resourceId }: SlotSelectDetail): void {
    this.log().push('slot:select', `${date} ${startTime}${endTime ? '-' + endTime : ''} ${resourceId ?? ''}`);
  }

  protected onDrop({ event, newDate, newTime, newResourceId, revert }: EventDropDetail): void {
    if (this.blockDrops() && newResourceId === 's3') {
      revert();
      this.log().push('event:drop', `REJECTED ${event.id}`);
      return;
    }
    this.log().push('event:drop', `${event.id} -> ${newDate} ${newTime}`);
  }

  protected onResize({ event, newEndTime }: EventResizeDetail): void {
    this.log().push('event:resize', `${event.id} ends ${newEndTime}`);
  }

  /** Reconstructs the selected configuration as pasteable source. */
  protected readonly configSource = computed(() => {
    const lines: string[] = ['new CalendarApp({', "  el: '#calendar',", '  dataSource,'];

    lines.push(`  locale: '${this.locale()}',`);
    lines.push(`  timezone: '${this.timezone()}',   // module-global, one zone per page`);

    if (this.preset() === 'japanese') lines.push('  translations: JA_TRANSLATIONS,');
    if (this.preset() === 'swedish') lines.push('  translations: { today: \'Idag\', /* ... */ },');
    if (this.holidays()) lines.push('  holidays: { \'2026-08-17\': \'Founders Day\', /* ... */ },');

    if (this.customCards()) {
      lines.push(
        '',
        '  cardDisplaySettings: {',
        "    textItems: [",
        "      { id: 'client',  name: 'Client',  visible: true, order: 1 },",
        "      { id: 'time',    name: 'Time',    visible: true, order: 2 },",
        "      { id: 'service', name: 'Service', visible: true, order: 3 },",
        '    ],',
        "    badgeItems: [{ id: 'room', name: 'Room', visible: true, order: 1 }],",
        '  },',
        '',
        '  // Without a matching badgeTypes entry the badge is skipped silently.',
        '  badgeTypes: {',
        "    room: { style: 'filled', bgColor: '#334155', textColor: '#f8fafc', maxWidth: 80 },",
        '  },',
        '',
        "  privacySuppression: { textFieldIds: ['client'], badgeIds: [] },",
        '',
        '  callbacks: {',
        '    resolveEventFields: (raw, mapped) => ({',
        '      textFields: { client: mapped.clientName, service: mapped.serviceName },',
        '      // typeId — not id, whatever the .d.ts says.',
        "      badges: raw.secondaryResources?.length",
        "        ? [{ typeId: 'room', label: raw.secondaryResources[0].id.toUpperCase() }]",
        '        : [],',
        '    }),',
        '  },',
      );
    }

    lines.push('});', '');
    lines.push('// State — setters, not config. No rebuild.');
    lines.push(`calendar.state.setCurrentDate('${this.date() ?? TODAY}');`);
    lines.push(`calendar.state.setCurrentView('${this.view()}');`);
    if (this.isResourceView()) {
      lines.push(`calendar.state.setCurrentResourceMode('${this.resourceMode()}');`);
    }

    const filters = this.resourceFilters() ?? [];
    if (filters.length !== STAFF.length) {
      lines.push(`calendar.state.setResourceFilters([${filters.map((f) => `'${f}'`).join(', ')}]);`);
    }
    if (this.privacyMode()) lines.push('calendar.state.setPrivacyMode(true);');

    if (this.blockDrops()) {
      lines.push(
        '',
        '// Reject a move and put the element back.',
        "calendar.bus.on('event:drop', ({ event, newResourceId, revert }) => {",
        "  if (newResourceId === 's3') revert();",
        '});',
      );
    }

    return lines.join('\n');
  });

  /** Kept so the unused-import check stays honest about where the key list comes from. */
  protected readonly translationKeyCount = Object.keys(DEFAULT_TRANSLATIONS).length;
}
