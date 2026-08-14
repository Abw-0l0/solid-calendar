/**
 * EventClickHandler — Click delegation for calendar events
 *
 * Attaches a single click listener on the grid container using
 * event delegation. Finds the clicked .sc-event via closest(),
 * resolves the InternalEvent, and emits event:click on EventBus.
 */
export default class EventClickHandler {
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

        this._onClick = this._onClick.bind(this);
    }

    /**
     * Initialize — attach click delegation on container
     * @param {HTMLElement} container - the .sc-calendar-container or .sc-grid element
     */
    init(container) {
        this.container = container;
        this.container.addEventListener('click', this._onClick);
    }

    /**
     * Handle delegated click events
     * @param {MouseEvent} e
     */
    _onClick(e) {
        // Ignore clicks on resize handles (those are for ResizeHandler)
        if (e.target.closest('.sc-event-resize-handle')) {
            return;
        }

        // Suppress click that immediately follows a drag or resize
        if (Date.now() - this.state.lastInteractionEndTime < 300) {
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

        const event = this._findEvent(eventId);
        if (!event) {
            return;
        }

        // Prevent click from propagating to slot:click handlers
        e.stopPropagation();

        this.bus.emit('event:click', { event, element: eventEl });
    }

    /**
     * Find an InternalEvent by ID from current state
     * @param {string} eventId
     * @returns {object|null} InternalEvent
     */
    _findEvent(eventId) {
        return this.state.events.find((ev) => String(ev.id) === String(eventId)) ?? null;
    }

    /**
     * Cleanup
     */
    destroy() {
        this.container?.removeEventListener('click', this._onClick);
        this.container = null;
    }
}
