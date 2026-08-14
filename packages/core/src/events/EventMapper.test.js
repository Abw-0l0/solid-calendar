import { describe, it, expect, vi } from 'vitest';
import EventMapper from './EventMapper.js';
import EventBus from '../core/EventBus.js';
import CalendarState from '../core/CalendarState.js';

describe('EventMapper', () => {
    function createMapper(config = {}) {
        const bus = new EventBus();
        const state = new CalendarState(bus);
        return new EventMapper(state, bus, { locale: 'en-US', ...config });
    }

    it('should_return_empty_for_non_array', () => {
        const mapper = createMapper();
        expect(mapper.mapAll(null)).toEqual([]);
        expect(mapper.mapAll(undefined)).toEqual([]);
    });

    it('should_map_appointment_with_assignee', () => {
        const mapper = createMapper();
        const events = mapper.mapAll([{
            id: '1',
            date: '2026-03-15',
            start_time: '09:00',
            end_time: '10:00',
            assignee: { id: 't1', color: '#FF0000' },
            client: { name: 'Alice' },
            service: { name: 'Checkup' },
            status: 'Active'
        }]);
        expect(events).toHaveLength(1);
        expect(events[0].id).toBe('1');
        expect(events[0].title).toContain('Alice');
        expect(events[0].title).toContain('Checkup');
        expect(events[0].isTimeBlock).toBe(false);
        expect(events[0].resourceId).toBe('t1');
        expect(events[0].sourceData).toBeDefined();
    });

    it('should_map_timeblock', () => {
        const mapper = createMapper();
        const events = mapper.mapAll([{
            id: '2',
            title: 'Lunch Break',
            date: '2026-03-15',
            start_time: '12:00',
            end_time: '13:00',
            assignee: { id: 't1', color: '#FF0000' },
            status: 'Active'
        }]);
        expect(events).toHaveLength(1);
        expect(events[0].isTimeBlock).toBe(true);
        expect(events[0].title).toBe('Lunch Break');
    });

    it('should_map_cancelled_event', () => {
        const mapper = createMapper();
        const events = mapper.mapAll([{
            id: '3',
            date: '2026-03-15',
            start_time: '09:00',
            end_time: '10:00',
            assignee: { id: 't1', color: '#FF0000' },
            client: { name: 'Bob' },
            status: 'Cancelled'
        }]);
        expect(events[0].isCancelled).toBe(true);
        expect(events[0].classNames).toContain('sc-event--cancelled');
    });

    it('should_use_custom_event_type_resolver', () => {
        const mapper = createMapper({
            eventTypeResolver: (raw) => raw.type === 'block' ? 'timeblock' : 'event'
        });
        const events = mapper.mapAll([{
            id: '4',
            type: 'block',
            title: 'Custom Block',
            date: '2026-03-15',
            start_time: '14:00',
            end_time: '15:00',
            assignee: { id: 't1' }
        }]);
        expect(events[0].isTimeBlock).toBe(true);
    });

    it('should_use_custom_status_resolver', () => {
        const mapper = createMapper({
            statusResolver: (raw) => ({ cancelled: raw.custom_status === 'void' })
        });
        const events = mapper.mapAll([{
            id: '5',
            date: '2026-03-15',
            start_time: '14:00',
            end_time: '15:00',
            assignee: { id: 't1' },
            client: { name: 'Carol' },
            custom_status: 'void'
        }]);
        expect(events[0].isCancelled).toBe(true);
    });

    it('should_call_resolve_event_fields', () => {
        const resolveEventFields = vi.fn().mockReturnValue({
            textFields: { client: 'Alice' },
            badges: [{ id: 'vip', text: 'VIP' }]
        });
        const mapper = createMapper({ callbacks: { resolveEventFields } });
        const events = mapper.mapAll([{
            id: '6',
            date: '2026-03-15',
            start_time: '09:00',
            end_time: '10:00',
            assignee: { id: 't1' },
            client: { name: 'Alice' },
            status: 'Active'
        }]);
        expect(resolveEventFields).toHaveBeenCalled();
        expect(events[0].textFields).toEqual({ client: 'Alice' });
        expect(events[0].badges).toEqual([{ id: 'vip', text: 'VIP' }]);
    });

    it('should_collapse_a_multi_assignee_timeblock_in_a_flat_view', () => {
        const mapper = createMapper();
        // State defaults to resource view, so set it to non-resource
        mapper.state.setCurrentView('timeGridDay');

        const events = mapper.mapAll([{
            id: '7',
            title: 'Meeting',
            date: '2026-03-15',
            start_time: '10:00',
            end_time: '11:00',
            assignees: [
                { id: 't1', color: '#FF0000' },
                { id: 't2', color: '#00FF00' }
            ],
            assignee: { id: 't1' },
            status: 'Active'
        }]);
        // Flat view: one event carrying the assignee count.
        expect(events).toHaveLength(1);
        expect(events[0].title).toBe('Meeting (2)');
        expect(events[0].resourceOwnerId).toBe('t1');
    });

    it('should_add_group_class_for_a_grouped_event', () => {
        const mapper = createMapper();
        const events = mapper.mapAll([{
            id: '8',
            date: '2026-03-15',
            start_time: '09:00',
            end_time: '10:00',
            assignee: { id: 't1' },
            client: { name: 'Dave' },
            groupId: 'sm-1',
            status: 'Active'
        }]);
        expect(events[0].classNames).toContain('sc-event--group');
    });
});
