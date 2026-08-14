import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DragPersistencePlugin from './DragPersistencePlugin.js';

/** Minimal stand-in for the calendar's EventBus. */
function makeBus() {
    const handlers = new Map();
    return {
        emitted: [],
        on(name, fn) {
            if (!handlers.has(name)) handlers.set(name, new Set());
            handlers.get(name).add(fn);
            return () => handlers.get(name).delete(fn);
        },
        emit(name, data) {
            this.emitted.push(name);
            return Promise.all([...(handlers.get(name) ?? [])].map((fn) => fn(data)));
        },
        count(name) {
            return handlers.get(name)?.size ?? 0;
        },
    };
}

const anEvent = (over = {}) => ({
    id: 'b1',
    isCancelled: false,
    sourceData: { status: 'Active' },
    ...over,
});

function drop(bus, { event = anEvent(), revert = vi.fn() } = {}) {
    const promise = bus.emit('event:drop', {
        event, newDate: '2026-08-12', newTime: '10:00',
        newResourceId: 'a2', oldResourceId: 'a1', revert,
    });
    return { promise, revert };
}

function resize(bus, { event = anEvent(), revert = vi.fn() } = {}) {
    const promise = bus.emit('event:resize', { event, newEndTime: '11:00', revert });
    return { promise, revert };
}

describe('DragPersistencePlugin', () => {
    let bus;
    let errorSpy;

    beforeEach(() => {
        bus = makeBus();
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => { errorSpy.mockRestore(); });

    const mount = (options) => {
        const plugin = new DragPersistencePlugin(options);
        plugin.init({ bus, state: {}, config: {} });
        return plugin;
    };

    describe('drop', () => {
        it('should_pass_the_change_to_the_handler', async () => {
            const onDrop = vi.fn();
            mount({ onDrop });
            const { promise } = drop(bus);
            await promise;

            expect(onDrop).toHaveBeenCalledTimes(1);
            expect(onDrop.mock.calls[0][1]).toEqual({
                date: '2026-08-12', startTime: '10:00',
                resourceId: 'a2', previousResourceId: 'a1',
            });
        });

        it('should_refresh_the_calendar_after_a_successful_write', async () => {
            mount({ onDrop: async () => {} });
            await drop(bus).promise;
            expect(bus.emitted).toContain('data:refresh');
        });

        it('should_revert_and_not_refresh_when_the_write_fails', async () => {
            const { promise, revert } = (() => {
                mount({ onDrop: async () => { throw new Error('500'); } });
                return drop(bus);
            })();
            await promise;

            expect(revert).toHaveBeenCalledTimes(1);
            expect(bus.emitted).not.toContain('data:refresh');
            expect(errorSpy).toHaveBeenCalled();
        });

        it('should_hand_the_failure_to_onError_instead_of_reverting', async () => {
            const onError = vi.fn();
            mount({ onDrop: async () => { throw new Error('500'); }, onError });
            const { promise, revert } = drop(bus);
            await promise;

            expect(onError).toHaveBeenCalledTimes(1);
            // onError owns the decision: revert is passed to it, not called for it.
            expect(revert).not.toHaveBeenCalled();
            expect(onError.mock.calls[0][2]).toBe(revert);
        });

        it('should_revert_when_canDrop_rejects_and_never_call_the_handler', async () => {
            const onDrop = vi.fn();
            mount({ onDrop, canDrop: () => false });
            const { promise, revert } = drop(bus);
            await promise;

            expect(revert).toHaveBeenCalledTimes(1);
            expect(onDrop).not.toHaveBeenCalled();
        });

        it('should_give_canDrop_the_target_position', async () => {
            const canDrop = vi.fn().mockReturnValue(true);
            mount({ onDrop: async () => {}, canDrop });
            await drop(bus).promise;

            expect(canDrop.mock.calls[0][1]).toEqual({
                newDate: '2026-08-12', newTime: '10:00',
                newResourceId: 'a2', oldResourceId: 'a1',
            });
        });
    });

    describe('blocked states', () => {
        it('should_refuse_to_move_a_cancelled_event', async () => {
            // Read from the normalised flag, so it honours config.statusResolver rather
            // than a hardcoded raw status string.
            const onDrop = vi.fn();
            mount({ onDrop });
            const { promise, revert } = drop(bus, { event: anEvent({ isCancelled: true }) });
            await promise;

            expect(onDrop).not.toHaveBeenCalled();
            expect(revert).toHaveBeenCalledTimes(1);
        });

        it('should_refuse_a_status_the_host_declared_blocked', async () => {
            const onDrop = vi.fn();
            mount({ onDrop, blockedStatuses: ['Completed'] });
            const { promise, revert } = drop(bus, {
                event: anEvent({ sourceData: { status: 'Completed' } }),
            });
            await promise;

            expect(onDrop).not.toHaveBeenCalled();
            expect(revert).toHaveBeenCalledTimes(1);
        });

        it('should_not_block_any_status_by_default', async () => {
            // The previous hardcoded list included a clinic-specific state.
            const onDrop = vi.fn();
            mount({ onDrop });
            await drop(bus, { event: anEvent({ sourceData: { status: 'Visited' } }) }).promise;
            expect(onDrop).toHaveBeenCalledTimes(1);
        });

        it('should_block_a_resize_on_the_same_terms_as_a_drop', async () => {
            // The resize path previously had no state check at all.
            const onResize = vi.fn();
            mount({ onResize, blockedStatuses: ['Completed'] });
            const { promise, revert } = resize(bus, {
                event: anEvent({ sourceData: { status: 'Completed' } }),
            });
            await promise;

            expect(onResize).not.toHaveBeenCalled();
            expect(revert).toHaveBeenCalledTimes(1);
        });
    });

    describe('resize', () => {
        it('should_pass_the_new_end_time_to_the_handler', async () => {
            const onResize = vi.fn();
            mount({ onResize });
            await resize(bus).promise;

            expect(onResize).toHaveBeenCalledTimes(1);
            expect(onResize.mock.calls[0][1]).toEqual({ endTime: '11:00' });
            expect(bus.emitted).toContain('data:refresh');
        });

        it('should_revert_when_canResize_rejects', async () => {
            const onResize = vi.fn();
            mount({ onResize, canResize: () => false });
            const { promise, revert } = resize(bus);
            await promise;

            expect(onResize).not.toHaveBeenCalled();
            expect(revert).toHaveBeenCalledTimes(1);
        });

        it('should_revert_when_the_write_fails', async () => {
            mount({ onResize: async () => { throw new Error('boom'); } });
            const { promise, revert } = resize(bus);
            await promise;
            expect(revert).toHaveBeenCalledTimes(1);
        });
    });

    describe('lifecycle', () => {
        it('should_do_nothing_without_handlers', async () => {
            mount({});
            const { promise, revert } = drop(bus);
            await promise;

            expect(revert).not.toHaveBeenCalled();
            expect(bus.emitted).not.toContain('data:refresh');
        });

        it('should_unsubscribe_on_destroy', async () => {
            const onDrop = vi.fn();
            const plugin = mount({ onDrop });
            expect(bus.count('event:drop')).toBe(1);

            plugin.destroy();
            expect(bus.count('event:drop')).toBe(0);

            await drop(bus).promise;
            expect(onDrop).not.toHaveBeenCalled();
        });

        it('should_expose_the_plugin_name', () => {
            expect(new DragPersistencePlugin().name).toBe('drag-persistence');
        });
    });
});
