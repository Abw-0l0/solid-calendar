/**
 * EventBus — Pub/sub for cross-module communication
 *
 * All calendar modules communicate through this bus instead of
 * direct coupling. Events are namespaced strings like 'date:changed'.
 */
export default class EventBus {
    constructor() {
        /** @type {Map<string, Set<Function>>} */
        this._listeners = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event
     * @param {Function} handler
     * @returns {Function} Unsubscribe function
     */
    on(event, handler) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(handler);
        return () => this.off(event, handler);
    }

    /**
     * Subscribe once
     * @param {string} event
     * @param {Function} handler
     * @returns {Function} Unsubscribe function
     */
    once(event, handler) {
        const wrapper = (data) => {
            this.off(event, wrapper);
            handler(data);
        };
        return this.on(event, wrapper);
    }

    /**
     * Unsubscribe
     * @param {string} event
     * @param {Function} handler
     */
    off(event, handler) {
        const handlers = this._listeners.get(event);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this._listeners.delete(event);
            }
        }
    }

    /**
     * Emit an event
     * @param {string} event
     * @param {*} [data]
     */
    emit(event, data) {
        const handlers = this._listeners.get(event);
        if (!handlers) return;
        // Snapshot before iterating. A Set visits entries added during iteration, and
        // handlers here routinely subscribe: ViewManager rebuilds its view inside a
        // date:changed handler, and the new CalendarGrid/NowIndicator/BusinessHoursOverlay
        // all subscribe to date:changed as they are constructed — so the just-built grid
        // would be told to rebuild again within the same emit. Snapshotting also makes
        // unsubscribing (destroy()) from inside a handler deterministic.
        for (const handler of [...handlers]) {
            try {
                handler(data);
            } catch (err) {
                console.error(`[SteadyCalendar:EventBus] Error in handler for '${event}':`, err);
            }
        }
    }

    /** Remove all listeners */
    destroy() {
        this._listeners.clear();
    }
}
