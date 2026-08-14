/**
 * ViewManager — Central view switching controller
 *
 * Listens to view:changed on EventBus, manages lifecycle of views
 * (destroy current → create new → init), and formats toolbar title
 * based on current view/date.
 */
import { getLocale } from '../utils/temporal.js';
import { formatViewTitle } from './formatTitle.js';
import ResourceTimeGridView from './ResourceTimeGridView.js';
import SimpleTimeGridView from './SimpleTimeGridView.js';
import MonthView from './MonthView.js';
import ListView from './ListView.js';

/** @type {Record<string, typeof ResourceTimeGridView | typeof SimpleTimeGridView | typeof MonthView | typeof ListView>} */
const VIEW_REGISTRY = {
    resourceTimeGridDay: ResourceTimeGridView,
    resourceTimeGridThreeDay: ResourceTimeGridView,
    resourceTimeGridWeek: ResourceTimeGridView,
    timeGridDay: SimpleTimeGridView,
    timeGridThreeDay: SimpleTimeGridView,
    timeGridWeek: SimpleTimeGridView,
    dayGridMonth: MonthView,
    list: ListView
};

export default class ViewManager {
    /**
     * @param {import('../core/CalendarState.js').default} state
     * @param {import('../core/EventBus.js').default} bus
     * @param {object} config
     */
    constructor(state, bus, config) {
        this.state = state;
        this.bus = bus;
        this.config = config;
        this.container = null;

        /** @type {ResourceTimeGridView|SimpleTimeGridView|MonthView|ListView|null} */
        this._currentView = null;
        this._unsubs = [];
    }

    /**
     * Initialize the view manager and render the initial view
     * @param {HTMLElement} container
     */
    init(container) {
        this.container = container;

        this._unsubs.push(
            this.bus.on('view:changed', () => this._switchView()),
            this.bus.on('date:changed', () => this._onDateChanged()),
            this.bus.on('dateHeader:click', ({ date }) => this._onDateHeaderClick(date))
        );

        this._switchView();
    }

    /**
     * Destroy current view, create new view, update title
     */
    _switchView() {
        if (this._currentView) {
            this._currentView.destroy();
            this._currentView = null;
        }

        const viewType = this.state.currentView;
        const ViewConstructor = VIEW_REGISTRY[viewType];

        if (!ViewConstructor) {
            console.error(`[SolidCalendar:ViewManager] Unknown view type: ${viewType}`);
            return;
        }

        this._currentView = new ViewConstructor(this.state, this.bus, this.config);
        this._currentView.init(this.container);

        this._emitTitle();
    }

    /**
     * When date changes, re-render current view and update title
     */
    _onDateChanged() {
        if (this._currentView) {
            this._currentView.destroy();
            this._currentView.init(this.container);
        }
        this._emitTitle();
    }

    /**
     * When a date header is clicked, switch to day view for that date
     * @param {string} date - 'YYYY-MM-DD'
     */
    _onDateHeaderClick(date) {
        this.state.setCurrentDate(date);
        this.state.setCurrentView(this.state.isResourceView ? 'resourceTimeGridDay' : 'timeGridDay');
    }

    /**
     * Format and emit the toolbar title string
     */
    _emitTitle() {
        const title = this._formatTitle();
        this.bus.emit('title:updated', { title });
    }

    /**
     * @returns {string}
     */
    _formatTitle() {
        return formatViewTitle(
            this.state.currentDate,
            this.state.viewDuration,
            getLocale(this.config.locale),
        );
    }

    /**
     * Get the current active view instance
     * @returns {ResourceTimeGridView|SimpleTimeGridView|MonthView|ListView|null}
     */
    getCurrentView() {
        return this._currentView;
    }

    /**
     * Cleanup all listeners and destroy current view
     */
    destroy() {
        for (const unsub of this._unsubs) {
            unsub();
        }
        this._unsubs = [];

        if (this._currentView) {
            this._currentView.destroy();
            this._currentView = null;
        }

        this.container = null;
    }
}
