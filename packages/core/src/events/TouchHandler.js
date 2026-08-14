/**
 * TouchHandler — Translates touch events to equivalent mouse interactions
 *
 * Long-press (500ms) on event: delegates to DragHandler.
 * Tap on event: delegates to EventClickHandler.
 * Tap on empty slot: delegates to SelectionHandler.
 * Prevents default scroll during drag operations.
 */

/** Long-press threshold in milliseconds */
const LONG_PRESS_DELAY = 500;

/** Movement threshold to cancel long-press (pixels) */
const MOVE_THRESHOLD = 10;

export default class TouchHandler {
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

        this._longPressTimer = null;
        this._touchStartX = 0;
        this._touchStartY = 0;
        this._isLongPress = false;
        this._isDragging = false;
        this._targetElement = null;

        this._onTouchStart = this._onTouchStart.bind(this);
        this._onTouchMove = this._onTouchMove.bind(this);
        this._onTouchEnd = this._onTouchEnd.bind(this);
    }

    /**
     * Initialize — attach touch listeners on container
     * @param {HTMLElement} container
     */
    init(container) {
        this.container = container;
        this.container.addEventListener('touchstart', this._onTouchStart, { passive: false });
        this.container.addEventListener('touchmove', this._onTouchMove, { passive: false });
        this.container.addEventListener('touchend', this._onTouchEnd, { passive: true });
    }

    /**
     * Handle touchstart
     * @param {TouchEvent} e
     */
    _onTouchStart(e) {
        if (e.touches.length !== 1) {
            return;
        }

        const touch = e.touches[0];
        this._touchStartX = touch.clientX;
        this._touchStartY = touch.clientY;
        this._isLongPress = false;
        this._isDragging = false;
        this._targetElement = e.target;

        const eventEl = e.target.closest('.sc-event');

        if (eventEl) {
            // On event — start long-press timer for drag
            this._longPressTimer = setTimeout(() => {
                this._isLongPress = true;
                this._isDragging = true;

                // Synthesize mousedown on the event for DragHandler
                this._dispatchMouseEvent('mousedown', touch, eventEl);

                // Haptic feedback if available
                navigator.vibrate?.(50);
            }, LONG_PRESS_DELAY);
        }
    }

    /**
     * Handle touchmove
     * @param {TouchEvent} e
     */
    _onTouchMove(e) {
        if (e.touches.length !== 1) {
            this._cancelLongPress();
            return;
        }

        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - this._touchStartX);
        const dy = Math.abs(touch.clientY - this._touchStartY);

        // If moved too much before long-press, cancel it
        if (!this._isLongPress && (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD)) {
            this._cancelLongPress();
            return;
        }

        // If in drag mode, prevent scroll and synthesize mousemove
        if (this._isDragging) {
            e.preventDefault();
            this._dispatchMouseEvent('mousemove', touch, document);
        }
    }

    /**
     * Handle touchend
     * @param {TouchEvent} e
     */
    _onTouchEnd(e) {
        this._cancelLongPress();

        if (this._isDragging) {
            // End drag — synthesize mouseup
            const touch = e.changedTouches[0];
            this._dispatchMouseEvent('mouseup', touch, document);
            this._isDragging = false;
            return;
        }

        // Simple tap — synthesize click
        if (!this._isLongPress && this._targetElement) {
            const eventEl = this._targetElement.closest('.sc-event');
            if (eventEl) {
                // Tap on event
                this._dispatchMouseEvent('click', e.changedTouches[0], eventEl);
            } else {
                // Tap on empty area — let SelectionHandler handle it as a click
                const columnBody = this._targetElement.closest('.sc-column-body');
                if (columnBody) {
                    this._dispatchMouseEvent('mousedown', e.changedTouches[0], this._targetElement);
                    this._dispatchMouseEvent('mouseup', e.changedTouches[0], this._targetElement);
                }
            }
        }

        this._isLongPress = false;
        this._targetElement = null;
    }

    /**
     * Cancel the long-press timer
     */
    _cancelLongPress() {
        if (this._longPressTimer !== null) {
            clearTimeout(this._longPressTimer);
            this._longPressTimer = null;
        }
    }

    /**
     * Dispatch a synthetic mouse event from a touch
     * @param {string} type - 'mousedown', 'mousemove', 'mouseup', 'click'
     * @param {Touch} touch
     * @param {EventTarget} target
     */
    _dispatchMouseEvent(type, touch, target) {
        const mouseEvent = new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: touch.clientX,
            clientY: touch.clientY,
            screenX: touch.screenX,
            screenY: touch.screenY,
            button: 0
        });
        target.dispatchEvent(mouseEvent);
    }

    /**
     * Cleanup
     */
    destroy() {
        this._cancelLongPress();
        this.container?.removeEventListener('touchstart', this._onTouchStart);
        this.container?.removeEventListener('touchmove', this._onTouchMove);
        this.container?.removeEventListener('touchend', this._onTouchEnd);
        this._isDragging = false;
        this._isLongPress = false;
        this._targetElement = null;
        this.container = null;
    }
}
