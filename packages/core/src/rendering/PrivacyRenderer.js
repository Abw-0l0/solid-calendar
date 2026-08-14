/**
 * PrivacyRenderer — Toggle privacy mode on the calendar
 *
 * Listens to privacy:changed on EventBus.
 * When enabled: adds sc-privacy class to the calendar container.
 * CSS handles the blur via .sc-privacy .sc-event-title { filter: blur(4px) }.
 */
export default class PrivacyRenderer {
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

        /** @type {Function[]} */
        this._unsubscribers = [];
    }

    /**
     * Initialize — attach to container and listen for privacy changes
     * @param {HTMLElement} container - the .sc-calendar-container element
     */
    init(container) {
        this.container = container;

        this._unsubscribers.push(this.bus.on('privacy:changed', ({ enabled }) => this._toggle(enabled)));

        // Apply initial state
        if (this.state.privacyMode) {
            this._toggle(true);
        }
    }

    /**
     * Toggle the privacy CSS class on the container
     * @param {boolean} enabled
     */
    _toggle(enabled) {
        if (!this.container) {
            return;
        }

        if (enabled) {
            this.container.classList.add('sc-privacy');
        } else {
            this.container.classList.remove('sc-privacy');
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        this.container?.classList.remove('sc-privacy');
        for (const unsub of this._unsubscribers) {
            unsub();
        }
        this._unsubscribers = [];
        this.container = null;
    }
}
