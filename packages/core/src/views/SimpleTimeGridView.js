/**
 * SimpleTimeGridView — Date-based time grid (day/3-day/week)
 *
 * Used for timeGridDay, timeGridThreeDay, timeGridWeek.
 * Creates a grid with date columns (one per date), no resource grouping.
 *
 * Composes: CalendarGrid + TimeSlotGenerator + DateColumnBuilder + NowIndicator
 */
import { DURATION_DAYS } from '../core/CalendarConfig.js';
import { addDaysToString } from '../utils/temporal.js';
import CalendarGrid from '../grid/CalendarGrid.js';
import NowIndicator from '../grid/NowIndicator.js';
import BusinessHoursOverlay from '../grid/BusinessHoursOverlay.js';
import AutoScroll from '../grid/AutoScroll.js';
import DateHeaderRenderer from '../rendering/DateHeaderRenderer.js';

export default class SimpleTimeGridView {
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

        /** @type {HTMLElement|null} */
        this._viewEl = null;
        /** @type {CalendarGrid|null} */
        this._grid = null;
        /** @type {NowIndicator|null} */
        this._nowIndicator = null;
        /** @type {BusinessHoursOverlay|null} */
        this._businessHoursOverlay = null;
        /** @type {AutoScroll|null} */
        this._autoScroll = null;
        /** @type {DateHeaderRenderer|null} */
        this._dateHeaderRenderer = null;

        this._unsubs = [];
    }

    /**
     * Build the simple time grid view inside the container
     * @param {HTMLElement} container
     */
    init(container) {
        this.container = container;

        this._viewEl = document.createElement('div');
        this._viewEl.className = 'sc-view sc-view--simple-time-grid';
        this.container.appendChild(this._viewEl);

        const duration = this.state.viewDuration;
        const dayCount = DURATION_DAYS[duration] ?? 1;

        const dates = this._getViewDates(dayCount);
        this._dateHeaderRenderer = new DateHeaderRenderer(this.state, this.bus, this.config);
        this._dateHeaderRenderer.init(this._viewEl, dates);

        this._grid = new CalendarGrid(this.state, this.bus, this.config);
        this._grid.init(this._viewEl);

        this._removeColumnHeaders();

        // Re-remove column headers after CalendarGrid rebuilds on events.
        // Registered after grid.init() so these fire after the grid's own listeners.
        this._unsubs.push(
            this.bus.on('date:changed', () => this._removeColumnHeaders()),
            this.bus.on('view:changed', () => this._removeColumnHeaders()),
            this.bus.on('resource:changed', () => this._removeColumnHeaders())
        );

        this._initOverlays();
    }

    /**
     * Remove duplicate column-internal headers from DateColumnBuilder.
     * DateHeaderRenderer already shows dates above the grid.
     */
    _removeColumnHeaders() {
        const cols = this._grid?.getColumnsContainer();
        cols?.querySelectorAll('.sc-column-header').forEach((h) => h.remove());

        const timeAxis = this._grid?.getGridElement()?.querySelector('.sc-time-axis');
        if (timeAxis) {
            timeAxis.style.paddingTop = '0';
        }
    }

    /**
     * Initialize now indicator and business hours overlay
     */
    _initOverlays() {
        const gridEl = this._grid?.getGridElement();
        if (!gridEl) {
            return;
        }

        this._nowIndicator = new NowIndicator(this.state, this.bus, this.config);
        this._nowIndicator.init(gridEl);

        this._autoScroll = new AutoScroll(this.state, this.bus, this.config);
        this._autoScroll.init(gridEl);

        const columnsContainer = this._grid?.getColumnsContainer();
        if (columnsContainer) {
            this._businessHoursOverlay = new BusinessHoursOverlay(this.state, this.bus, this.config);
            this._businessHoursOverlay.init(columnsContainer);
        }
    }

    /**
     * Generate date strings for the view range
     * @param {number} dayCount
     * @returns {string[]}
     */
    _getViewDates(dayCount) {
        const dates = [];
        for (let i = 0; i < dayCount; i++) {
            dates.push(addDaysToString(this.state.currentDate, i));
        }
        return dates;
    }

    /**
     * Get the grid instance (for EventRenderer positioning)
     * @returns {CalendarGrid|null}
     */
    getGrid() {
        return this._grid;
    }

    /**
     * Cleanup all composed modules and DOM
     */
    destroy() {
        for (const unsub of this._unsubs) {
            unsub();
        }
        this._unsubs = [];

        this._businessHoursOverlay?.destroy();
        this._businessHoursOverlay = null;

        this._nowIndicator?.destroy();
        this._nowIndicator = null;

        this._autoScroll?.destroy();
        this._autoScroll = null;

        this._dateHeaderRenderer?.destroy();
        this._dateHeaderRenderer = null;

        this._grid?.destroy();
        this._grid = null;

        if (this._viewEl) {
            this._viewEl.remove();
        }
        this._viewEl = null;
        this.container = null;
    }
}
