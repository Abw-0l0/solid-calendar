/**
 * A wholly foreign payload, end to end.
 *
 * Nothing in this fixture shares a single field name with the library's defaults — it is
 * a vehicle workshop, not a calendar API. If it renders correctly, the library carries no
 * assumptions about the shape of your data.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CalendarApp from '../src/CalendarApp.js';
import { HEALTHCARE_FIELD_MAP } from '../src/core/FieldMap.js';
import { getCurrentDate } from '../src/utils/temporal.js';

const TODAY = getCurrentDate();

const WORKSHOP_FIELD_MAP = {
    dataset: { resources: 'crew', secondaryResources: 'bays' },
    event: {
        id: 'ref',
        date: 'on',
        startTime: 'from',
        endTime: 'to',
        owner: 'assignedTo',
        client: 'booker',
        service: 'job',
    },
    resource: { id: 'code', name: 'displayName', color: 'swatch' },
    secondaryResource: { id: 'code', name: 'displayName' },
    client: { name: 'label' },
    service: { name: 'label' },
};

const workshopSource = {
    async fetchResources() {
        return {
            crew: [
                { code: 'm1', displayName: 'Sam Okafor', swatch: '#8935FF' },
                { code: 'm2', displayName: 'Rae Lindqvist', swatch: '#007CBE' },
            ],
            bays: [{ code: 'b1', displayName: 'Bay 1' }],
        };
    },
    async fetchEvents() {
        return [{
            ref: 'wo-1',
            on: TODAY,
            from: '09:00',
            to: '10:30',
            assignedTo: { code: 'm1', swatch: '#8935FF' },
            booker: { label: 'K. Adeyemi' },
            job: { label: 'Brake service' },
        }];
    },
};

describe('a foreign schema through fieldMap', () => {
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

    it('should_build_columns_from_the_mapped_collections', async () => {
        app = new CalendarApp({ el: '#calendar', fieldMap: WORKSHOP_FIELD_MAP, dataSource: workshopSource });
        await app.init();

        const ids = [...el.querySelectorAll('.sc-column[data-resource-id]')].map((c) => c.dataset.resourceId);
        expect(ids).toEqual(['m1', 'm2']);
        expect(app.state.resources.map((r) => r.title)).toEqual(['Sam Okafor', 'Rae Lindqvist', 'Bay 1']);
    });

    it('should_place_the_event_in_the_right_column_at_the_right_offset', async () => {
        app = new CalendarApp({ el: '#calendar', fieldMap: WORKSHOP_FIELD_MAP, dataSource: workshopSource });
        await app.init();

        const event = el.querySelector('.sc-event[data-event-id="wo-1"]');
        expect(event).toBeTruthy();
        expect(event.closest('.sc-column').dataset.resourceId).toBe('m1');
        // 09:00 = 540 min; 540/10 * 12px
        expect(event.style.top).toBe('648px');
        // 90 min / 10 * 12px
        expect(event.style.height).toBe('108px');
    });

    it('should_normalise_the_client_and_service_names', async () => {
        app = new CalendarApp({ el: '#calendar', fieldMap: WORKSHOP_FIELD_MAP, dataSource: workshopSource });
        await app.init();

        const [event] = app.state.events;
        expect(event.clientName).toBe('K. Adeyemi');
        expect(event.serviceName).toBe('Brake service');
        expect(event.resourceOwnerId).toBe('m1');
        expect(event.title).toBe('K. Adeyemi\nBrake service');
    });

    it('should_populate_every_list_view_column', async () => {
        // The resource and service columns were structurally always blank.
        app = new CalendarApp({ el: '#calendar', fieldMap: WORKSHOP_FIELD_MAP, dataSource: workshopSource });
        await app.init();

        app.state.setCurrentView('list');
        await new Promise((r) => setTimeout(r, 0));

        const row = el.querySelector('.sc-list-row[data-event-id="wo-1"]');
        expect(row).toBeTruthy();
        const cells = [...row.querySelectorAll('td')].map((td) => td.textContent);
        expect(cells[1]).toBe('K. Adeyemi');
        expect(cells[2]).toBe('Sam Okafor');     // via the resource-record fallback
        expect(cells[3]).toBe('Brake service');
    });

    it('should_render_the_service_line_on_the_event_card', async () => {
        app = new CalendarApp({ el: '#calendar', fieldMap: WORKSHOP_FIELD_MAP, dataSource: workshopSource });
        await app.init();

        const service = el.querySelector('.sc-event[data-event-id="wo-1"] .sc-event-service');
        expect(service).toBeTruthy();
        expect(service.textContent).toBe('Brake service');
    });

    it('should_filter_a_foreign_schema_by_owner', async () => {
        app = new CalendarApp({ el: '#calendar', fieldMap: WORKSHOP_FIELD_MAP, dataSource: workshopSource });
        await app.init();

        app.state.setStaffFilters(['m2']);
        expect(el.querySelector('.sc-event[data-event-id="wo-1"]').style.display).toBe('none');
    });

    it('should_warn_when_no_collection_matches', async () => {
        // Dropping the old aliases means a stale payload renders nothing at all; the
        // warning is what turns that into a one-line diagnosis.
        const warnings = [];
        const original = console.warn;
        console.warn = (msg) => warnings.push(String(msg));

        app = new CalendarApp({
            el: '#calendar',
            dataSource: {
                async fetchResources() { return { therapists: [{ id: 't1', name: 'Alex' }] }; },
                async fetchEvents() { return []; },
            },
        });
        await app.init();
        console.warn = original;

        const warning = warnings.find((w) => w.includes('No resources resolved'));
        expect(warning).toBeTruthy();
        expect(warning).toContain('resources');     // what it looked for
        expect(warning).toContain('therapists');    // what the payload actually had
    });
});

describe('the healthcare preset', () => {
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

    it('should_reproduce_the_previous_behaviour_in_one_line', async () => {
        // The migration proof: an untouched pre-change payload still works.
        app = new CalendarApp({
            el: '#calendar',
            fieldMap: HEALTHCARE_FIELD_MAP,
            dataSource: {
                async fetchResources() {
                    return {
                        therapists: [{ id: 't1', full_name: 'Dr. Sato', booking_color: '#8935FF' }],
                        equipment: [{ id: 'e1', name: 'Room A' }],
                    };
                },
                async fetchEvents() {
                    return [{
                        id: 'r1', date: TODAY, start_time: '09:00', end_time: '09:30',
                        therapist: { id: 't1', booking_color: '#8935FF' },
                        patient: { full_name: 'A. Yamada' },
                        menu: { name: 'Follow-up' },
                        set_menu_id: 'sm-1',
                        status: 'Active',
                    }];
                },
            },
        });
        await app.init();

        expect(app.state.resources[0].title).toBe('Dr. Sato');
        expect(app.state.resources[0].color).toBe('#8935FF');

        const [event] = app.state.events;
        expect(event.clientName).toBe('A. Yamada');
        expect(event.serviceName).toBe('Follow-up');
        expect(event.resourceOwnerId).toBe('t1');
        expect(event.groupId).toBe('sm-1');
        expect(event.classNames).toContain('sc-event--group');
        expect(el.querySelector('.sc-event[data-event-id="r1"]')).toBeTruthy();
    });
});
