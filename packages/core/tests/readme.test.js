/**
 * The code in README.md, executed.
 *
 * The previous README documented a quickstart that could not have rendered anything
 * and an install path that would have thrown. Keeping the examples in a test means
 * they cannot drift back.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CalendarApp } from '../src/index.js';
import {
    EventBus, CalendarState, DataBridge, temporal, SLOT_INTERVAL,
} from '../src/headless.js';
import { getCurrentDate } from '../src/utils/temporal.js';

const TODAY = getCurrentDate();

describe('README examples', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="calendar" style="height:600px"></div>';
    });

    describe('quickstart', () => {
        let calendar;
        afterEach(() => { calendar?.destroy(); calendar = null; });

        it('should_render_and_route_callbacks_as_documented', async () => {
            const openBookingDialog = vi.fn();
            const openReservation = vi.fn();

            calendar = new CalendarApp({
                el: '#calendar',
                locale: 'en-US',
                dataSource: {
                    async fetchResources() {
                        return {
                            resources: [
                                { id: 't1', name: 'Dr. Sato', color: '#8935FF' },
                                { id: 't2', name: 'Dr. Tanaka', color: '#007CBE' },
                            ],
                        };
                    },
                    async fetchEvents() {
                        // The minimal raw event shape the README documents.
                        return [{
                            id: 'r1', date: TODAY, start_time: '09:00', end_time: '09:30',
                            assignee: { id: 't1' }, client: { name: 'A. Yamada' },
                            service: { name: 'Follow-up' }, status: 'Active',
                        }];
                    },
                },
                onSlotSelect: openBookingDialog,
                onEventClick: (event) => openReservation(event.sourceData),
            });

            await calendar.init();

            const el = document.querySelector('#calendar');
            expect(el.querySelectorAll('.sc-column[data-resource-id]')).toHaveLength(2);

            const event = el.querySelector('.sc-event[data-event-id="r1"]');
            expect(event).toBeTruthy();
            event.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
            expect(openReservation).toHaveBeenCalledTimes(1);
        });

        it('should_treat_a_titled_event_as_a_time_block', async () => {
            calendar = new CalendarApp({
                el: '#calendar',
                dataSource: {
                    async fetchResources() { return { staff: [{ id: 't1', name: 'Dr. Sato' }] }; },
                    async fetchEvents() {
                        return [
                            { id: 'appt', date: TODAY, start_time: '09:00', end_time: '09:30',
                              assignee: { id: 't1' }, client: { name: 'A. Yamada' }, status: 'Active' },
                            { id: 'block', date: TODAY, start_time: '12:00', end_time: '13:00',
                              title: 'Lunch', assignee: { id: 't1' }, status: 'Active' },
                        ];
                    },
                },
            });
            await calendar.init();

            const byId = Object.fromEntries(calendar.state.events.map((e) => [e.id, e]));
            expect(byId.appt.isTimeBlock).toBe(false);
            expect(byId.block.isTimeBlock).toBe(true);
        });

        it('should_drop_an_event_whose_assignee_is_not_an_object', async () => {
            calendar = new CalendarApp({
                el: '#calendar',
                dataSource: {
                    async fetchResources() { return { staff: [{ id: 't1', name: 'Dr. Sato' }] }; },
                    async fetchEvents() {
                        // A flat staff_id, which the README warns is silently dropped.
                        return [{ id: 'flat', date: TODAY, start_time: '09:00', end_time: '09:30',
                                  staff_id: 't1', client: { name: 'A. Yamada' }, status: 'Active' }];
                    },
                },
            });
            await calendar.init();
            expect(calendar.state.events).toHaveLength(0);
        });
    });

    describe('adapting an existing API schema', () => {
        let calendar;
        afterEach(() => { calendar?.destroy(); calendar = null; });

        it('should_map_a_foreign_schema_through_the_resolvers', async () => {
            calendar = new CalendarApp({
                el: '#calendar',
                eventTypeResolver: (raw) => (raw.kind === 'block' ? 'timeblock' : 'event'),
                statusResolver: (raw) => ({ cancelled: raw.state === 'void' }),
                callbacks: {
                    resolveEventFields(raw) {
                        return {
                            textFields: { room: raw.room_name },
                            badges: raw.is_first_visit ? [{ id: 'new', style: 'solid', text: 'New' }] : [],
                        };
                    },
                },
                dataSource: {
                    async fetchResources() {
                        return { staff: [{ id: 'u7', name: 'Dr. Mori', color: '#38A169' }] };
                    },
                    async fetchEvents() {
                        return [{
                            id: 'bk-1', kind: 'appointment', state: 'active', date: TODAY,
                            start_time: '14:00', end_time: '14:40',
                            assignee: { id: 'u7', color: '#38A169' },
                            attendee: { name: 'K. Ito' },
                            room_name: 'Room 2', is_first_visit: true,
                        }];
                    },
                },
            });
            await calendar.init();

            const [event] = calendar.state.events;
            expect(event.title).toBe('K. Ito');
            expect(event.isTimeBlock).toBe(false);
            expect(event.isCancelled).toBe(false);
            expect(event.textFields).toEqual({ room: 'Room 2' });
            expect(event.badges).toEqual([{ id: 'new', style: 'solid', text: 'New' }]);
        });
    });

    describe('computing free slots headlessly', () => {
        it('should_run_without_any_dom', async () => {
            const { convertTimeToMinutes, convertMinutesToTime } = temporal;

            function freeSlots(events, resourceId, { open = '09:00', close = '17:00', duration = 30 } = {}) {
                const busy = events
                    .filter((e) => e.resourceId === resourceId && !e.isCancelled)
                    .map((e) => [convertTimeToMinutes(e.startTime), convertTimeToMinutes(e.endTime)]);

                const slots = [];
                for (let t = convertTimeToMinutes(open); t + duration <= convertTimeToMinutes(close); t += SLOT_INTERVAL) {
                    if (!busy.some(([s, end]) => t < end && t + duration > s)) slots.push(convertMinutesToTime(t));
                }
                return slots;
            }

            const dataSource = {
                async fetchResources() { return { staff: [{ id: 't1', name: 'Dr. Sato' }] }; },
                async fetchEvents() {
                    return [
                        { id: 'a', date: TODAY, start_time: '09:00', end_time: '09:30',
                          assignee: { id: 't1' }, client: { name: 'A' }, status: 'Active' },
                        { id: 'b', date: TODAY, start_time: '10:00', end_time: '11:00',
                          assignee: { id: 't1' }, client: { name: 'B' }, status: 'Active' },
                    ];
                },
            };

            const bus = new EventBus();
            const state = new CalendarState(bus);
            const data = new DataBridge(state, bus, { dataSource });
            data.init();

            let reported = null;
            bus.on('events:loaded', ({ events }) => { reported = freeSlots(events, 't1'); });
            await data.loadEvents();

            expect(reported).toContain('09:30');
            expect(reported).not.toContain('10:00');   // busy
            expect(reported).not.toContain('10:30');   // would overrun into the 10:00-11:00 booking
            expect(reported).toContain('11:00');
        });
    });
});
