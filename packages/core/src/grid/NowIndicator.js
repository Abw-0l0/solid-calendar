/**
 * NowIndicator — Red horizontal line at the current time position
 *
 * Auto-updates every 60 seconds. Only visible when today is within
 * the current view's date range. Position is calculated from the
 * day start time and slot dimensions.
 */
import { SLOT_HEIGHT, SLOT_INTERVAL, DEFAULT_BUSINESS_HOURS, NOW_INDICATOR_INTERVAL } from '../core/CalendarConfig.js';
import { convertTimeToMinutes, getCurrentTime, getCurrentDate, isWithinRange } from '../utils/temporal.js';

export default class NowIndicator {
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
        this._indicatorEl = null;
        /** @type {number|null} */
        this._intervalId = null;
        this._unsubs = [];
    }

    /**
     * Initialize the now indicator inside the grid
     * @param {HTMLElement} container - The .sc-grid or .sc-columns-container element
     */
    init(container) {
        this.container = container;

        this._indicatorEl = document.createElement('div');
        this._indicatorEl.className = 'sc-now-indicator';
        this.container.appendChild(this._indicatorEl);

        this._updatePosition();
        this._startTimer();

        this._unsubs.push(
            this.bus.on('date:changed', () => this._updatePosition()),
            this.bus.on('view:changed', () => this._updatePosition())
        );
    }

    /**
     * Update the indicator's vertical position and visibility
     */
    _updatePosition() {
        if (!this._indicatorEl) {
            return;
        }

        const today = getCurrentDate();
        const { start, end } = this.state.dateRange;
        const isTodayVisible = isWithinRange(today, start, end);

        if (!isTodayVisible) {
            this._indicatorEl.style.display = 'none';
            return;
        }

        const currentTime = getCurrentTime();
        const currentMinutes = convertTimeToMinutes(currentTime);
        const dayStartMinutes = convertTimeToMinutes(DEFAULT_BUSINESS_HOURS.start);
        const dayEndMinutes = convertTimeToMinutes(DEFAULT_BUSINESS_HOURS.end);

        if (currentMinutes < dayStartMinutes || currentMinutes > dayEndMinutes) {
            this._indicatorEl.style.display = 'none';
            return;
        }

        const offset = currentMinutes - dayStartMinutes;
        const topPx = (offset / SLOT_INTERVAL) * SLOT_HEIGHT;

        this._indicatorEl.style.display = '';
        this._indicatorEl.style.top = `${topPx}px`;

        // Constrain to today's column in multi-day views
        this._updateHorizontalBounds(today);
    }

    /**
     * Constrain the indicator to today's column(s) in multi-day views.
     * In single-day views the indicator spans the full grid (default CSS).
     * @param {string} today - ISO date string (YYYY-MM-DD)
     */
    _updateHorizontalBounds(today) {
        if (!this.container) {
            return;
        }

        const todayCols = this.container.querySelectorAll(`[data-date="${today}"]`);
        if (todayCols.length === 0) {
            // No data-date columns (single-day view or no match) — use full width
            this._indicatorEl.style.left = '';
            this._indicatorEl.style.right = '';
            this._indicatorEl.style.width = '';
            return;
        }

        const containerRect = this.container.getBoundingClientRect();
        const firstCol = todayCols[0].getBoundingClientRect();
        const lastCol = todayCols[todayCols.length - 1].getBoundingClientRect();

        const left = firstCol.left - containerRect.left;
        const right = containerRect.right - lastCol.right;

        this._indicatorEl.style.left = `${left}px`;
        this._indicatorEl.style.right = `${right}px`;
        this._indicatorEl.style.width = '';
    }

    /**
     * Start the auto-update timer
     */
    _startTimer() {
        this._stopTimer();
        this._intervalId = setInterval(() => this._updatePosition(), NOW_INDICATOR_INTERVAL);
    }

    /**
     * Stop the auto-update timer
     */
    _stopTimer() {
        if (this._intervalId !== null) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
    }

    /**
     * Cleanup interval and DOM
     */
    destroy() {
        this._stopTimer();

        for (const unsub of this._unsubs) {
            unsub();
        }
        this._unsubs = [];

        if (this._indicatorEl) {
            this._indicatorEl.remove();
        }

        this._indicatorEl = null;
        this.container = null;
    }
}
