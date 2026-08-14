/**
 * CalendarGrid — Main grid compositor
 *
 * Creates the .sc-grid flex container with a sticky time axis on the left
 * and scrollable columns on the right. Delegates column building to
 * ResourceColumnBuilder or DateColumnBuilder based on the current view.
 *
 * Listens to EventBus: date:changed, view:changed, resource:changed, resources:loaded.
 * Empty-slot gestures belong to SelectionHandler, which also reports drag ranges.
 */
import { SLOT_HEIGHT, SLOT_INTERVAL, DEFAULT_BUSINESS_HOURS, DURATION_DAYS, isFlatMode } from '../core/CalendarConfig.js';
import { convertTimeToMinutes, addDaysToString } from '../utils/temporal.js';
import TimeSlotGenerator from './TimeSlotGenerator.js';
import ResourceColumnBuilder from './ResourceColumnBuilder.js';
import DateColumnBuilder from './DateColumnBuilder.js';

export default class CalendarGrid {
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
        this._gridEl = null;
        /** @type {HTMLElement|null} */
        this._timeAxisEl = null;
        /** @type {HTMLElement|null} */
        this._columnsContainer = null;

        this._timeSlotGenerator = new TimeSlotGenerator(state, bus, config);
        this._resourceColumnBuilder = new ResourceColumnBuilder(state, bus, config);
        this._dateColumnBuilder = new DateColumnBuilder(state, bus, config);

        this._unsubs = [];
        this._handleScroll = this._onScroll.bind(this);
    }

    /**
     * Build the grid inside the given container
     * @param {HTMLElement} container
     */
    init(container) {
        this.container = container;

        this._buildStructure();
        this._renderGrid();
        this._attachListeners();
    }

    /**
     * Create the base grid DOM structure
     */
    _buildStructure() {
        if (this._gridEl) {
            this._gridEl.remove();
        }

        this._gridEl = document.createElement('div');
        this._gridEl.className = 'sc-grid';

        this._timeAxisEl = document.createElement('div');
        this._timeAxisEl.className = 'sc-time-axis';
        this._gridEl.appendChild(this._timeAxisEl);

        this._columnsContainer = document.createElement('div');
        this._columnsContainer.className = 'sc-columns-container';
        this._gridEl.appendChild(this._columnsContainer);

        this.container.appendChild(this._gridEl);
    }

    /**
     * Render time axis and columns based on current view
     */
    _renderGrid() {
        this._timeSlotGenerator.init(this._timeAxisEl);

        // Flat mode uses date-based columns rather than one column per resource.
        if (this.state.isResourceView && !isFlatMode(this.state.currentResourceMode)) {
            const dayCount = DURATION_DAYS[this.state.viewDuration] ?? 1;
            if (dayCount > 1) {
                const dates = this._getViewDates(dayCount);
                this._resourceColumnBuilder.initGrouped(this._columnsContainer, dates);
            } else {
                this._resourceColumnBuilder.init(this._columnsContainer);
            }
        } else {
            this._dateColumnBuilder.init(this._columnsContainer);
        }

        // Apply current staff filter to newly built columns
        if (this.state.isResourceView && !isFlatMode(this.state.currentResourceMode)) {
            this._resourceColumnBuilder.applyStaffFilter(this.state.staffFilters);
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
     * Attach EventBus listeners and DOM event listeners
     */
    _attachListeners() {
        this._unsubs.push(
            this.bus.on('date:changed', () => this._rebuild()),
            this.bus.on('view:changed', () => this._rebuild()),
            this.bus.on('resource:changed', () => this._rebuild()),
            // Columns come from state.resources, which is populated asynchronously.
            this.bus.on('resources:loaded', () => this._rebuild()),
            this.bus.on('filter:changed', ({ staffIds }) => this._applyStaffFilter(staffIds))
        );

        this._gridEl?.addEventListener('scroll', this._handleScroll, { passive: true });
    }

    /**
     * Apply staff filter to resource columns — hide/show columns
     * @param {string[]} staffIds
     */
    _applyStaffFilter(staffIds) {
        if (this.state.isResourceView && !isFlatMode(this.state.currentResourceMode)) {
            this._resourceColumnBuilder.applyStaffFilter(staffIds);
        }
    }

    /**
     * Tear down and rebuild the grid contents
     */
    _rebuild() {
        this._timeSlotGenerator.destroy();
        this._resourceColumnBuilder.destroy();
        this._dateColumnBuilder.destroy();
        this._renderGrid();
    }

    /**
     * Handle scroll — keep time axis sticky (CSS handles this, reserved for future use)
     */
    _onScroll() {
        // Sticky positioning handled by CSS; this hook exists for
        // future scroll-based features (e.g., lazy column rendering)
    }

    /**
     * Get the column element for a resource ID (resource view)
     * @param {string} resourceId
     * @returns {HTMLElement|null}
     */
    getColumnForResource(resourceId) {
        return this._resourceColumnBuilder.getColumnForResource(resourceId);
    }

    /**
     * Get the column body element for a resource ID
     * @param {string} resourceId
     * @returns {HTMLElement|null}
     */
    getColumnBodyForResource(resourceId) {
        return this._resourceColumnBuilder.getColumnBodyForResource(resourceId);
    }

    /**
     * Get the column element for a date (non-resource view)
     * @param {string} dateStr
     * @returns {HTMLElement|null}
     */
    getColumnForDate(dateStr) {
        return this._dateColumnBuilder.getColumnForDate(dateStr);
    }

    /**
     * Get the column body for a date
     * @param {string} dateStr
     * @returns {HTMLElement|null}
     */
    getColumnBodyForDate(dateStr) {
        return this._dateColumnBuilder.getColumnBodyForDate(dateStr);
    }

    /**
     * Calculate the top pixel position for a given time
     * @param {string} timeStr - 'HH:MM'
     * @returns {number}
     */
    getSlotForTime(timeStr) {
        const startMinutes = convertTimeToMinutes(DEFAULT_BUSINESS_HOURS.start);
        const timeMinutes = convertTimeToMinutes(timeStr);
        const offset = timeMinutes - startMinutes;
        return (offset / SLOT_INTERVAL) * SLOT_HEIGHT;
    }

    /**
     * Get the grid element
     * @returns {HTMLElement|null}
     */
    getGridElement() {
        return this._gridEl;
    }

    /**
     * Get the columns container
     * @returns {HTMLElement|null}
     */
    getColumnsContainer() {
        return this._columnsContainer;
    }

    /**
     * Get the TimeSlotGenerator instance
     * @returns {TimeSlotGenerator}
     */
    getTimeSlotGenerator() {
        return this._timeSlotGenerator;
    }

    /**
     * Cleanup all listeners and DOM
     */
    destroy() {
        for (const unsub of this._unsubs) {
            unsub();
        }
        this._unsubs = [];

        this._gridEl?.removeEventListener('scroll', this._handleScroll);

        this._timeSlotGenerator.destroy();
        this._resourceColumnBuilder.destroy();
        this._dateColumnBuilder.destroy();

        if (this._gridEl) {
            this._gridEl.remove();
        }

        this._gridEl = null;
        this._timeAxisEl = null;
        this._columnsContainer = null;
        this.container = null;
    }
}
