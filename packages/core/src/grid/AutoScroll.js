/**
 * AutoScroll — Scroll grid to 09:00 on load and view/date changes
 *
 * Mirrors the old FullCalendar `scrollTime: '09:00:00'` behavior.
 * Scrolls on init (after events:loaded) and again whenever the view,
 * date, or resource mode changes.
 */
import { SLOT_HEIGHT, SLOT_INTERVAL, DEFAULT_BUSINESS_HOURS } from '../core/CalendarConfig.js';
import { convertTimeToMinutes } from '../utils/temporal.js';

/** Always scroll to 09:00 */
const SCROLL_TIME = '09:00';

export default class AutoScroll {
    /**
     * @param {import('../core/CalendarState.js').default} state
     * @param {import('../core/EventBus.js').default} bus
     * @param {object} config
     */
    constructor(state, bus, config) {
        this.state = state;
        this.bus = bus;
        this.config = config;

        /** @type {HTMLElement|null} */
        this._gridEl = null;
        this._unsubs = [];
    }

    /**
     * Initialize auto-scroll on the grid element.
     * Scrolls immediately and subscribes to view/date/resource changes.
     * @param {HTMLElement} gridEl - The .sc-grid scroll container
     */
    init(gridEl) {
        this._gridEl = gridEl;

        // Scroll on first paint
        requestAnimationFrame(() => this._scrollToTarget());

        // Re-scroll whenever the view rebuilds
        this._unsubs.push(
            this.bus.on('view:changed', () => {
                requestAnimationFrame(() => this._scrollToTarget());
            }),
            this.bus.on('date:changed', () => {
                requestAnimationFrame(() => this._scrollToTarget());
            }),
            this.bus.on('resource:changed', () => {
                requestAnimationFrame(() => this._scrollToTarget());
            })
        );
    }

    /**
     * Scroll the grid so 09:00 is at the top edge
     */
    _scrollToTarget() {
        if (!this._gridEl) {
            return;
        }
        const topPx = this._timeToPixels(SCROLL_TIME);
        this._gridEl.scrollTo({ top: topPx, behavior: 'instant' });
    }

    /**
     * Convert a time string to pixel offset from grid top
     * @param {string} timeStr - HH:MM
     * @returns {number} pixels
     */
    _timeToPixels(timeStr) {
        const targetMinutes = convertTimeToMinutes(timeStr);
        const dayStartMinutes = convertTimeToMinutes(DEFAULT_BUSINESS_HOURS.start);
        const offset = Math.max(0, targetMinutes - dayStartMinutes);
        return (offset / SLOT_INTERVAL) * SLOT_HEIGHT;
    }

    /**
     * Cleanup subscriptions and refs
     */
    destroy() {
        for (const unsub of this._unsubs) {
            unsub();
        }
        this._unsubs = [];
        this._gridEl = null;
    }
}
