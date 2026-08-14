/**
 * DragHandler — Pointer-event based drag for calendar events
 *
 * Tracks mousedown → mousemove → mouseup on .sc-event elements.
 * Snaps event position to 10-minute grid slots during drag.
 * Supports column-to-column dragging for resource reassignment.
 * Emits event:drop on EventBus when drag completes.
 */
import { SLOT_HEIGHT, SLOT_INTERVAL, DEFAULT_BUSINESS_HOURS } from '../core/CalendarConfig.js';
import { convertTimeToMinutes, convertMinutesToTime, timeDiff } from '../utils/temporal.js';

/** Minimum pixels before drag is initiated (prevents accidental drags) */
const DRAG_THRESHOLD = 5;

export default class DragHandler {
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

        this._isDragging = false;
        this._dragStarted = false;
        this._startX = 0;
        this._startY = 0;
        this._offsetY = 0;
        this._dragEvent = null;
        this._dragElement = null;
        this._originalTop = 0;
        this._originalLeft = '';
        this._originalColumn = null;
        this._durationMinutes = 0;

        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
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
     * Handle mousedown on an event element
     * @param {MouseEvent} e
     */
    _onMouseDown(e) {
        // Only left mouse button
        if (e.button !== 0) {
            return;
        }

        // Don't drag from resize handle
        if (e.target.closest('.sc-event-resize-handle')) {
            return;
        }

        const eventEl = e.target.closest('.sc-event');
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

        // Don't allow dragging cancelled events
        if (event.isCancelled) {
            return;
        }

        e.preventDefault();

        this._isDragging = true;
        this._dragStarted = false;
        this._startX = e.clientX;
        this._startY = e.clientY;
        this._dragEvent = event;
        this._dragElement = eventEl;
        this._originalTop = parseFloat(eventEl.style.top) || 0;
        this._originalLeft = eventEl.style.left;
        this._originalColumn = eventEl.closest('.sc-column');
        this._durationMinutes = timeDiff(event.startTime, event.endTime);

        // Offset within the event element where the user clicked
        const rect = eventEl.getBoundingClientRect();
        this._offsetY = e.clientY - rect.top;

        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mouseup', this._onMouseUp);
        document.addEventListener('keydown', this._onKeyDown);
    }

    /**
     * Handle mousemove during drag
     * @param {MouseEvent} e
     */
    _onMouseMove(e) {
        if (!this._isDragging) {
            return;
        }

        const dx = e.clientX - this._startX;
        const dy = e.clientY - this._startY;

        // Check threshold before starting visual drag
        if (!this._dragStarted) {
            if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
                return;
            }
            this._dragStarted = true;
            this._dragElement.classList.add('sc-event--dragging');
        }

        // Calculate new position snapped to grid
        const columnBody = this._findColumnBodyAtPoint(e.clientX, e.clientY);
        if (columnBody) {
            const bodyRect = columnBody.getBoundingClientRect();
            const relativeY = e.clientY - bodyRect.top - this._offsetY;

            // Snap to slot grid
            const slotIndex = Math.round(relativeY / SLOT_HEIGHT);
            const snappedTop = Math.max(0, slotIndex * SLOT_HEIGHT);

            this._dragElement.style.top = `${snappedTop}px`;

            // If hovered over a different column, move the element
            const currentColumn = this._dragElement.closest('.sc-column-body');
            if (currentColumn !== columnBody) {
                columnBody.appendChild(this._dragElement);
            }
        }
    }

    /**
     * Handle mouseup to complete or cancel drag
     * @param {MouseEvent} e
     */
    _onMouseUp(_e) {
        this._removeDocumentListeners();

        if (!this._isDragging || !this._dragStarted) {
            this._reset();
            return;
        }

        this._dragElement.classList.remove('sc-event--dragging');
        this.state.setLastInteractionEndTime(Date.now());

        // Calculate new time and resource from final position
        const columnBody = this._dragElement.closest('.sc-column-body');
        const column = columnBody?.closest('.sc-column');

        if (!columnBody || !column) {
            this._revert();
            return;
        }

        const newResourceId = column.dataset.resourceId ?? null;
        const newDate = column.dataset.date ?? this._dragEvent.date;
        const newTime = this._calculateTimeFromTop(parseFloat(this._dragElement.style.top) || 0);

        // Only emit if something actually changed
        const hasChanged = newTime !== this._dragEvent.startTime || newResourceId !== this._dragEvent.resourceId || newDate !== this._dragEvent.date;

        if (hasChanged) {
            // Capture references before _reset() nulls them (revert runs async)
            const dragEvent = this._dragEvent;
            const dragElement = this._dragElement;
            const originalTop = this._originalTop;
            const originalLeft = this._originalLeft;
            const originalColumn = this._originalColumn;

            const revert = () => {
                if (!dragElement) return;
                dragElement.classList.remove('sc-event--dragging');
                dragElement.style.top = `${originalTop}px`;
                dragElement.style.left = originalLeft;
                const originalBody = originalColumn?.querySelector('.sc-column-body');
                if (originalBody && dragElement.closest('.sc-column-body') !== originalBody) {
                    originalBody.appendChild(dragElement);
                }
            };

            const oldResourceId = dragEvent.resourceId ?? null;

            this._reset();
            this.bus.emit('event:drop', {
                event: dragEvent,
                newDate,
                newTime,
                newResourceId,
                oldResourceId,
                revert
            });
        } else {
            this._revert();
            this._reset();
        }
    }

    /**
     * Cancel drag on Escape key
     * @param {KeyboardEvent} e
     */
    _onKeyDown(e) {
        if (e.key === 'Escape' && this._isDragging) {
            this._removeDocumentListeners();
            this._revert();
            this._reset();
        }
    }

    /**
     * Find the .sc-column-body element at a given screen coordinate.
     * Uses document.elementFromPoint (browser's spatial index) instead of
     * iterating all columns and calling getBoundingClientRect on each.
     * The dragged element is temporarily hidden so elementFromPoint
     * hits the column underneath.
     * @param {number} x
     * @param {number} y
     * @returns {HTMLElement|null}
     */
    _findColumnBodyAtPoint(x, y) {
        if (!this.container) {
            return null;
        }

        // Temporarily hide the dragged element so it doesn't block hit-testing
        if (this._dragElement) {
            this._dragElement.style.pointerEvents = 'none';
        }
        const el = document.elementFromPoint(x, y);
        if (this._dragElement) {
            this._dragElement.style.pointerEvents = '';
        }

        if (!el) {
            return null;
        }

        // Walk up to find .sc-column-body within our container
        const columnBody = el.closest('.sc-column-body');
        if (columnBody && this.container.contains(columnBody)) {
            return columnBody;
        }
        return null;
    }

    /**
     * Calculate time string from a pixel top position
     * @param {number} top - pixels from top of column body
     * @returns {string} 'HH:MM'
     */
    _calculateTimeFromTop(top) {
        const dayStartMinutes = convertTimeToMinutes(DEFAULT_BUSINESS_HOURS.start);
        const slotIndex = Math.round(top / SLOT_HEIGHT);
        const minutes = dayStartMinutes + slotIndex * SLOT_INTERVAL;
        return convertMinutesToTime(minutes);
    }

    /**
     * Revert the event element to its original position and column
     */
    _revert() {
        if (!this._dragElement) {
            return;
        }

        this._dragElement.classList.remove('sc-event--dragging');
        this._dragElement.style.top = `${this._originalTop}px`;
        this._dragElement.style.left = this._originalLeft;

        // Move back to original column if needed
        const originalBody = this._originalColumn?.querySelector('.sc-column-body');
        if (originalBody && this._dragElement.closest('.sc-column-body') !== originalBody) {
            originalBody.appendChild(this._dragElement);
        }
    }

    /**
     * Reset drag state
     */
    _reset() {
        this._isDragging = false;
        this._dragStarted = false;
        this._dragEvent = null;
        this._dragElement = null;
        this._originalColumn = null;
    }

    /**
     * Remove document-level listeners
     */
    _removeDocumentListeners() {
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('keydown', this._onKeyDown);
    }

    /**
     * Cleanup
     */
    destroy() {
        this._removeDocumentListeners();
        this.container?.removeEventListener('mousedown', this._onMouseDown);
        this._reset();
        this.container = null;
    }
}
