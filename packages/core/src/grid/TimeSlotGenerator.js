/**
 * TimeSlotGenerator — Generates time slot DOM rows for the grid time axis
 *
 * Creates the vertical time axis with 30-minute labels and 10-minute
 * interval slots. Each slot has a data-time attribute for positioning.
 */
import { SLOT_HEIGHT, SLOT_INTERVAL, LABEL_INTERVAL, DEFAULT_BUSINESS_HOURS } from '../core/CalendarConfig.js';
import { convertTimeToMinutes, convertMinutesToTime } from '../utils/temporal.js';

export default class TimeSlotGenerator {
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
    }

    /**
     * Build time axis DOM inside the given container
     * @param {HTMLElement} container - The .sc-time-axis element
     * @param {{ start: string, end: string }} [hours] - Business hours override
     */
    init(container, hours) {
        this.container = container;
        this._render(hours);
    }

    /**
     * @param {{ start: string, end: string }} [hours]
     */
    _render(hours) {
        if (!this.container) {
            return;
        }

        this.container.textContent = '';

        const businessHours = hours ?? DEFAULT_BUSINESS_HOURS;
        const startMinutes = convertTimeToMinutes(businessHours.start);
        const endMinutes = convertTimeToMinutes(businessHours.end);

        for (let minutes = startMinutes; minutes < endMinutes; minutes += SLOT_INTERVAL) {
            const timeStr = convertMinutesToTime(minutes);
            const isLabelSlot = minutes % LABEL_INTERVAL === 0;

            if (isLabelSlot) {
                const label = this._createLabel(timeStr, minutes);
                this.container.appendChild(label);
            }

            const slot = this._createSlot(timeStr, isLabelSlot);
            this.container.appendChild(slot);
        }
    }

    /**
     * Create a 30-minute time label element
     * @param {string} timeStr - 'HH:MM'
     * @param {number} minutes
     * @returns {HTMLElement}
     */
    _createLabel(timeStr, minutes) {
        const label = document.createElement('div');
        label.className = 'sc-time-label';
        label.dataset.time = timeStr;

        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const hStr = String(hours).padStart(2, '0');
        const mStr = String(mins).padStart(2, '0');
        label.textContent = `${hStr}:${mStr}`;

        return label;
    }

    /**
     * Create a single 10-minute timeslot element
     * @param {string} timeStr - 'HH:MM'
     * @param {boolean} isLabelSlot - Whether this slot aligns with a label
     * @returns {HTMLElement}
     */
    _createSlot(timeStr, isLabelSlot) {
        const slot = document.createElement('div');
        const base = '';
        const minor = isLabelSlot ? '' : '';
        slot.className = isLabelSlot ? `sc-timeslot sc-timeslot--label ${base}` : `sc-timeslot ${base}${minor}`;
        slot.dataset.time = timeStr;
        return slot;
    }

    /**
     * Get total number of slots
     * @param {{ start: string, end: string }} [hours]
     * @returns {number}
     */
    getSlotCount(hours) {
        const businessHours = hours ?? DEFAULT_BUSINESS_HOURS;
        const startMinutes = convertTimeToMinutes(businessHours.start);
        const endMinutes = convertTimeToMinutes(businessHours.end);
        return Math.ceil((endMinutes - startMinutes) / SLOT_INTERVAL);
    }

    /**
     * Get total height of the time axis in pixels
     * @param {{ start: string, end: string }} [hours]
     * @returns {number}
     */
    getTotalHeight(hours) {
        return this.getSlotCount(hours) * SLOT_HEIGHT;
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.container) {
            this.container.textContent = '';
        }
        this.container = null;
    }
}
