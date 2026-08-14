import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CalendarState, DataBridge, EventBus, SLOT_INTERVAL, temporal } from 'steadycalendar/headless';
import type { InternalEvent } from 'steadycalendar';
import { CodeBlockComponent } from '../shell/code-block.component';
import { STAFF, TODAY, createDemoDataSource } from '../data';

const { convertTimeToMinutes, convertMinutesToTime } = temporal;

@Component({
  selector: 'page-headless',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodeBlockComponent],
  template: `
    <div class="doc-content">
      <h1>Headless mode</h1>
      <p class="doc-lead">
        State, data loading, field mapping and date arithmetic with no DOM at all — 8.7 kB gzipped. Use it when
        you want the scheduling logic but intend to render everything yourself, or when there is nothing to
        render because you are on a server.
      </p>

      <h2>Two ways in</h2>
      <div class="table-scroll">
        <table class="doc-table">
          <thead><tr><th>Approach</th><th>Import</th><th>Gives you</th></tr></thead>
          <tbody>
            <tr>
              <td><code>headless: true</code></td>
              <td><code>steadycalendar</code></td>
              <td>The full <code>CalendarApp</code> lifecycle, minus the mount. Plugins and preferences still run.</td>
            </tr>
            <tr>
              <td>The headless entry</td>
              <td><code>steadycalendar/headless</code></td>
              <td>The pieces, assembled by you. A third of the bytes, because no renderer is in the bundle.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <code-block [code]="twoWays" />

      <h2>Live: free slots, rendered by Angular</h2>
      <p>
        Below is an <code>EventBus</code>, a <code>CalendarState</code> and a <code>DataBridge</code>
        assembled by hand — no <code>CalendarApp</code>, no calendar DOM anywhere on the page. Every box is an
        Angular template reading a signal.
      </p>

      <div class="controls">
        <label class="field">
          <span>Date</span>
          <input type="date" [value]="date()" (change)="setDate($any($event.target).value)" />
        </label>
        <label class="field">
          <span>Appointment length</span>
          <select [value]="duration()" (change)="duration.set(+$any($event.target).value)">
            <option [value]="20">20 minutes</option>
            <option [value]="30">30 minutes</option>
            <option [value]="60">60 minutes</option>
          </select>
        </label>
        <span class="loaded">{{ loaded() }} events loaded</span>
      </div>

      @for (staff of staffList; track staff.id) {
        <div class="row">
          <div class="who"><span class="dot" [style.background]="staff.color"></span>{{ staff.name }}</div>
          <div class="slots">
            @for (slot of freeFor(staff.id); track slot) {
              <span class="slot">{{ slot }}</span>
            } @empty {
              <span class="none">fully booked between 09:00 and 17:00</span>
            }
          </div>
        </div>
      }

      <code-block [code]="freeSlots" title="the code behind that" />
      <p>
        Time blocks occupy slots exactly like bookings, so breaks are excluded without any special handling —
        the lunch block at 12:00 is why the middle of each row is missing.
      </p>

      <h2>What is in the headless bundle</h2>
      <p>
        {{ headlessCount }} exports: <code>EventBus</code>, <code>CalendarState</code>,
        <code>DataBridge</code>, <code>PreferencesBridge</code>, <code>EventMapper</code>,
        <code>PluginManager</code>, the <code>temporal</code> and <code>ColorUtils</code> namespaces, the field
        maps, the translations, and the grid constants.
      </p>
      <div class="note">
        <strong><code>CalendarApp</code> is deliberately absent</strong>, and a test in the library asserts it
        stays that way — including it would drag the entire rendering layer back into the bundle and defeat
        the point.
      </div>
      <div class="note note--danger">
        <strong>The <code>holidays</code> namespace typechecks here but does not exist at runtime.</strong>
        <code>types/headless.d.ts</code> re-exports everything from <code>core.d.ts</code>, which declares
        <code>holidays</code> — but the headless entry does not export it. So
        <code>import &#123; holidays &#125; from 'steadycalendar/headless'</code> compiles and then throws.
        Verified against 0.5.0: the root entry exports 47 names, the headless entry 29, and
        <code>holidays</code> is in the difference. Import it from <code>steadycalendar</code> instead.
      </div>

      <h2>On the server</h2>
      <p>
        The headless entry touches no browser global, so it runs under Node — useful for computing
        availability in an API, or for rendering an agenda into an email. Set the timezone explicitly there:
        a server in UTC otherwise resolves "today" differently from the user looking at it.
      </p>
      <code-block [code]="server" />

      <h2>The temporal namespace</h2>
      <p>
        Around 36 date and time functions, all running on a UTC epoch so a day is a day across every DST
        boundary. The library's own suite compares them against a Temporal polyfill across roughly 18,600
        dates, and runs under six timezones in CI.
      </p>
      <code-block [code]="temporalApi" />
      <div class="note note--warn">
        <strong><code>setDefaultTimezone</code> is module-global.</strong>
        One zone per page or per process. In a server handling requests for users in different zones, pass the
        zone explicitly to each call rather than setting a default.
      </div>
    </div>
  `,
  styles: [
    `
      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        align-items: flex-end;
        padding: 0.9rem 1rem;
        border: 1px solid var(--sc-border-light);
        border-radius: var(--doc-radius);
        background: var(--sc-bg-alt);
        margin-bottom: 1rem;
      }
      .controls .field {
        margin: 0;
        min-width: 160px;
      }
      .loaded {
        font-size: 0.8rem;
        color: var(--sc-text-secondary);
        padding-bottom: 0.4rem;
      }
      .row {
        display: grid;
        grid-template-columns: 160px 1fr;
        gap: 0.75rem;
        padding: 0.55rem 0;
        border-bottom: 1px solid var(--sc-border-light);
        align-items: baseline;
      }
      .who {
        font-size: 0.87rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.45rem;
      }
      .dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        flex: none;
      }
      .slots {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
      }
      .slot {
        font-family: var(--doc-mono);
        font-size: 0.72rem;
        padding: 0.1rem 0.35rem;
        border-radius: 4px;
        border: 1px solid var(--sc-border-light);
        background: var(--sc-bg-alt);
        color: var(--sc-text-secondary);
      }
      .none {
        font-size: 0.8rem;
        color: var(--sc-text-muted);
      }
      @media (max-width: 700px) {
        .row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class HeadlessPage {
  protected readonly staffList = STAFF;
  protected readonly headlessCount = 29;

  protected readonly date = signal(TODAY);
  protected readonly duration = signal(30);
  protected readonly events = signal<InternalEvent[]>([]);
  protected readonly loaded = computed(() => this.events().length);

  private readonly bus = new EventBus();
  private readonly state = new CalendarState(this.bus);
  private readonly data: DataBridge;

  constructor() {
    // Exactly the assembly the README's headless recipe describes: three objects and a
    // subscription. No CalendarApp, so nothing ever looks for a container.
    this.data = new DataBridge(this.state, this.bus, {
      dataSource: createDemoDataSource({ latency: 0 }),
    });
    this.data.init();

    this.bus.on('events:loaded', ({ events }: { events: InternalEvent[] }) => this.events.set(events));
    void this.data.loadEvents();

    // DataBridge subscribes to the bus and holds a cache; without this the page keeps
    // both alive after the route changes.
    inject(DestroyRef).onDestroy(() => {
      this.data.destroy();
      this.bus.destroy();
    });
  }

  protected setDate(value: string): void {
    if (!value) return;
    this.date.set(value);
    // Setting the date on state is what makes DataBridge refetch — the same mechanism the
    // rendered calendar uses, minus anything drawing the result.
    this.state.setCurrentDate(value);
  }

  protected freeFor(resourceId: string): string[] {
    return freeSlots(this.events(), resourceId, { duration: this.duration() });
  }

  protected readonly twoWays = `
// 1. The full lifecycle, without the mount. Plugins, preferences and data all run;
//    viewManager, toolbar and eventRenderer are null.
const calendar = new CalendarApp({ headless: true, dataSource });
await calendar.init();
calendar.state.events;   // populated

// 2. The pieces, assembled by you. A third of the bytes.
import { EventBus, CalendarState, DataBridge } from 'steadycalendar/headless';
`;

  protected readonly freeSlots = `
import { EventBus, CalendarState, DataBridge, temporal, SLOT_INTERVAL }
  from 'steadycalendar/headless';

const { convertTimeToMinutes, convertMinutesToTime } = temporal;

function freeSlots(events, resourceId, { open = '09:00', close = '17:00', duration = 30 } = {}) {
  const busy = events
    .filter((e) => e.resourceId === resourceId && !e.isCancelled)
    .map((e) => [convertTimeToMinutes(e.startTime), convertTimeToMinutes(e.endTime)]);

  const slots = [];
  for (let t = convertTimeToMinutes(open); t + duration <= convertTimeToMinutes(close); t += SLOT_INTERVAL) {
    if (!busy.some(([s, end]) => t < end && t + duration > s)) slots.push(convertMinutesToTime(t));
  }
  return slots;
}

const bus = new EventBus();
const state = new CalendarState(bus);
const data = new DataBridge(state, bus, { dataSource });
data.init();

bus.on('events:loaded', ({ events }) => render(freeSlots(events, 's1')));
await data.loadEvents();

// Changing the date refetches, exactly as it would with a rendered calendar.
state.setCurrentDate('2026-08-20');
`;

  protected readonly server = `
import { EventBus, CalendarState, DataBridge, temporal } from 'steadycalendar/headless';

// A server in UTC resolves "today" differently from the user looking at it.
temporal.setDefaultTimezone('Europe/Lisbon');

export async function availability(dateStr, resourceId) {
  const bus = new EventBus();
  const state = new CalendarState(bus);
  const data = new DataBridge(state, bus, { dataSource: db });

  data.init();
  state.setCurrentDate(dateStr);
  await data.loadEvents();

  const slots = freeSlots(state.events, resourceId);
  data.destroy();
  bus.destroy();
  return slots;
}
`;

  protected readonly temporalApi = `
import { temporal } from 'steadycalendar';

temporal.getCurrentDate('Asia/Tokyo');             // '2026-08-15'
temporal.addDaysToString('2026-08-15', 7);          // '2026-08-22'
temporal.addMonths('2026-01-31', 1);                // '2026-02-28' — clamps, not Mar 3
temporal.getWeekRange('2026-08-15');                // { start, end }
temporal.timeDiff('09:00', '10:30');                // 90
temporal.convertMinutesToTime(570);                 // '09:30'
temporal.formatTimeRange('09:00', 90, 'ja-JP');     // locale-aware
temporal.isWithinRange('2026-08-15', start, end);   // boolean
`;
}

/** The README's recipe, verbatim, so what the page renders is what the page documents. */
function freeSlots(
  events: InternalEvent[],
  resourceId: string,
  { open = '09:00', close = '17:00', duration = 30 } = {},
): string[] {
  const busy = events
    .filter((e) => e.resourceId === resourceId && !e.isCancelled)
    .map((e) => [convertTimeToMinutes(e.startTime), convertTimeToMinutes(e.endTime)]);

  const slots: string[] = [];
  for (let t = convertTimeToMinutes(open); t + duration <= convertTimeToMinutes(close); t += SLOT_INTERVAL) {
    if (!busy.some(([s, end]) => t < end && t + duration > s)) slots.push(convertMinutesToTime(t));
  }
  return slots;
}
