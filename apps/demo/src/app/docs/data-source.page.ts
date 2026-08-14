import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CalendarApp, CalendarConfig } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import { DemoFrameComponent } from '../shell/demo-frame.component';
import { createDemoDataSource } from '../data';

@Component({
  selector: 'page-data-source',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, DemoFrameComponent, CodeBlockComponent, RouterLink],
  template: `
    <div class="doc-content">
      <h1>Data source</h1>
      <p class="doc-lead">
        Two async functions. There is no store to register, no adapter interface to implement and no
        normalisation step you write — whatever <code>fetchEvents</code> resolves to goes through the field map
        and gets rendered.
      </p>

      <h2>The shape</h2>
      <code-block [code]="shape" />
      <p>
        The function form wins when both are present. <code>fetchResources</code> is called once;
        <code>fetchEvents</code> is called for the visible range and again whenever the date, view or resource
        mode changes.
      </p>

      <h2>Static data carries more than resources</h2>
      <p>
        <code>fetchResources</code> returns an object, not an array, and the calendar reads several collections
        out of it. All are optional, and all are named through
        <a routerLink="/field-mapping"><code>fieldMap.dataset</code></a>.
      </p>
      <div class="table-scroll">
        <table class="doc-table">
          <thead><tr><th>Key</th><th>Purpose</th></tr></thead>
          <tbody>
            <tr><td><code>resources</code></td><td>Primary columns — people, machines. Also accepts <code>assignees</code>.</td></tr>
            <tr><td><code>secondaryResources</code></td><td>The second tier — rooms, equipment.</td></tr>
            <tr><td><code>businessHours</code></td><td>Weekly opening hours, per weekday.</td></tr>
            <tr><td><code>businessOverrides</code></td><td>Date exceptions: closures and one-off hours.</td></tr>
            <tr><td><code>holidaySettings</code></td><td>What the business does on a public holiday.</td></tr>
            <tr><td><code>publicHolidays</code></td><td>A date map. The lowest-priority holiday source.</td></tr>
          </tbody>
        </table>
      </div>
      <code-block [code]="staticShape" />

      <h2>Caching, and how to defeat it</h2>
      <p>
        Static data is cached for <strong>30 minutes</strong>; events for <strong>5 minutes per range</strong>.
        So the functions are called far less often than a view switch suggests — paging back to a range you
        already visited hits the cache and renders instantly.
      </p>
      <div class="note">
        <strong>After you write, refresh.</strong>
        Persisting a drag or creating a booking does not invalidate anything on its own. Emit
        <code>data:refresh</code>, or call <code>dataBridge.refresh()</code> directly. Pass
        <code>true</code> to drop the static cache as well, which you need after editing a resource.
      </div>
      <code-block [code]="refresh" />

      <h2>Try it</h2>
      <p>
        This calendar has a deliberate 700 ms latency so the toolbar's loading indicator is visible. Reload the
        current range and watch it — then note that switching to a range you have already seen does not
        trigger a fetch at all.
      </p>
      <div class="pill-row">
        <button class="btn" type="button" (click)="refreshEvents()">refresh() — events only</button>
        <button class="btn" type="button" (click)="refreshAll()">refresh(true) — including resources</button>
        <span class="status">{{ status() }}</span>
      </div>

      <demo-frame label="700 ms simulated latency" [height]="480">
        <sc-calendar
          [config]="config"
          (ready)="calendar = $event"
          (loadingChange)="status.set($event ? 'loading…' : 'idle')"
          (eventsLoaded)="count.set($event.length)" />
      </demo-frame>
      <p class="status-line">Last load: <code>{{ count() }}</code> events.</p>

      <h2>The URL form</h2>
      <p>
        If you have no logic to add, give it URLs instead. Events are requested as
        <code>&#123;eventsUrl&#125;?start_date=…&amp;end_date=…</code> with
        <code>Accept: application/json</code> and <code>X-Requested-With: XMLHttpRequest</code>. A response of
        either <code>&#123; events: [...] &#125;</code> or a bare array is understood.
      </p>
      <code-block [code]="urlForm" />
      <div class="note note--warn">
        <strong>No auth hook.</strong>
        The URL form sends no credentials header and offers no interceptor. Anything needing a bearer token,
        a retry or an Angular <code>HttpClient</code> interceptor should use the function form and call your
        own service.
      </div>

      <h2>With Angular's HttpClient</h2>
      <p>
        The data source expects promises, so convert at the boundary. Doing it here rather than inside the
        calendar keeps interceptors, retries and cancellation in the part of the stack that owns them.
      </p>
      <code-block [code]="httpClient" title="bookings.service.ts" />
    </div>
  `,
  styles: [
    `
      .status {
        font-family: var(--doc-mono);
        font-size: 0.78rem;
        color: var(--sc-text-secondary);
        align-self: center;
      }
      .status-line {
        font-size: 0.85rem;
        color: var(--sc-text-secondary);
      }
    `,
  ],
})
export class DataSourcePage {
  protected calendar?: CalendarApp;
  protected readonly status = signal('idle');
  protected readonly count = signal(0);

  protected readonly config: CalendarConfig = {
    dataSource: createDemoDataSource({ latency: 700 }),
  };

  protected refreshEvents(): void {
    void this.calendar?.dataBridge.refresh();
  }

  protected refreshAll(): void {
    void this.calendar?.dataBridge.refresh(true);
  }

  protected readonly shape = `
interface DataSource {
  fetchEvents?(range: { start: string; end: string }): Promise<any[]>;
  fetchResources?(): Promise<any>;

  // Fallbacks, used only when the functions above are absent.
  eventsUrl?: string;
  resourcesUrl?: string;
}
`;

  protected readonly staticShape = `
async fetchResources() {
  return {
    resources: [
      { id: 's1', name: 'Alex Chen', color: '#8935FF', order: 1 },
      // closedDays, schedules and overrides all live on the resource itself.
      { id: 's2', name: 'Blake Osei', color: '#007CBE', order: 2, closedDays: ['Wednesday'] },
    ],
    secondaryResources: [{ id: 'r1', name: 'Room A', color: '#DD6B20' }],
    businessHours: [
      { day_of_week: 'Monday', start_time: '09:00', end_time: '18:00' },
      { day_of_week: 'Saturday', start_time: '10:00', end_time: '14:00' },
      // A weekday that is absent is closed all day.
    ],
    businessOverrides: [{ from_date: '2026-12-24', to_date: '2026-12-26', type: 'closed' }],
    holidaySettings: { holiday_hours_setting: 'closed' },
  };
}
`;

  protected readonly refresh = `
// After persisting a change, from anywhere:
calendar.bus.emit('data:refresh');

// Or directly, when you have the instance:
await calendar.dataBridge.refresh();      // events only
await calendar.dataBridge.refresh(true);  // events and static data

// What is currently cached, without triggering a fetch:
const staticData = calendar.dataBridge.getStaticData();
`;

  protected readonly urlForm = `
new CalendarApp({
  dataSource: {
    resourcesUrl: '/api/calendar/resources',
    eventsUrl: '/api/calendar/bookings',
  },
});

// GET /api/calendar/bookings?start_date=2026-08-15&end_date=2026-08-15
// -> { events: [...] }   or   [...]
`;

  protected readonly httpClient = `
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { DataSource } from 'steadycalendar';

@Injectable({ providedIn: 'root' })
export class BookingsService {
  private readonly http = inject(HttpClient);

  // Returned as a plain object so the reference stays stable — handing the calendar a
  // new dataSource would rebuild it, and the wrapper watches the config by identity.
  readonly dataSource: DataSource = {
    fetchResources: () =>
      firstValueFrom(this.http.get<any>('/api/calendar/resources')),

    fetchEvents: ({ start, end }) =>
      firstValueFrom(
        this.http.get<any[]>('/api/calendar/bookings', {
          params: { from: start, to: end },
        }),
      ),
  };
}
`;
}
