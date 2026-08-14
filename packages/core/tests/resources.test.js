/**
 * Resource vocabulary and view modes.
 *
 * Each test here corresponds to a place where the writer and the readers disagreed on
 * a string. None of them threw; they produced empty columns and empty dropdowns, which
 * is why they survived so long.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CalendarApp from '../src/CalendarApp.js';
import { RESOURCE_TYPES, isFlatMode } from '../src/core/CalendarConfig.js';
import { getCurrentDate } from '../src/utils/temporal.js';

const TODAY = getCurrentDate();

const dataSource = {
    async fetchResources() {
        return {
            resources: [
                { id: 't1', name: 'Dr. Sato' },
                { id: 't2', name: 'Dr. Tanaka' },
            ],
            secondaryResources: [{ id: 'e1', name: 'Room A' }],
        };
    },
    async fetchEvents() {
        return [{
            id: 'r1',
            date: TODAY,
            start_time: '09:00',
            end_time: '09:30',
            assignee: { id: 't1' },
            client: { name: 'A. Yamada' },
            secondaryResources: [{ id: 'e1', color: '#38A169' }],
            status: 'Active',
        }];
    },
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('resource vocabulary and modes', () => {
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

    it('should_write_the_canonical_resource_types', async () => {
        app = new CalendarApp({ el: '#calendar', dataSource });
        await app.init();

        const types = app.state.resources.map((r) => r.type);
        expect(types).toEqual([RESOURCE_TYPES.STAFF, RESOURCE_TYPES.STAFF, RESOURCE_TYPES.RESOURCE]);
        // Secondary resources are prefixed so their ids cannot collide with staff ids.
        expect(app.state.resources[2].id).toBe('resource-e1');
    });

    it('should_populate_the_staff_filter_dropdown', async () => {
        // StaffFilter read type === 'therapist', which nothing writes, so this list was
        // permanently empty apart from its "Select All" row.
        app = new CalendarApp({ el: '#calendar', dataSource });
        await app.init();

        el.querySelector('.sc-staff-filter')
            ?.closest('.sc-toolbar-group')
            ?.querySelector('button')
            ?.click();

        const checkboxes = el.querySelectorAll('.sc-staff-filter input[type="checkbox"]');
        const values = [...checkboxes].map((c) => c.value);
        expect(values).toContain('t1');
        expect(values).toContain('t2');
        // Staff only: rooms and equipment are not staff-filterable.
        expect(values).not.toContain('resource-e1');
    });

    it('should_show_only_secondary_resources_in_resource_view', async () => {
        app = new CalendarApp({ el: '#calendar', dataSource });
        await app.init();

        app.state.setCurrentResourceMode('resourceView');
        await settle();

        const ids = [...el.querySelectorAll('.sc-column[data-resource-id]')].map((c) => c.dataset.resourceId);
        expect(ids).toEqual(['resource-e1']);
    });

    it('should_show_both_kinds_in_integrated_view', async () => {
        app = new CalendarApp({ el: '#calendar', dataSource });
        await app.init();

        app.state.setCurrentResourceMode('integratedView');
        await settle();

        const ids = [...el.querySelectorAll('.sc-column[data-resource-id]')].map((c) => c.dataset.resourceId);
        expect(ids).toEqual(['t1', 't2', 'resource-e1']);
    });

    it('should_treat_flatView_as_a_flat_mode', () => {
        // The grid and toolbar branched on 'reservationData', which is not a
        // RESOURCE_MODES key, while CalendarState used 'flatView'.
        expect(isFlatMode('flatView')).toBe(true);
        expect(isFlatMode('staffView')).toBe(false);
        expect(isFlatMode('resourceView')).toBe(false);
        expect(isFlatMode('reservationData')).toBe(false);
        expect(isFlatMode(undefined)).toBe(false);
    });

    it('should_keep_secondary_resource_events_visible_under_a_staff_filter', async () => {
        // EventRenderer and EventContentBuilder read event.isEquipmentEvent, which
        // nothing writes, so these events vanished whenever a filter was active.
        app = new CalendarApp({ el: '#calendar', dataSource });
        await app.init();

        app.state.setCurrentResourceMode('integratedView');
        await settle();

        const secondary = app.state.events.find((e) => e.isSecondaryResourceEvent);
        expect(secondary).toBeTruthy();

        app.state.setStaffFilters([]);
        const rendered = el.querySelector(`.sc-column[data-resource-id="resource-e1"] .sc-event`);
        expect(rendered).toBeTruthy();
        expect(rendered.style.display).not.toBe('none');
    });
});
