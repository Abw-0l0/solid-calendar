import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CalendarApp } from 'steadycalendar';
import type { CalendarConfig, InternalEvent, ResourceMode } from 'steadycalendar';
import type {
  EventClickDetail,
  EventDropDetail,
  EventResizeDetail,
  SlotSelectDetail,
  ViewChangeDetail,
} from './sc-calendar.types';

/**
 * Angular wrapper around SteadyCalendar's `CalendarApp`.
 *
 * The library is framework-agnostic: it owns a DOM subtree, renders imperatively, and
 * publishes through its own event bus. This component's whole job is to bridge that to
 * Angular's lifecycle and signals without either side fighting the other.
 *
 * Five constraints from the library's source shape this implementation. Each is a real
 * trap rather than a style preference:
 *
 * 1. CONFIG IS NOT REACTIVE. `CalendarApp` reads `this.config.*` live at call time and
 *    exposes no setter, so a changed config means destroy-and-recreate. The effect below
 *    keys off the config *reference*, so callers control churn by controlling identity —
 *    hold the config in a signal and replace it only when it genuinely changes.
 *
 * 2. `CalendarApp` MUTATES THE CONFIG IT IS GIVEN. `_resolveHolidayProvider()` assigns to
 *    `config.holidayProvider` when a registered plugin implements `getHoliday`. A frozen
 *    or shared object therefore breaks or leaks between instances, so each instance gets
 *    a fresh shallow copy.
 *
 * 3. STATE CHANGES GO THROUGH `state`, NOT CONFIG. Date, view, resource mode, filters and
 *    privacy have setters that trigger a refetch and re-render — far cheaper than a
 *    rebuild. They are separate `model()`s here, and each is echo-guarded: the bus feeds
 *    the same changes back, so a setter call is skipped when state already agrees.
 *
 * 4. BROWSER ONLY. `init()` calls `document.querySelector` immediately, so the mount runs
 *    inside `afterNextRender` and never during server-side rendering or prerendering.
 *
 * 5. TIMEZONE IS MODULE-GLOBAL. The `CalendarApp` constructor calls `setDefaultTimezone`,
 *    which writes module-level state in the library — one zone per page, last constructor
 *    wins. It is deliberately not a separate input here: treating it as per-instance would
 *    imply an isolation the library does not provide. Put it in `config` and accept that
 *    it is global.
 */
@Component({
  selector: 'sc-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<div #host class="sc-calendar-host"></div>',
  styles: [
    /* The calendar fills the height it is given and no more, so both the host and the
       mount point need a definite one. A container with auto height collapses the grid
       to nothing — the single most common integration mistake. */
    ':host { display: block; height: 100%; min-height: 0; }',
    '.sc-calendar-host { height: 100%; min-height: 0; }',
  ],
})
export class ScCalendarComponent {
  /**
   * The calendar configuration. Changing the reference tears the calendar down and
   * builds a new one, so keep it stable and drive routine changes through the state
   * inputs below instead.
   *
   * `el` is ignored: the wrapper always mounts into its own host element.
   */
  readonly config = input.required<CalendarConfig>();

  /** 'YYYY-MM-DD'. Two-way: the toolbar and date picker write back. */
  readonly date = model<string | undefined>(undefined);
  /** A `VIEW_TYPES` key, e.g. 'resourceTimeGridDay'. Two-way: the view switcher writes back. */
  readonly view = model<string | undefined>(undefined);
  /** Two-way: the resource-mode switcher writes back. */
  readonly resourceMode = model<ResourceMode | undefined>(undefined);
  /** Primary resource ids to show. Two-way: the filter dropdown writes back. */
  readonly resourceFilters = model<string[] | undefined>(undefined);
  /** Two-way: the toolbar's privacy toggle writes back. */
  readonly privacyMode = model<boolean | undefined>(undefined);

  /** The live instance, once mounted. Use it for `dataBridge.refresh()` and direct bus access. */
  readonly ready = output<CalendarApp>();
  /** Emitted immediately before the current instance is torn down. */
  readonly beforeDestroy = output<CalendarApp>();

  readonly eventClick = output<EventClickDetail>();
  readonly slotSelect = output<SlotSelectDetail>();
  readonly eventDrop = output<EventDropDetail>();
  readonly eventResize = output<EventResizeDetail>();
  readonly dateHeaderClick = output<string>();
  readonly viewChanged = output<ViewChangeDetail>();
  readonly eventsLoaded = output<InternalEvent[]>();
  readonly loadingChange = output<boolean>();
  readonly titleChange = output<string>();

  private readonly hostRef = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly rendered = signal(false);
  private readonly instance = signal<CalendarApp | null>(null);

  /**
   * Guards the async gap in `init()`. A config change while a previous `init()` is still
   * awaiting its first fetch would otherwise leave an orphaned calendar mounted in the
   * host: the teardown ran against the old instance, and the in-flight one then finished
   * and rendered into a container nobody owns.
   */
  private generation = 0;
  private teardown: Array<() => void> = [];

  /**
   * Set before the final teardown. Angular disposes an `OutputRef` with the component, so
   * emitting from inside `DestroyRef.onDestroy` throws NG0953 — `beforeDestroy` is only
   * meaningful on a rebuild anyway, where the component outlives the instance.
   */
  private componentDestroyed = false;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => this.rendered.set(true));
    destroyRef.onDestroy(() => {
      this.componentDestroyed = true;
      this.destroyInstance();
    });

    // Constraint 1: rebuild on config identity change, once the host exists.
    //
    // `untracked` is load-bearing, not tidiness. rebuild() reads and writes the `instance`
    // signal, and its synchronous prefix runs inside this effect's reactive context — so
    // without it, `instance` becomes a dependency here and the `instance.set(app)` at the
    // end of a successful build immediately re-runs the effect. That is an unbounded
    // rebuild loop: the calendar tears itself down and refetches forever.
    effect(() => {
      const config = this.config();
      if (!this.rendered()) return;
      untracked(() => void this.rebuild(config));
    });

    // Constraint 3: cheap state pushes. Each reads `instance()` so it re-applies after a
    // rebuild, and each compares against the live getter first so a value echoed back
    // from the bus does not bounce.
    effect(() => {
      const app = this.instance();
      const date = this.date();
      if (app && date && app.state.currentDate !== date) app.state.setCurrentDate(date);
    });
    effect(() => {
      const app = this.instance();
      const view = this.view();
      if (app && view && app.state.currentView !== view) app.state.setCurrentView(view);
    });
    effect(() => {
      const app = this.instance();
      const mode = this.resourceMode();
      if (app && mode && app.state.currentResourceMode !== mode) app.state.setCurrentResourceMode(mode);
    });
    effect(() => {
      const app = this.instance();
      const filters = this.resourceFilters();
      if (!app || !filters) return;
      const current = app.state.resourceFilters;
      const same = current.length === filters.length && current.every((id) => filters.includes(id));
      if (!same) app.state.setResourceFilters(filters);
    });
    effect(() => {
      const app = this.instance();
      const privacy = this.privacyMode();
      if (app && privacy !== undefined && app.state.privacyMode !== privacy) {
        app.state.setPrivacyMode(privacy);
      }
    });
  }

  private async rebuild(config: CalendarConfig): Promise<void> {
    this.destroyInstance();
    const generation = ++this.generation;

    // Constraint 2: a fresh copy per instance, because CalendarApp writes to it.
    // `el` is overridden rather than merged — the wrapper owns the mount point.
    const app = new CalendarApp({ ...config, el: this.hostRef().nativeElement });

    this.subscribe(app);

    try {
      await app.init();
    } catch (error) {
      console.error('[sc-calendar] init() failed', error);
      app.destroy();
      return;
    }

    // Lost the race: a newer config arrived while init() was awaiting. Drop this one.
    if (generation !== this.generation) {
      app.destroy();
      return;
    }

    this.instance.set(app);
    this.ready.emit(app);
  }

  /**
   * Bridge the bus to Angular outputs, and mirror the state the two-way models expose.
   *
   * Under zoneless change detection these handlers run outside Angular's knowledge, which
   * is exactly why the models are signals: writing one schedules change detection on its
   * own. A zone-based application needs no extra work either — `output.emit` and signal
   * writes both notify. `NgZone.run` is only required if you reach past this wrapper and
   * subscribe to the raw bus yourself while still using zone.js.
   */
  private subscribe(app: CalendarApp): void {
    const on = (event: string, handler: (payload: any) => void) => {
      this.teardown.push(app.bus.on(event, handler));
    };

    on('event:click', (payload: EventClickDetail) => this.eventClick.emit(payload));
    on('event:drop', (payload: EventDropDetail) => this.eventDrop.emit(payload));
    on('event:resize', (payload: EventResizeDetail) => this.eventResize.emit(payload));
    on('dateHeader:click', ({ date }: { date: string }) => this.dateHeaderClick.emit(date));
    on('events:loaded', ({ events }: { events: InternalEvent[] }) => this.eventsLoaded.emit(events));
    on('loading:changed', ({ isLoading }: { isLoading: boolean }) => this.loadingChange.emit(isLoading));
    on('title:updated', ({ title }: { title: string }) => this.titleChange.emit(title));

    // `slot:click` and `slot:select` are one concept to a consumer: a chosen range, where
    // a click simply has no end. CalendarApp already normalises both into this shape for
    // its own `onSlotSelect` callback, so match that rather than exposing the split.
    const slot = (payload: any) => {
      this.slotSelect.emit({
        date: payload.date,
        startTime: payload.startTime ?? payload.time,
        endTime: payload.endTime ?? null,
        resourceId: payload.resourceId ?? null,
      });
    };
    on('slot:click', slot);
    on('slot:select', slot);

    // Mirror state back into the two-way models so the toolbar's own controls stay in
    // sync with the parent's signals.
    on('date:changed', ({ date }: { date: string }) => this.date.set(date));
    on('filter:changed', ({ resourceIds }: { resourceIds: string[] }) => this.resourceFilters.set(resourceIds));
    on('privacy:changed', ({ enabled }: { enabled: boolean }) => this.privacyMode.set(enabled));
    on('view:changed', (payload: ViewChangeDetail) => {
      this.view.set(payload.view);
      this.resourceMode.set(payload.resourceMode);
      this.viewChanged.emit(payload);
    });
  }

  private destroyInstance(): void {
    for (const unsubscribe of this.teardown) unsubscribe();
    this.teardown = [];

    const app = this.instance();
    if (app) {
      if (!this.componentDestroyed) this.beforeDestroy.emit(app);
      app.destroy();
      this.instance.set(null);
    }
  }
}
