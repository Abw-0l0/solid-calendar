/**
 * CalendarApp — Main entry point & orchestrator
 */
import EventBus from './core/EventBus.js';
import CalendarState from './core/CalendarState.js';
import DataBridge from './data/DataBridge.js';
import PreferencesBridge from './data/PreferencesBridge.js';
import PluginManager from './plugins/PluginManager.js';
import ViewManager from './views/ViewManager.js';
import CalendarToolbar from './toolbar/CalendarToolbar.js';
import EventRenderer from './events/EventRenderer.js';
import EventClickHandler from './events/EventClickHandler.js';
import SelectionHandler from './events/SelectionHandler.js';
import DragHandler from './events/DragHandler.js';
import ResizeHandler from './events/ResizeHandler.js';
import TouchHandler from './events/TouchHandler.js';
import PrivacyRenderer from './rendering/PrivacyRenderer.js';
import { setDefaultTimezone } from './utils/temporal.js';
import { compileFieldMap, candidateNames } from './core/FieldMap.js';
import { RESOURCE_TYPES, DEFAULT_RESOURCE_COLOR, DEFAULT_NEUTRAL_COLOR } from './core/CalendarConfig.js';

export default class CalendarApp {
    constructor(config = {}) {
        this.config = config;
        // Must precede CalendarState, whose constructor resolves "today" synchronously.
        // Setting the zone afterwards would leave the calendar opening on the wrong day
        // for the hours either side of midnight — a bug that reproduces for about an
        // hour a day and is close to impossible to find by hand.
        setDefaultTimezone(config.timezone);
        this.fields = compileFieldMap(config.fieldMap);
        this.bus = new EventBus();
        this.state = new CalendarState(this.bus);
        this.dataBridge = new DataBridge(this.state, this.bus, config);
        this.preferencesBridge = new PreferencesBridge(this.state, this.bus, config);
        this.pluginManager = new PluginManager();
        this.viewManager = null;
        this.toolbar = null;
        this.eventRenderer = null;
        /** @type {Array<{init: Function, destroy: Function}>} */
        this._uiModules = [];
        this._container = null;
        this._resizeObserver = null;
    }

    async init() {
        const el = this.config.el ?? '#calendar';
        this._container = typeof el === 'string' ? document.querySelector(el) : el;
        if (!this._container) {
            console.error(`[SteadyCalendar:CalendarApp] Container not found: ${el}`);
            return;
        }

        // Loading indicator
        const loader = this.config.loaderEl
            ? (typeof this.config.loaderEl === 'string' ? document.querySelector(this.config.loaderEl) : this.config.loaderEl)
            : this._container.querySelector('.sc-loader');
        if (loader) {
            loader.style.display = 'none';
            this.bus.on('loading:changed', ({ isLoading }) => {
                loader.style.display = isLoading ? 'inline-block' : 'none';
            });
        }

        this._wireCallbacks();

        if (this.config.cardDisplaySettings) {
            this.state.setCardDisplaySettings(this.config.cardDisplaySettings);
        }

        await this.preferencesBridge.init();
        this.dataBridge.init();

        const staticData = await this.dataBridge.loadStaticData();

        const d = this.fields.dataset;
        const bh = d.businessHours(staticData);
        if (bh) this._storeBusinessHours(bh);
        const bo = d.businessOverrides(staticData);
        if (bo) this.state.setBusinessOverrides(bo);
        const hs = d.holidaySettings(staticData);
        if (hs) this.state.setHolidaySettings(hs);
        const ph = d.publicHolidays(staticData);
        if (ph) this.state.setPublicHolidays(ph);

        this._buildResources(staticData);

        // Register plugins
        if (Array.isArray(this.config.plugins)) {
            const context = { state: this.state, bus: this.bus, config: this.config };
            for (const plugin of this.config.plugins) {
                this.pluginManager.register(plugin, context);
            }
        }
        this._resolveHolidayProvider();

        // Plugins must be registered first, so date headers can name holidays on the
        // very first paint rather than filling them in on a later render.
        if (!this.config.headless) {
            this._mountUI();
        }

        // Must follow _mountUI: EventRenderer.init only subscribes to events:loaded, so
        // mounting after this call would leave the grid empty until the next data cycle.
        await this.dataBridge.loadEvents();
        this._setupResizeObserver(this._container);

        console.warn('[SteadyCalendar:CalendarApp] Initialized');
    }


    /**
     * Adopt a registered plugin that also implements the HolidayProvider interface.
     *
     * PluginManager.register only calls plugin.init(), so passing a provider in
     * `plugins` — which is what the documented example does — never reached
     * config.holidayProvider and holidays silently never rendered. An explicitly
     * configured provider always wins.
     */
    _resolveHolidayProvider() {
        if (!this.config.holidayProvider) {
            const provider = this.pluginManager.find((p) => typeof p?.getHoliday === 'function');
            if (provider) this.config.holidayProvider = provider;
        }
        const { start, end } = this.state.dateRange;
        this.config.holidayProvider?.preload?.(start, end);
    }

    /**
     * Build the calendar UI inside the container.
     *
     * Everything mounts on the container itself rather than on .sc-grid, and that is
     * deliberate: ViewManager destroys and recreates the whole view subtree on every
     * view switch, so delegated listeners bound inside it would die with it and need
     * rebinding. MonthView and ListView have no grid at all. The container outlives
     * every view, so these listeners are attached once and never rebound.
     *
     * Order is load-bearing; each step below says why.
     */
    _mountUI() {
        const root = this._container;

        // .sc-calendar-container is position:relative, which is the containing block for
        // absolutely positioned events. Without it the grid renders but events pile up
        // at the page origin.
        root.classList.add('sc-calendar-container');

        this.privacyRenderer = new PrivacyRenderer(this.state, this.bus, this.config);
        this.privacyRenderer.init(root);

        // Before ViewManager: the toolbar must be subscribed to title:updated before the
        // first view mount emits it, and it inserts itself as the container's first child.
        this.toolbar = new CalendarToolbar(this.state, this.bus, this.config);
        this.toolbar.init(root);

        // Before EventRenderer: _findColumnBody is a live DOM query, so the columns have
        // to exist by the time the first events:loaded arrives.
        this.viewManager = new ViewManager(this.state, this.bus, this.config);
        this.viewManager.init(root);

        this.eventRenderer = new EventRenderer(this.state, this.bus, this.config);
        this.eventRenderer.init(root);

        this._uiModules = [
            new EventClickHandler(this.state, this.bus, this.config),
            new SelectionHandler(this.state, this.bus, this.config),
            new DragHandler(this.state, this.bus, this.config),
            new ResizeHandler(this.state, this.bus, this.config),
            new TouchHandler(this.state, this.bus, this.config),
        ];
        for (const module of this._uiModules) module.init(root);
    }

    _buildResources(staticData) {
        if (!staticData) return;
        const f = this.fields;
        const resources = [];

        const primary = f.dataset.resources(staticData) ?? [];
        for (const r of primary) {
            resources.push({
                id: f.resource.id(r),
                title: f.resource.name(r) ?? '',
                color: f.resource.color(r) ?? DEFAULT_RESOURCE_COLOR,
                closedDays: f.resource.closedDays(r) ?? [],
                order: f.resource.order(r) ?? 0,
                schedules: f.resource.schedules(r) ?? [],
                overrides: f.resource.overrides(r) ?? [],
                // Holiday-hours policy is a passthrough sub-schema; see docs/DATA-SHAPES.md.
                holiday_hours_setting: r.holiday_hours_setting ?? null,
                holiday_start_time: r.holiday_start_time ?? null,
                holiday_end_time: r.holiday_end_time ?? null,
                holiday_hours: r.holiday_hours ?? [],
                type: RESOURCE_TYPES.STAFF
            });
        }

        const secondary = f.dataset.secondaryResources(staticData) ?? [];
        for (const r of secondary) {
            resources.push({
                // Prefixed so a room id cannot collide with a primary-resource id.
                id: `resource-${f.secondaryResource.id(r)}`,
                title: f.secondaryResource.name(r) ?? '',
                color: f.secondaryResource.color(r) ?? DEFAULT_NEUTRAL_COLOR,
                closedDays: [],
                order: f.secondaryResource.order(r) ?? 0,
                type: RESOURCE_TYPES.RESOURCE
            });
        }

        this._warnIfNoResources(staticData, resources);

        this.state.setResources(resources);
        const primaryIds = resources.filter((r) => r.type === RESOURCE_TYPES.STAFF).map((r) => r.id);
        if (this.state.staffFilters.length === 0) this.state.setStaffFilters(primaryIds);
    }

    /**
     * A payload whose collections are named something the field map does not look for
     * yields an empty calendar and no error at all. Naming both sides turns that into a
     * one-line diagnosis.
     */
    _warnIfNoResources(staticData, resources) {
        if (resources.length > 0) return;
        const present = Object.keys(staticData).filter((k) => Array.isArray(staticData[k]));
        if (present.length === 0) return;
        const looked = [
            ...candidateNames('dataset', 'resources', this.config.fieldMap),
            ...candidateNames('dataset', 'secondaryResources', this.config.fieldMap),
        ];
        console.warn(
            `[SteadyCalendar:CalendarApp] No resources resolved. Looked for ${looked.join(', ')}; ` +
            `the payload has ${present.join(', ')}. Set config.fieldMap.dataset to map them.`
        );
    }

    _storeBusinessHours(hours) {
        if (!Array.isArray(hours)) return;
        const dayNameToNumber = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
        const map = {};
        for (const h of hours) {
            const dayNum = typeof h.day_of_week === 'number' ? h.day_of_week : dayNameToNumber[h.day_of_week];
            if (dayNum === undefined) continue;
            const start = h.start_time ?? h.start;
            const end = h.end_time ?? h.end;
            if (!start || !end) continue;
            if (map[dayNum]) {
                if (start < map[dayNum].start) map[dayNum].start = start;
                if (end > map[dayNum].end) map[dayNum].end = end;
            } else {
                map[dayNum] = { start, end };
            }
        }
        this.state.setBusinessHours(map);
    }

    _wireCallbacks() {
        this.bus.on('event:click', ({ event }) => {
            if (!event?.sourceData) return;
            this.config.onEventClick?.(event);
            this.config.callbacks?.onEventClick?.(event);
        });
        const handleSlot = (data) => {
            const detail = {
                date: data.date,
                startTime: data.startTime ?? data.time,
                endTime: data.endTime ?? null,
                resourceId: data.resourceId ?? null
            };
            this._container?.dispatchEvent(new CustomEvent('sc:slot:select', { detail, bubbles: true }));
            this.config.onSlotSelect?.(detail);
            this.config.callbacks?.onSlotSelect?.(detail);
        };
        this.bus.on('slot:click', handleSlot);
        this.bus.on('slot:select', handleSlot);
        this.bus.on('dateHeader:click', ({ date }) => {
            this.config.onDateHeaderClick?.(date);
            this.config.callbacks?.onDateHeaderClick?.(date);
        });
        this.bus.on('cardSettings:click', () => {
            this.config.callbacks?.onCardSettingsClick?.();
        });
        this.bus.on('print:requested', () => {
            // The @media print rules in the stylesheet do the work; a host that needs
            // a custom print view overrides this.
            const onPrint = this.config.onPrint ?? this.config.callbacks?.onPrint;
            if (typeof onPrint === 'function') onPrint();
            else if (typeof window !== 'undefined') window.print();
        });
    }

    _setupResizeObserver(container) {
        if (typeof ResizeObserver === 'undefined') return;
        this._resizeObserver = new ResizeObserver(() => this.bus.emit('container:resized'));
        this._resizeObserver.observe(container);
    }

    getContainer() { return this._container; }

    destroy() {
        this._resizeObserver?.disconnect();
        // Reverse mount order, so handlers detach before the DOM they delegate over goes.
        for (const module of this._uiModules.reverse()) module.destroy();
        this._uiModules = [];
        this.eventRenderer?.destroy();
        this.viewManager?.destroy();
        this.toolbar?.destroy();
        this.privacyRenderer?.destroy();
        this.eventRenderer = this.viewManager = this.toolbar = this.privacyRenderer = null;
        this._container?.classList.remove('sc-calendar-container');
        this.pluginManager.destroy();
        this.dataBridge.destroy();
        this.preferencesBridge.destroy();
        this.bus.destroy();
    }
}
