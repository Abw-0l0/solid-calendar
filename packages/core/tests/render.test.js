/**
 * Proof that the calendar renders.
 *
 * The failure this guards against is not a crash: every module compiled, every test
 * passed, and init() simply wrote no DOM because nothing imported the rendering layer.
 * The headline assertion is therefore the crudest one — that the container is not empty.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CalendarApp from '../src/CalendarApp.js';
import { SLOT_INTERVAL, SLOT_HEIGHT } from '../src/core/CalendarConfig.js';
import { convertTimeToMinutes, getCurrentDate } from '../src/utils/temporal.js';

const TODAY = getCurrentDate();

function dataSource({ events } = {}) {
    return {
        async fetchResources() {
            return {
                resources: [
                    { id: 't1', name: 'Alex Chen', color: '#8935FF' },
                    { id: 't2', name: 'Blake Osei', color: '#007CBE' },
                ],
                secondaryResources: [{ id: 'e1', name: 'Room A', color: '#38A169' }],
            };
        },
        async fetchEvents() {
            return events ?? [
                {
                    id: 'r1',
                    date: TODAY,
                    start_time: '09:00',
                    end_time: '09:30',
                    assignee: { id: 't1', color: '#8935FF' },
                    client: { name: 'J. Ferreira' },
                    status: 'Active',
                },
            ];
        },
    };
}

/** Pixel offset the renderer should use for a time, derived from the grid constants. */
const topFor = (time) => (convertTimeToMinutes(time) / SLOT_INTERVAL) * SLOT_HEIGHT;
const heightFor = (from, to) =>
    ((convertTimeToMinutes(to) - convertTimeToMinutes(from)) / SLOT_INTERVAL) * SLOT_HEIGHT;

describe('CalendarApp rendering', () => {
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

    it('should_write_dom_into_the_container', async () => {
        app = new CalendarApp({ el: '#calendar', dataSource: dataSource() });
        await app.init();

        // The direct inverse of the observed failure: this was 0.
        expect(el.innerHTML.length).toBeGreaterThan(0);
        expect(el.classList.contains('sc-calendar-container')).toBe(true);
    });

    it('should_mount_a_toolbar_and_exactly_one_view', async () => {
        app = new CalendarApp({ el: '#calendar', dataSource: dataSource() });
        await app.init();

        expect(el.querySelectorAll('.sc-toolbar')).toHaveLength(1);
        expect(el.querySelectorAll('.sc-view')).toHaveLength(1);
        expect(el.querySelectorAll('.sc-grid')).toHaveLength(1);
        expect(el.querySelector('.sc-time-axis')).toBeTruthy();
    });

    it('should_build_one_column_per_primary_resource_in_primary_view', async () => {
        app = new CalendarApp({ el: '#calendar', dataSource: dataSource() });
        await app.init();

        const columns = el.querySelectorAll('.sc-column[data-resource-id]');
        expect(columns).toHaveLength(2);
        expect([...columns].map((c) => c.dataset.resourceId)).toEqual(['t1', 't2']);
    });

    it('should_generate_a_full_day_of_slots', async () => {
        app = new CalendarApp({ el: '#calendar', dataSource: dataSource() });
        await app.init();

        const expected = (24 * 60) / SLOT_INTERVAL;
        expect(el.querySelectorAll('.sc-time-axis .sc-timeslot').length).toBe(expected);
    });

    it('should_render_an_event_in_its_own_column_at_the_right_offset', async () => {
        app = new CalendarApp({ el: '#calendar', dataSource: dataSource() });
        await app.init();

        const event = el.querySelector('.sc-event[data-event-id="r1"]');
        expect(event).toBeTruthy();
        // Catches the removed "first available column" fallback, which put events
        // under whichever primary resource happened to be listed first.
        expect(event.closest('.sc-column').dataset.resourceId).toBe('t1');
        expect(event.style.top).toBe(`${topFor('09:00')}px`);
        expect(event.style.height).toBe(`${heightFor('09:00', '09:30')}px`);
    });

    it('should_not_render_an_event_whose_resource_has_no_column', async () => {
        app = new CalendarApp({
            el: '#calendar',
            dataSource: dataSource({
                events: [{
                    id: 'orphan',
                    date: TODAY,
                    start_time: '09:00',
                    end_time: '09:30',
                    assignee: { id: 'nobody' },
                    client: { name: 'Ghost' },
                    status: 'Active',
                }],
            }),
        });
        await app.init();

        expect(app.state.events).toHaveLength(1);
        expect(el.querySelector('.sc-event[data-event-id="orphan"]')).toBeNull();
    });

    it('should_mount_with_no_translations_configured', async () => {
        // Five toolbar modules used to dereference config.translations directly, so a
        // caller who supplied none crashed the whole init.
        app = new CalendarApp({ el: '#calendar', dataSource: dataSource() });
        await expect(app.init()).resolves.toBeUndefined();
        expect(el.querySelector('[aria-label="Today"]').textContent).toBe('Today');
    });

    it('should_skip_the_ui_in_headless_mode_but_still_load_state', async () => {
        app = new CalendarApp({ el: '#calendar', headless: true, dataSource: dataSource() });
        await app.init();

        expect(el.innerHTML).toBe('');
        expect(el.classList.contains('sc-calendar-container')).toBe(false);
        expect(app.state.resources).toHaveLength(3);
        expect(app.state.events).toHaveLength(1);
    });

    it('should_leave_the_container_clean_after_destroy', async () => {
        app = new CalendarApp({ el: '#calendar', dataSource: dataSource() });
        await app.init();
        expect(el.innerHTML.length).toBeGreaterThan(0);

        app.destroy();
        app = null;

        expect(el.innerHTML).toBe('');
        expect(el.classList.contains('sc-calendar-container')).toBe(false);
    });

    it('should_name_holidays_from_a_provider_registered_as_a_plugin', async () => {
        // PluginManager.register only calls init(), so a provider passed in `plugins`
        // never reached config.holidayProvider and holidays silently never appeared.
        const provider = {
            name: 'test-holidays',
            init() {},
            destroy() {},
            getHoliday: (d) => (d === TODAY ? { name: 'Test Holiday' } : null),
            getHolidayName: (d) => (d === TODAY ? 'Test Holiday' : ''),
            preload: vi.fn(),
        };

        app = new CalendarApp({ el: '#calendar', plugins: [provider], dataSource: dataSource() });
        await app.init();

        expect(app.config.holidayProvider).toBe(provider);
        expect(provider.preload).toHaveBeenCalled();
        expect(el.querySelector('.sc-date-header-holiday')?.textContent).toContain('Test Holiday');
    });
});
