import { describe, it, expect, vi } from 'vitest';
import EventBus from './EventBus.js';

describe('EventBus', () => {
    it('should_subscribe_and_emit', () => {
        const bus = new EventBus();
        const handler = vi.fn();
        bus.on('test', handler);
        bus.emit('test', { value: 42 });
        expect(handler).toHaveBeenCalledWith({ value: 42 });
    });

    it('should_return_unsubscribe_function', () => {
        const bus = new EventBus();
        const handler = vi.fn();
        const unsub = bus.on('test', handler);
        unsub();
        bus.emit('test');
        expect(handler).not.toHaveBeenCalled();
    });

    it('should_support_once', () => {
        const bus = new EventBus();
        const handler = vi.fn();
        bus.once('test', handler);
        bus.emit('test', 'a');
        bus.emit('test', 'b');
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('a');
    });

    it('should_handle_multiple_subscribers', () => {
        const bus = new EventBus();
        const h1 = vi.fn();
        const h2 = vi.fn();
        bus.on('test', h1);
        bus.on('test', h2);
        bus.emit('test', 'data');
        expect(h1).toHaveBeenCalledWith('data');
        expect(h2).toHaveBeenCalledWith('data');
    });

    it('should_not_affect_other_events_on_off', () => {
        const bus = new EventBus();
        const h1 = vi.fn();
        const h2 = vi.fn();
        bus.on('event-a', h1);
        bus.on('event-b', h2);
        bus.off('event-a', h1);
        bus.emit('event-a');
        bus.emit('event-b', 'ok');
        expect(h1).not.toHaveBeenCalled();
        expect(h2).toHaveBeenCalledWith('ok');
    });

    it('should_catch_handler_errors', () => {
        const bus = new EventBus();
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const badHandler = () => { throw new Error('boom'); };
        const goodHandler = vi.fn();
        bus.on('test', badHandler);
        bus.on('test', goodHandler);
        bus.emit('test');
        expect(goodHandler).toHaveBeenCalled();
        expect(error).toHaveBeenCalled();
        error.mockRestore();
    });

    it('should_not_invoke_handlers_subscribed_during_the_same_emit', () => {
        // A Set visits entries added while it is being iterated. Modules here subscribe
        // from inside handlers (ViewManager rebuilds a view on date:changed, and the new
        // grid subscribes to date:changed as it is built), so without a snapshot the
        // freshly built grid would be told to rebuild inside the emit that built it.
        const bus = new EventBus();
        const lateHandler = vi.fn();
        bus.on('date:changed', () => bus.on('date:changed', lateHandler));

        bus.emit('date:changed');
        expect(lateHandler).not.toHaveBeenCalled();

        bus.emit('date:changed');
        expect(lateHandler).toHaveBeenCalledTimes(1);
    });

    it('should_let_a_handler_unsubscribe_another_during_emit', () => {
        const bus = new EventBus();
        const second = vi.fn();
        const first = vi.fn(() => bus.off('test', second));
        bus.on('test', first);
        bus.on('test', second);

        // Snapshotting means the already-scheduled handler still runs for this emit...
        bus.emit('test');
        expect(second).toHaveBeenCalledTimes(1);

        // ...but is gone from the next one.
        bus.emit('test');
        expect(first).toHaveBeenCalledTimes(2);
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('should_destroy_all_listeners', () => {
        const bus = new EventBus();
        const handler = vi.fn();
        bus.on('test', handler);
        bus.destroy();
        bus.emit('test');
        expect(handler).not.toHaveBeenCalled();
    });
});
