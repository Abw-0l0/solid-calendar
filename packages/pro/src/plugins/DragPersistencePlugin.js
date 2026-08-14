/**
 * DragPersistencePlugin — persists drag and resize gestures.
 *
 * Listens for `event:drop` and `event:resize`, writes the change through your handler,
 * and emits `data:refresh` on success. On failure, or on rejection by a guard, it calls
 * the `revert()` the calendar supplies to restore the element.
 *
 * @example
 * new DragPersistencePlugin({
 *   async onDrop(event, { date, startTime, resourceId }) {
 *     await fetch(`/api/bookings/${event.id}`, {
 *       method: 'PATCH',
 *       body: JSON.stringify({ date, start_time: startTime, assignee_id: resourceId }),
 *     });
 *   },
 * })
 */
export default class DragPersistencePlugin {
    /**
     * @param {object} [options]
     * @param {(event: object, changes: object) => Promise<void>|void} [options.onDrop]
     * @param {(event: object, changes: object) => Promise<void>|void} [options.onResize]
     * @param {(event: object, target: object) => boolean} [options.canDrop]
     * @param {(event: object, target: object) => boolean} [options.canResize]
     * @param {(error: unknown, event: object, revert: () => void) => void} [options.onError]
     * @param {string[]} [options.blockedStatuses] raw `sourceData.status` values that may
     *   not be moved or resized. Cancelled events are already blocked via the calendar's
     *   own `statusResolver`, so this is for additional states such as a completed job.
     */
    constructor(options = {}) {
        this.name = 'drag-persistence';
        this.options = options;
        this._unsubscribers = [];
        this._bus = null;
    }

    init(context) {
        this._bus = context.bus;
        this._unsubscribers.push(
            this._bus.on('event:drop', (data) => this._handleDrop(data)),
            this._bus.on('event:resize', (data) => this._handleResize(data)),
        );
    }

    /**
     * Cancelled is read from the normalised flag rather than a raw status string, so it
     * honours whatever `config.statusResolver` the host configured. Anything beyond that
     * is the host's vocabulary and belongs in `blockedStatuses`.
     */
    _isBlocked(event) {
        if (event?.isCancelled) return true;
        const blocked = this.options.blockedStatuses;
        if (!Array.isArray(blocked) || blocked.length === 0) return false;
        return blocked.includes(event?.sourceData?.status);
    }

    async _handleDrop(data) {
        const { event, newDate, newTime, newResourceId, oldResourceId, revert } = data;

        if (typeof this.options.canDrop === 'function'
            && !this.options.canDrop(event, { newDate, newTime, newResourceId, oldResourceId })) {
            revert?.();
            return;
        }

        if (this._isBlocked(event)) {
            revert?.();
            return;
        }

        if (typeof this.options.onDrop !== 'function') return;

        try {
            await this.options.onDrop(event, {
                date: newDate,
                startTime: newTime,
                resourceId: newResourceId,
                previousResourceId: oldResourceId,
            });
            this._bus.emit('data:refresh');
        } catch (err) {
            this._handleError(err, event, revert, 'Drop');
        }
    }

    async _handleResize(data) {
        const { event, newEndTime, revert } = data;

        if (typeof this.options.canResize === 'function'
            && !this.options.canResize(event, { newEndTime })) {
            revert?.();
            return;
        }

        // Symmetric with drop: a state that cannot be moved cannot be resized either.
        if (this._isBlocked(event)) {
            revert?.();
            return;
        }

        if (typeof this.options.onResize !== 'function') return;

        try {
            await this.options.onResize(event, { endTime: newEndTime });
            this._bus.emit('data:refresh');
        } catch (err) {
            this._handleError(err, event, revert, 'Resize');
        }
    }

    _handleError(err, event, revert, action) {
        console.error(`[SolidCalendar:DragPersistence] ${action} failed:`, err);
        if (typeof this.options.onError === 'function') {
            this.options.onError(err, event, revert);
            return;
        }
        revert?.();
    }

    destroy() {
        for (const unsub of this._unsubscribers) unsub();
        this._unsubscribers = [];
    }
}
