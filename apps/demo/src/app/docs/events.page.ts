import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import type { CalendarApp, CalendarConfig } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import { DemoFrameComponent } from '../shell/demo-frame.component';
import { EventLogComponent } from '../shell/event-log.component';
import { demoDataSource } from '../data';

/** Every channel the library publishes, in the order a session tends to meet them. */
const CHANNELS = [
  'loading:changed', 'resources:loaded', 'events:loaded', 'title:updated',
  'date:changed', 'view:changed', 'resource:changed', 'filter:changed', 'privacy:changed',
  'event:click', 'event:drop', 'event:resize',
  'slot:click', 'slot:select', 'dateHeader:click',
  'cardSettings:changed', 'cardSettings:click', 'print:requested', 'container:resized',
];

@Component({
  selector: 'page-events',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, DemoFrameComponent, CodeBlockComponent, EventLogComponent],
  template: `
    <div class="doc-content">
      <h1>Events and API</h1>
      <p class="doc-lead">
        Every module in the library talks through one bus rather than to its neighbours, so the same channels
        you use are the ones it uses internally. Nothing here is a special host-facing API.
      </p>

      <h2>Watch it live</h2>
      <p>
        This log subscribes to all {{ channelCount }} channels at once. Click an event, drag one, drag across
        empty slots, change the view, toggle privacy — everything appears.
      </p>

      <div class="split">
        <demo-frame label="Calendar" [height]="520">
          <sc-calendar [config]="config" (ready)="attach($event)" (beforeDestroy)="detach()" />
        </demo-frame>
        <div class="log-column">
          <event-log />
        </div>
      </div>

      <code-block [code]="subscribe" />

      <h2>The full catalogue</h2>
      <div class="table-scroll">
        <table class="doc-table">
          <thead><tr><th>Channel</th><th>Payload</th><th>Emitted when</th></tr></thead>
          <tbody>
            <tr><td><code>events:loaded</code></td><td><code>&#123; events &#125;</code></td><td>A fetch resolved and events were mapped.</td></tr>
            <tr><td><code>resources:loaded</code></td><td><code>&#123; resources &#125;</code></td><td>Static data resolved and columns were built.</td></tr>
            <tr><td><code>loading:changed</code></td><td><code>&#123; isLoading &#125;</code></td><td>A fetch started or finished.</td></tr>
            <tr><td><code>date:changed</code></td><td><code>&#123; date &#125;</code></td><td>Navigation, by toolbar or setter.</td></tr>
            <tr><td><code>view:changed</code></td><td><code>&#123; view, resourceMode &#125;</code></td><td>View switch — carries the reconciled mode.</td></tr>
            <tr><td><code>resource:changed</code></td><td><code>&#123; mode &#125;</code></td><td>Resource mode switch.</td></tr>
            <tr><td><code>filter:changed</code></td><td><code>&#123; resourceIds &#125;</code></td><td>The resource filter was applied.</td></tr>
            <tr><td><code>privacy:changed</code></td><td><code>&#123; enabled &#125;</code></td><td>Privacy mode toggled.</td></tr>
            <tr><td><code>event:click</code></td><td><code>&#123; event, element &#125;</code></td><td>A card was clicked, 300 ms after any drag.</td></tr>
            <tr><td><code>event:drop</code></td><td><code>&#123; event, newDate, newTime, newResourceId, oldResourceId, revert &#125;</code></td><td>A drag finished.</td></tr>
            <tr><td><code>event:resize</code></td><td><code>&#123; event, newEndTime, revert &#125;</code></td><td>An edge drag finished.</td></tr>
            <tr><td><code>slot:click</code></td><td><code>&#123; date, time, resourceId &#125;</code></td><td>An empty slot was clicked.</td></tr>
            <tr><td><code>slot:select</code></td><td><code>&#123; date, startTime, endTime, resourceId &#125;</code></td><td>A drag across empty slots finished.</td></tr>
            <tr><td><code>dateHeader:click</code></td><td><code>&#123; date &#125;</code></td><td>A column or month-cell header was clicked.</td></tr>
            <tr><td><code>title:updated</code></td><td><code>&#123; title &#125;</code></td><td>The view computed its toolbar title.</td></tr>
            <tr><td><code>cardSettings:changed</code></td><td><code>&#123; settings &#125;</code></td><td>Card display settings were replaced.</td></tr>
            <tr><td><code>cardSettings:click</code></td><td>—</td><td>The toolbar's gear button was pressed.</td></tr>
            <tr><td><code>print:requested</code></td><td>—</td><td>The print button was pressed.</td></tr>
            <tr><td><code>container:resized</code></td><td>—</td><td>The container's ResizeObserver fired.</td></tr>
            <tr><td><code>data:refresh</code></td><td>—</td><td><strong>You emit this</strong> to force a reload.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Unsubscribing</h2>
      <p>
        <code>on()</code> returns the unsubscribe function. Keep it — the calendar's own
        <code>destroy()</code> tears down the bus, but a handler that closes over an Angular component keeps
        that component alive until it does.
      </p>
      <code-block [code]="unsubscribe" />

      <h2>A DOM event too</h2>
      <p>
        Slot selection is also dispatched as a bubbling <code>CustomEvent</code> on the container, which is
        occasionally more convenient than holding an instance — a host listening at the document level, say.
      </p>
      <code-block [code]="domEvent" />

      <h2>Errors in handlers are contained</h2>
      <p>
        The bus snapshots its handler list before iterating and catches what each one throws, so a subscriber
        that fails does not stop the others or wedge the render. Errors are logged rather than swallowed.
      </p>

      <h2>State: the read side</h2>
      <p>
        Getters on <code>calendar.state</code> are read-only and always current. <code>dateRange</code> is
        cached and invalidated whenever the date or view changes.
      </p>
      <code-block [code]="stateRead" />
    </div>
  `,
  styles: [
    `
      .split {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
        gap: 1rem;
        align-items: stretch;
      }
      .log-column {
        margin: 1.25rem 0;
        min-height: 0;
      }
      @media (max-width: 1000px) {
        .split {
          grid-template-columns: 1fr;
        }
        .log-column {
          height: 320px;
        }
      }
    `,
  ],
})
export class EventsPage {
  protected readonly config: CalendarConfig = { dataSource: demoDataSource };
  protected readonly channelCount = CHANNELS.length;

  private readonly log = viewChild.required(EventLogComponent);
  private unsubscribes: Array<() => void> = [];

  /**
   * Subscribing here rather than through the wrapper's outputs on purpose: this page is
   * about the bus itself, and a couple of these channels have no output equivalent.
   */
  protected attach(calendar: CalendarApp): void {
    this.detach();
    this.unsubscribes = CHANNELS.map((channel) =>
      calendar.bus.on(channel, (payload: unknown) => this.log().push(channel, summarise(payload))),
    );
  }

  protected detach(): void {
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes = [];
  }

  protected readonly subscribe = `
// on() returns an unsubscribe function.
const off = calendar.bus.on('events:loaded', ({ events }) => {
  console.log(events.length, 'events in view');
});

// Fires once, then detaches itself.
calendar.bus.once('resources:loaded', ({ resources }) => seedFilters(resources));

// You emit this one: it clears the cache and reloads.
calendar.bus.emit('data:refresh');
`;

  protected readonly unsubscribe = `
export class BookingPage implements OnDestroy {
  private off: Array<() => void> = [];

  onReady(calendar: CalendarApp) {
    this.off = [
      calendar.bus.on('event:drop', (e) => this.persistMove(e)),
      calendar.bus.on('event:resize', (e) => this.persistResize(e)),
    ];
  }

  ngOnDestroy() {
    for (const off of this.off) off();
  }
}
`;

  protected readonly domEvent = `
// Bubbles, so a listener anywhere above the container sees it.
document.addEventListener('sc:slot:select', (e) => {
  const { date, startTime, endTime, resourceId } = e.detail;
  openBookingDialog({ date, startTime, endTime, resourceId });
});
`;

  protected readonly stateRead = `
calendar.state.currentDate          // '2026-08-15'
calendar.state.currentView          // 'resourceTimeGridDay'
calendar.state.currentResourceMode  // 'primaryView'
calendar.state.viewDuration         // 'day' | '3day' | 'week' | 'month'
calendar.state.isResourceView       // boolean
calendar.state.dateRange            // { start, end } — cached, invalidated on change
calendar.state.events               // InternalEvent[], already mapped
calendar.state.resources            // CalendarResource[], with the secondary- prefix applied
calendar.state.resourceFilters      // string[] of visible primary ids
calendar.state.privacyMode          // boolean
calendar.state.isLoading            // boolean
`;
}

/** One short line per payload — a JSON dump would push the useful part off-screen. */
function summarise(payload: unknown): string {
  if (payload === undefined || payload === null) return '';
  if (typeof payload !== 'object') return String(payload);

  const p = payload as Record<string, any>;
  if (Array.isArray(p['events'])) return `${p['events'].length} events`;
  if (Array.isArray(p['resources'])) return `${p['resources'].length} resources`;
  if (Array.isArray(p['resourceIds'])) return `${p['resourceIds'].length} selected`;
  if (p['event']) {
    const label = String(p['event'].title ?? p['event'].id).split('\n')[0];
    const target = p['newDate'] ? ` -> ${p['newDate']} ${p['newTime']}` : p['newEndTime'] ? ` -> ends ${p['newEndTime']}` : '';
    return label + target;
  }

  return Object.entries(p)
    .filter(([, v]) => typeof v !== 'function' && typeof v !== 'object')
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
}
