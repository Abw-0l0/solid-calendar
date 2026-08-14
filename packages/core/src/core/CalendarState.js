/**
 * CalendarState — Central reactive state
 *
 * Single source of truth for all calendar state. Changes emitted via EventBus.
 */
import { VIEW_TYPES, RESOURCE_MODES, DEFAULTS, DURATION_DAYS } from './CalendarConfig.js';
import { addDaysToString, getCurrentDate, getMonthRange } from '../utils/temporal.js';

export default class CalendarState {
    constructor(bus) {
        this._bus = bus;
        this._currentDate = getCurrentDate();
        this._currentView = DEFAULTS.view;
        this._currentResourceMode = DEFAULTS.resourceMode;
        this._resources = [];
        this._events = [];
        this._resourceFilters = [];
        this._privacyMode = DEFAULTS.privacyMode;
        this._isLoading = false;
        this._businessHours = {};
        this._businessOverrides = [];
        this._holidaySettings = null;
        this._publicHolidays = {};
        this._lastInteractionEndTime = 0;
        this._cardDisplaySettings = null;
        this._cachedDateRange = null;
    }

    get currentDate() { return this._currentDate; }
    get currentView() { return this._currentView; }
    get currentResourceMode() { return this._currentResourceMode; }
    get resources() { return this._resources; }
    get events() { return this._events; }
    /** Ids of the primary resources currently shown. Secondary resources are not filterable. */
    get resourceFilters() { return this._resourceFilters; }
    get privacyMode() { return this._privacyMode; }
    get isLoading() { return this._isLoading; }
    get businessHours() { return this._businessHours; }
    get businessOverrides() { return this._businessOverrides; }
    get holidaySettings() { return this._holidaySettings; }
    get publicHolidays() { return this._publicHolidays; }
    get lastInteractionEndTime() { return this._lastInteractionEndTime; }
    get cardDisplaySettings() { return this._cardDisplaySettings; }

    get viewDuration() {
        return VIEW_TYPES[this._currentView]?.duration ?? 'day';
    }

    get isResourceView() {
        return VIEW_TYPES[this._currentView]?.isResource ?? false;
    }

    get dateRange() {
        if (this._cachedDateRange) return this._cachedDateRange;
        const duration = this.viewDuration;
        let range;
        if (duration === 'month') {
            const [y, m] = this._currentDate.split('-').map(Number);
            const { start, end } = getMonthRange(y, m);
            range = { start, end };
        } else {
            const days = DURATION_DAYS[duration] ?? 1;
            range = { start: this._currentDate, end: addDaysToString(this._currentDate, days - 1) };
        }
        this._cachedDateRange = range;
        return range;
    }

    setCurrentDate(date) {
        if (this._currentDate === date) return;
        this._currentDate = date;
        this._cachedDateRange = null;
        this._bus.emit('date:changed', { date });
    }

    setCurrentView(view) {
        if (this._currentView === view) return;
        this._currentView = view;
        this._cachedDateRange = null;
        this._bus.emit('view:changed', { view, resourceMode: this._currentResourceMode });
    }

    setCurrentResourceMode(mode) {
        if (this._currentResourceMode === mode) return;
        this._currentResourceMode = mode;
        this._bus.emit('resource:changed', { mode });
    }

    setResources(resources) {
        this._resources = resources;
        this._bus.emit('resources:loaded', { resources });
    }

    setEvents(events) {
        this._events = events;
        this._bus.emit('events:loaded', { events });
    }

    /** @param {string[]} resourceIds ids of the primary resources to show */
    setResourceFilters(resourceIds) {
        this._resourceFilters = [...resourceIds];
        this._bus.emit('filter:changed', { resourceIds: this._resourceFilters });
    }

    setPrivacyMode(enabled) {
        if (this._privacyMode === enabled) return;
        this._privacyMode = enabled;
        this._bus.emit('privacy:changed', { enabled });
    }

    setLoading(loading) {
        if (this._isLoading === loading) return;
        this._isLoading = loading;
        this._bus.emit('loading:changed', { isLoading: loading });
    }

    setBusinessHours(hours) { this._businessHours = hours; }
    setBusinessOverrides(overrides) { this._businessOverrides = overrides; }
    setHolidaySettings(settings) { this._holidaySettings = settings; }
    setPublicHolidays(holidays) { this._publicHolidays = holidays; }
    setLastInteractionEndTime(timestamp) { this._lastInteractionEndTime = timestamp; }

    setCardDisplaySettings(settings) {
        this._cardDisplaySettings = settings;
        this._bus.emit('cardSettings:changed', { settings });
    }

    applyPreferences(prefs) {
        if (prefs.viewType && VIEW_TYPES[prefs.viewType]) this._currentView = prefs.viewType;
        if (prefs.date) this._currentDate = prefs.date;
        if (prefs.resourceFilters && Array.isArray(prefs.resourceFilters)) this._resourceFilters = [...prefs.resourceFilters];
        // Validated rather than assigned: an unknown mode would leave state in a
        // shape no module recognises.
        if (prefs.resourceMode && RESOURCE_MODES[prefs.resourceMode]) {
            this._currentResourceMode = prefs.resourceMode;
        }
        this._cachedDateRange = null;
        this._reconcileViewAndResource();
        this._bus.emit('view:changed', { view: this._currentView, resourceMode: this._currentResourceMode });
        this._bus.emit('resource:changed', { mode: this._currentResourceMode });
    }

    _reconcileViewAndResource() {
        const viewDef = VIEW_TYPES[this._currentView];
        if (!viewDef) return;
        const isFlat = this._currentResourceMode === 'flatView';
        if (isFlat === viewDef.isResource) {
            const viewMap = {
                timeGridDay: 'resourceTimeGridDay',
                timeGridThreeDay: 'resourceTimeGridThreeDay',
                timeGridWeek: 'resourceTimeGridWeek',
                resourceTimeGridDay: 'timeGridDay',
                resourceTimeGridThreeDay: 'timeGridThreeDay',
                resourceTimeGridWeek: 'timeGridWeek',
            };
            const corrected = viewMap[this._currentView];
            if (corrected && VIEW_TYPES[corrected]) this._currentView = corrected;
        }
    }

    toPreferences() {
        return {
            viewType: this._currentView,
            date: this._currentDate,
            resourceFilters: [...this._resourceFilters],
            resourceMode: this._currentResourceMode
        };
    }
}
