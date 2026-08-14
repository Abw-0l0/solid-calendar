/**
 * SelectionHandler — Click/drag on empty slots for new event creation
 *
 * Click on an empty slot: emits slot:click with { date, time, resourceId }.
 * Drag on empty slots: creates a visual selection mirror and emits
 * slot:select with { date, startTime, endTime, resourceId } on drag end.
 * All times snap to 10-minute intervals.
 */
import { SLOT_HEIGHT, SLOT_INTERVAL, DEFAULT_BUSINESS_HOURS } from '../core/CalendarConfig.js';
import { convertTimeToMinutes, convertMinutesToTime } from '../utils/temporal.js';

export default class SelectionHandler {
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

        this._isSelecting = false;
        this._selectionStarted = false;
        this._startY = 0;
        this._startSlotIndex = 0;
        this._targetColumnBody = null;
        this._targetColumn = null;
        this._mirror = null;

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
     * Handle mousedown on an empty slot area
     * @param {MouseEvent} e
     */
    _onMouseDown(e) {
        if (e.button !== 0) {
            return;
        }

        // Don't handle if clicking on an event or resize handle
        if (e.target.closest('.sc-event')) {
            return;
        }
        if (e.target.closest('.sc-event-resize-handle')) {
            return;
        }

        const columnBody = e.target.closest('.sc-column-body');
        if (!columnBody) {
            return;
        }

        const column = columnBody.closest('.sc-column');
        if (!column) {
            return;
        }

        e.preventDefault();

        const bodyRect = columnBody.getBoundingClientRect();
        const relativeY = e.clientY - bodyRect.top;
        const slotIndex = Math.floor(relativeY / SLOT_HEIGHT);

        this._isSelecting = true;
        this._selectionStarted = false;
        this._startY = e.clientY;
        this._startSlotIndex = slotIndex;
        this._targetColumnBody = columnBody;
        this._targetColumn = column;

        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mouseup', this._onMouseUp);
    }

    /**
     * Handle mousemove to create/update selection mirror
     * @param {MouseEvent} e
     */
    _onMouseMove(e) {
        if (!this._isSelecting) {
            return;
        }

        const dy = Math.abs(e.clientY - this._startY);

        // Start drag selection after a small threshold
        if (!this._selectionStarted && dy > SLOT_HEIGHT / 2) {
            this._selectionStarted = true;
            this._createMirror();
        }

        if (this._selectionStarted && this._mirror && this._targetColumnBody) {
            const bodyRect = this._targetColumnBody.getBoundingClientRect();
            const relativeY = e.clientY - bodyRect.top;
            const currentSlotIndex = Math.floor(relativeY / SLOT_HEIGHT);

            const topSlot = Math.min(this._startSlotIndex, currentSlotIndex);
            const bottomSlot = Math.max(this._startSlotIndex, currentSlotIndex) + 1;

            this._mirror.style.top = `${topSlot * SLOT_HEIGHT}px`;
            this._mirror.style.height = `${(bottomSlot - topSlot) * SLOT_HEIGHT}px`;
        }
    }

    /**
     * Handle mouseup to complete selection or emit click
     * @param {MouseEvent} e
     */
    _onMouseUp(e) {
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup', this._onMouseUp);

        if (!this._isSelecting) {
            this._reset();
            return;
        }

        const column = this._targetColumn;
        const resourceId = column?.dataset.resourceId ?? null;
        const date = column?.dataset.date ?? this.state.currentDate;

        if (this._selectionStarted && this._targetColumnBody) {
            // Drag selection — calculate time range
            const bodyRect = this._targetColumnBody.getBoundingClientRect();
            const relativeY = e.clientY - bodyRect.top;
            const endSlotIndex = Math.floor(relativeY / SLOT_HEIGHT);

            const topSlot = Math.min(this._startSlotIndex, endSlotIndex);
            const bottomSlot = Math.max(this._startSlotIndex, endSlotIndex) + 1;

            const startTime = this._slotToTime(topSlot);
            const endTime = this._slotToTime(bottomSlot);

            this.bus.emit('slot:select', { date, startTime, endTime, resourceId });
        } else {
            // Simple click on empty slot
            const time = this._slotToTime(this._startSlotIndex);
            this.bus.emit('slot:click', { date, time, resourceId });
        }

        this._removeMirror();
        this._reset();
    }

    /**
     * Convert a slot index to a time string
     * @param {number} slotIndex
     * @returns {string} 'HH:MM'
     */
    _slotToTime(slotIndex) {
        const dayStartMinutes = convertTimeToMinutes(DEFAULT_BUSINESS_HOURS.start);
        const minutes = dayStartMinutes + slotIndex * SLOT_INTERVAL;
        return convertMinutesToTime(minutes);
    }

    /**
     * Create the selection mirror element
     */
    _createMirror() {
        if (this._mirror || !this._targetColumnBody) {
            return;
        }

        this._mirror = document.createElement('div');
        this._mirror.className = 'sc-selection-mirror';
        this._mirror.style.position = 'absolute';
        this._mirror.style.left = '0';
        this._mirror.style.right = '0';
        this._mirror.style.top = `${this._startSlotIndex * SLOT_HEIGHT}px`;
        this._mirror.style.height = `${SLOT_HEIGHT}px`;

        this._targetColumnBody.appendChild(this._mirror);
    }

    /**
     * Remove the selection mirror element
     */
    _removeMirror() {
        this._mirror?.remove();
        this._mirror = null;
    }

    /**
     * Reset selection state
     */
    _reset() {
        this._isSelecting = false;
        this._selectionStarted = false;
        this._targetColumnBody = null;
        this._targetColumn = null;
    }

    /**
     * Cleanup
     */
    destroy() {
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup', this._onMouseUp);
        this.container?.removeEventListener('mousedown', this._onMouseDown);
        this._removeMirror();
        this._reset();
        this.container = null;
    }
}
