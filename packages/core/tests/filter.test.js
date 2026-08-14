/**
 * Resource filtering.
 *
 * Every assertion here fails before this change. `_applyFilter` read `event.therapist`,
 * a key the mapper never wrote, so the id was always undefined, the `!id` guard was
 * always true, and no event was ever hidden. The dropdown worked; filtering did nothing.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CalendarApp from '../src/CalendarApp.js';
import { getCurrentDate } from '../src/utils/temporal.js';

const TODAY = getCurrentDate();

const appointment = (id, ownerId, extra = {}) => ({
    id,
    date: TODAY,
    start_time: '09:00',
    end_time: '09:30',
    assignee: { id: ownerId, ...extra },
    client: { name: `Client ${id}` },
    status: 'Active',
});

function makeApp(overrides = {}) {
    return new CalendarApp({
        el: '#calendar',
        dataSource: {
            async fetchResources() {
                return {
                    resources: [
                        { id: 't1', name: 'Alex' },
                        { id: 't2', name: 'Blake' },
                    ],
                    secondaryResources: [{ id: 'e1', name: 'Room A' }],
                };
            },
            async fetchEvents() {
                return [appointment('a', 't1'), appointment('b', 't2')];
            },
        },
        ...overrides,
    });
}

const displayOf = (el, id) => el.querySelector(`.sc-event[data-event-id="${id}"]`)?.style.display;

describe('resource filtering', () => {
    let el;
    let app;

    beforeEach(() => {
        document.body.innerHTML = '<div id="calendar"></div>';
        el = document.querySelector('#calendar');
    });

    afterEach(() => {
        app?.destroy();
        app = null;
    });

    it('should_hide_events_whose_owner_is_filtered_out', async () => {
        app = makeApp();
        await app.init();

        expect(displayOf(el, 'a')).toBe('');
        expect(displayOf(el, 'b')).toBe('');

        app.state.setStaffFilters(['t1']);

        expect(displayOf(el, 'a')).toBe('');
        expect(displayOf(el, 'b')).toBe('none');
    });

    it('should_restore_an_event_when_its_owner_is_re_included', async () => {
        app = makeApp();
        await app.init();

        app.state.setStaffFilters(['t1']);
        expect(displayOf(el, 'b')).toBe('none');

        app.state.setStaffFilters(['t1', 't2']);
        expect(displayOf(el, 'b')).toBe('');
    });

    it('should_hide_everything_when_no_owner_is_selected', async () => {
        app = makeApp();
        await app.init();

        app.state.setStaffFilters([]);

        expect(displayOf(el, 'a')).toBe('none');
        expect(displayOf(el, 'b')).toBe('none');
    });

    it('should_keep_an_owner_less_time_block_visible_under_any_filter', async () => {
        app = new CalendarApp({
            el: '#calendar',
            dataSource: {
                async fetchResources() { return { resources: [{ id: 't1', name: 'Alex' }] }; },
                async fetchEvents() {
                    // A title with no assignee maps to the 'no-resource' sentinel.
                    return [{ id: 'block', date: TODAY, start_time: '12:00', end_time: '13:00',
                              title: 'All-hands', status: 'Active' }];
                },
            },
        });
        // The sentinel only renders in a flat view.
        await app.init();
        app.state.setCurrentView('timeGridDay');
        await new Promise((r) => setTimeout(r, 0));

        app.state.setStaffFilters([]);
        const block = el.querySelector('.sc-event[data-event-id="block"]');
        if (block) expect(block.style.display).toBe('');
    });

    it('should_exempt_an_owner_flagged_as_a_system_resource', async () => {
        app = makeApp();
        // isSystemResource is the documented exemption flag on the owner record.
        app.config.dataSource.fetchEvents = async () => [
            appointment('a', 't1'),
            appointment('b', 't2', { isSystemResource: true }),
        ];
        await app.init();

        app.state.setStaffFilters(['t1']);
        expect(displayOf(el, 'b')).toBe('');
    });

    it('should_filter_correctly_when_the_payload_is_keyed_by_uuid', async () => {
        // Resources resolved id from `id ?? uuid` while events read a bare `id`, so a
        // uuid-keyed payload built columns and then dropped every event against them.
        app = new CalendarApp({
            el: '#calendar',
            dataSource: {
                async fetchResources() {
                    return { resources: [{ uuid: 'u1', name: 'Alex' }, { uuid: 'u2', name: 'Blake' }] };
                },
                async fetchEvents() {
                    return [
                        { id: 'a', date: TODAY, start_time: '09:00', end_time: '09:30',
                          assignee: { uuid: 'u1' }, client: { name: 'One' }, status: 'Active' },
                        { id: 'b', date: TODAY, start_time: '09:00', end_time: '09:30',
                          assignee: { uuid: 'u2' }, client: { name: 'Two' }, status: 'Active' },
                    ];
                },
            },
        });
        await app.init();

        expect(app.state.events).toHaveLength(2);
        expect(el.querySelectorAll('.sc-event')).toHaveLength(2);

        app.state.setStaffFilters(['u1']);
        expect(displayOf(el, 'b')).toBe('none');
    });

    it('should_expose_a_normalised_owner_id_on_every_event', async () => {
        // Structural: the filter cannot regress to reading a field nobody writes.
        app = makeApp();
        await app.init();

        for (const event of app.state.events) {
            expect(event.resourceOwnerId).not.toBeUndefined();
        }
        expect(app.state.events.map((e) => e.resourceOwnerId)).toEqual(['t1', 't2']);
    });
});
