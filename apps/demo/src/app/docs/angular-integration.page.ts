import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { CalendarConfig } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import { DemoFrameComponent } from '../shell/demo-frame.component';
import { demoDataSource } from '../data';

@Component({
  selector: 'page-angular-integration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, DemoFrameComponent, CodeBlockComponent],
  template: `
    <div class="doc-content">
      <h1>Angular integration</h1>
      <p class="doc-lead">
        SteadyCalendar is framework-agnostic: it owns a DOM subtree, renders imperatively and publishes
        through its own event bus. Bridging that to Angular takes one component — the same one every page on
        this site uses. Copy it into your project; it has no dependencies beyond Angular and the library.
      </p>

      <h2>Usage</h2>
      <code-block [code]="usage" title="booking-page.component.html" />
      <code-block [code]="usageTs" title="booking-page.component.ts" />

      <demo-frame label="Two-way bound to the controls below" [height]="520">
        <sc-calendar
          [config]="config"
          [(date)]="date"
          [(view)]="view"
          (slotSelect)="lastSlot.set($event.date + ' ' + $event.startTime)"
          (eventClick)="lastEvent.set($event.event.id)" />
      </demo-frame>

      <div class="readout">
        <div><span>date</span><code>{{ date() ?? '—' }}</code></div>
        <div><span>view</span><code>{{ view() ?? '—' }}</code></div>
        <div><span>last slot</span><code>{{ lastSlot() ?? '—' }}</code></div>
        <div><span>last event</span><code>{{ lastEvent() ?? '—' }}</code></div>
      </div>
      <p>
        Those readouts are plain signals bound with <code>[(date)]</code> and <code>[(view)]</code>. Use the
        calendar's own toolbar — its prev/next buttons and view switcher write straight back into them.
      </p>

      <h2>The component</h2>
      <p>
        Five constraints in the library's design shape this implementation. Each is a real trap rather than a
        style preference, so they are worth reading before you modify it.
      </p>

      <h3>1. Config is not reactive</h3>
      <p>
        <code>CalendarApp</code> reads <code>this.config.*</code> live at call time and exposes no setter, so a
        changed config means destroy-and-recreate. The wrapper keys its rebuild off the config
        <em>reference</em>, which puts you in control of churn: hold the config in a signal or a class field
        and replace it only when it genuinely changes.
      </p>
      <div class="note note--danger">
        <strong>Never build the config in a getter or template expression.</strong>
        <code>[config]="&#123; dataSource &#125;"</code> allocates a new object on every change detection pass,
        and each one tears down and rebuilds the entire calendar. You get an endless flicker and a stream of
        network requests.
      </div>

      <h3>2. CalendarApp mutates the config it is given</h3>
      <p>
        <code>_resolveHolidayProvider()</code> assigns to <code>config.holidayProvider</code> when a registered
        plugin implements <code>getHoliday</code>. A frozen object therefore throws, and a shared one leaks
        state between instances — so the wrapper hands every instance a fresh shallow copy.
      </p>

      <h3>3. State changes go through <code>state</code>, not config</h3>
      <p>
        Date, view, resource mode, filters and privacy each have a setter that triggers a refetch and re-render.
        That is enormously cheaper than a rebuild, so they are separate inputs. Each is a
        <code>model()</code>, which makes them two-way: the library's own toolbar writes back through the same
        binding.
      </p>
      <p>
        Each is also echo-guarded. The bus reports the same change back after a setter runs, so without a
        comparison against the live getter, a parent that mirrors the value into its own signal would bounce
        indefinitely.
      </p>
      <code-block [code]="stateEffect" title="sc-calendar.component.ts (excerpt)" />

      <h3>4. Browser only</h3>
      <p>
        <code>init()</code> calls <code>document.querySelector</code> immediately, so the mount runs inside
        <code>afterNextRender</code>. That keeps server-side rendering and prerendering safe — relevant here,
        because this site is prerendered to static files for GitHub Pages.
      </p>

      <h3>5. Timezone is module-global</h3>
      <p>
        The <code>CalendarApp</code> constructor calls <code>setDefaultTimezone(config.timezone)</code>, which
        writes module-level state inside the library. One zone applies per page and the last calendar
        constructed wins. The wrapper deliberately does <em>not</em> expose it as a separate input, because
        doing so would imply a per-instance isolation that does not exist.
      </p>

      <h2>Change detection</h2>
      <p>
        Bus handlers fire outside Angular's knowledge. Under zoneless change detection — the default in Angular
        20 and later, and what this app uses — that is exactly why the wrapper's models are signals: writing
        one schedules change detection by itself, with no <code>NgZone</code> involvement.
      </p>
      <p>
        In a zone-based application it still works, because <code>output.emit</code> and signal writes both
        notify. You only need <code>ngZone.run()</code> if you bypass the wrapper, subscribe to
        <code>calendar.bus</code> yourself, and then mutate plain non-signal fields.
      </p>

      <h2>Teardown</h2>
      <p>
        <code>destroy()</code> unwinds in reverse mount order, disconnects the resize observer, removes every
        document-level listener and leaves the container empty. The wrapper calls it from
        <code>DestroyRef.onDestroy</code> and also unsubscribes each bus handler — <code>bus.on</code> returns
        an unsubscribe function, and <code>bus.destroy()</code> alone would not release closures the wrapper
        holds.
      </p>
      <code-block [code]="teardown" title="sc-calendar.component.ts (excerpt)" />

      <h2>The async gap</h2>
      <p>
        <code>init()</code> is asynchronous, and a config change arriving mid-flight would otherwise leave an
        orphan mounted: teardown runs against the old instance, then the in-flight one finishes and renders
        into a container nobody owns. A generation counter closes that window.
      </p>
      <code-block [code]="generation" title="sc-calendar.component.ts (excerpt)" />

      <h2>Full source</h2>
      <p>
        Both files are in this repository under <code>apps/demo/src/app/calendar/</code>:
        <code>sc-calendar.component.ts</code> and <code>sc-calendar.types.ts</code>. The second only names the
        bus payloads, since the library ships declarations for its own surface but leaves
        <code>EventBus.on</code> untyped — a plugin may emit anything.
      </p>
      <div class="note">
        <strong>Not published as a package.</strong>
        It is deliberately copy-paste rather than <code>steadycalendar-angular</code> on npm: two files you own
        and can adapt, with no second release pipeline and no Angular version range to support.
      </div>
    </div>
  `,
  styles: [
    `
      .readout {
        display: flex;
        flex-wrap: wrap;
        gap: 1.25rem;
        padding: 0.7rem 1rem;
        border: 1px solid var(--sc-border-light);
        border-radius: var(--doc-radius);
        background: var(--sc-bg-alt);
        font-size: 0.85rem;
      }
      .readout div {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }
      .readout span {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--sc-text-muted);
      }
    `,
  ],
})
export class AngularIntegrationPage {
  protected readonly config: CalendarConfig = { dataSource: demoDataSource };

  protected readonly date = signal<string | undefined>(undefined);
  protected readonly view = signal<string | undefined>(undefined);
  protected readonly lastSlot = signal<string | null>(null);
  protected readonly lastEvent = signal<string | null>(null);

  protected readonly usage = `
<sc-calendar
  [config]="config"
  [(date)]="date"
  [(view)]="view"
  [(resourceMode)]="mode"
  [(resourceFilters)]="filters"
  [(privacyMode)]="privacy"
  (ready)="onReady($event)"
  (eventClick)="onEventClick($event)"
  (slotSelect)="onSlotSelect($event)"
  (eventDrop)="onDrop($event)"
  (eventResize)="onResize($event)"
  (eventsLoaded)="onEventsLoaded($event)" />
`;

  protected readonly usageTs = `
import { Component, signal } from '@angular/core';
import type { CalendarApp, CalendarConfig } from 'steadycalendar';
import { ScCalendarComponent } from './calendar/sc-calendar.component';
import type { EventDropDetail, SlotSelectDetail } from './calendar/sc-calendar.types';

@Component({
  selector: 'booking-page',
  imports: [ScCalendarComponent],
  templateUrl: './booking-page.component.html',
})
export class BookingPage {
  // A stable reference. Replacing it rebuilds the calendar, so do that deliberately.
  protected readonly config: CalendarConfig = {
    dataSource: {
      fetchResources: () => this.api.resources(),
      fetchEvents: ({ start, end }) => this.api.bookings(start, end),
    },
  };

  protected readonly date = signal<string | undefined>(undefined);
  protected readonly view = signal('resourceTimeGridDay');

  private calendar?: CalendarApp;

  onReady(calendar: CalendarApp) {
    this.calendar = calendar;
  }

  onSlotSelect(slot: SlotSelectDetail) {
    this.dialog.openNewBooking(slot);
  }

  async onDrop({ event, newDate, newTime, newResourceId, revert }: EventDropDetail) {
    try {
      await this.api.move(event.id, { newDate, newTime, newResourceId });
      this.calendar?.bus.emit('data:refresh');
    } catch {
      revert();   // puts the element back where it was
    }
  }
}
`;

  protected readonly stateEffect = `
// One effect per state input. Reading instance() means it re-applies after a rebuild;
// comparing against the live getter first stops a bus echo from bouncing.
effect(() => {
  const app = this.instance();
  const date = this.date();
  if (app && date && app.state.currentDate !== date) {
    app.state.setCurrentDate(date);
  }
});
`;

  protected readonly teardown = `
private destroyInstance(): void {
  for (const unsubscribe of this.teardown) unsubscribe();
  this.teardown = [];

  const app = this.instance();
  if (app) {
    this.beforeDestroy.emit(app);
    app.destroy();
    this.instance.set(null);
  }
}
`;

  protected readonly generation = `
private async rebuild(config: CalendarConfig): Promise<void> {
  this.destroyInstance();
  const generation = ++this.generation;

  // Constraint 2: a fresh copy, because CalendarApp writes to the object it is given.
  const app = new CalendarApp({ ...config, el: this.hostRef().nativeElement });
  this.subscribe(app);
  await app.init();

  // Lost the race: a newer config arrived while init() was awaiting. Drop this one.
  if (generation !== this.generation) {
    app.destroy();
    return;
  }

  this.instance.set(app);
  this.ready.emit(app);
}
`;
}
