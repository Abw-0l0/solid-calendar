/**
 * ResizeHandler — Resize events from the bottom edge
 *
 * Tracks mousedown on .sc-event-resize-handle elements, adjusts
 * event height on mousemove (snapped to 10-minute intervals),
 * and emits event:resize on mouseup with the new end time.
 */
import { SLOT_HEIGHT, SLOT_INTERVAL, DEFAULT_BUSINESS_HOURS } from '../core/CalendarConfig.js';
import { convertTimeToMinutes, convertMinutesToTime } from '../utils/temporal.js';

/** Minimum duration in slots (1 slot = 10 minutes) */
const MIN_SLOTS = 1;

export default class ResizeHandler {
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

        this._isResizing = false;
        this._resizeEvent = null;
        this._resizeElement = null;
        this._originalHeight = 0;
        this._startY = 0;

        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
    }

    /**
     * Initialize — attach mousedown delegation on container
     * @param {HTMLElement} container
     */
    init(container) {
        this.container = container;
        this.container.addEventListener('mousedown', this._onMouseDown);
    }

    /**
     * Handle mousedown on a resize handle
     * @param {MouseEvent} e
     */
    _onMouseDown(e) {
        if (e.button !== 0) {
            return;
        }

        const handle = e.target.closest('.sc-event-resize-handle');
        if (!handle) {
            return;
        }

        const eventEl = handle.closest('.sc-event');
        if (!eventEl) {
            return;
        }

        const eventId = eventEl.dataset.eventId;
        if (!eventId) {
            return;
        }

        const event = this.state.events.find((ev) => String(ev.id) === String(eventId));
        if (!event) {
            return;
        }

        if (event.isCancelled) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        this._isResizing = true;
        this._resizeEvent = event;
        this._resizeElement = eventEl;
        this._originalHeight = parseFloat(eventEl.style.height) || 0;
        this._startY = e.clientY;

        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mouseup', this._onMouseUp);
    }

    /**
     * Handle mousemove during resize
     * @param {MouseEvent} e
     */
    _onMouseMove(e) {
        if (!this._isResizing || !this._resizeElement) {
            return;
        }

        const dy = e.clientY - this._startY;
        const newHeight = this._originalHeight + dy;

        // Snap to slot grid
        const slots = Math.max(MIN_SLOTS, Math.round(newHeight / SLOT_HEIGHT));
        const snappedHeight = slots * SLOT_HEIGHT;

        this._resizeElement.style.height = `${snappedHeight}px`;
    }

    /**
     * Handle mouseup to complete resize
     * @param {MouseEvent} e
     */
    _onMouseUp(_e) {
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup', this._onMouseUp);

        if (!this._isResizing || !this._resizeElement || !this._resizeEvent) {
            this._reset();
            return;
        }

        this.state.setLastInteractionEndTime(Date.now());

        const finalHeight = parseFloat(this._resizeElement.style.height) || this._originalHeight;
        const slots = Math.max(MIN_SLOTS, Math.round(finalHeight / SLOT_HEIGHT));
        const startMinutes = convertTimeToMinutes(this._resizeEvent.startTime);
        const newEndMinutes = startMinutes + slots * SLOT_INTERVAL;

        // Clamp to business hours end
        const businessEndMinutes = convertTimeToMinutes(DEFAULT_BUSINESS_HOURS.end);
        const clampedEndMinutes = Math.min(newEndMinutes, businessEndMinutes);
        const newEndTime = convertMinutesToTime(clampedEndMinutes);

        // Only emit if end time changed
        if (newEndTime !== this._resizeEvent.endTime) {
            // Capture references before _reset() nulls them (revert runs async)
            const resizeEvent = this._resizeEvent;
            const resizeElement = this._resizeElement;
            const originalHeight = this._originalHeight;

            const revert = () => {
                if (resizeElement) {
                    resizeElement.style.height = `${originalHeight}px`;
                }
            };

            this._reset();
            this.bus.emit('event:resize', {
                event: resizeEvent,
                newEndTime,
                revert
            });
        } else {
            this._revert();
            this._reset();
        }
    }

    /**
     * Revert the element to its original height
     */
    _revert() {
        if (this._resizeElement) {
            this._resizeElement.style.height = `${this._originalHeight}px`;
        }
    }

    /**
     * Reset resize state
     */
    _reset() {
        this._isResizing = false;
        this._resizeEvent = null;
        this._resizeElement = null;
    }

    /**
     * Cleanup
     */
    destroy() {
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup', this._onMouseUp);
        this.container?.removeEventListener('mousedown', this._onMouseDown);
        this._reset();
        this.container = null;
    }
}
