/**
 * View switching, navigation, and gesture wiring.
 *
 * The interaction handlers are mounted on the container rather than inside the view,
 * because ViewManager destroys and rebuilds the whole view subtree on every switch.
 * The assertions below are what prove that decision: after a full view round-trip, a
 * slot gesture must still fire, exactly once, with no rebinding.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CalendarApp from '../src/CalendarApp.js';
import { getCurrentDate, addDaysToString } from '../src/utils/temporal.js';

const TODAY = getCurrentDate();

const dataSource = {
    async fetchResources() {
        return {
            resources: [
                { id: 't1', name: 'Alex Chen', color: '#8935FF' },
                { id: 't2', name: 'Blake Osei', color: '#007CBE' },
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
            client: { name: 'J. Ferreira' },
            status: 'Active',
        }];
    },
};

/** DataBridge reloads on a queueMicrotask, so let the queue drain. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * A click on an empty slot, in the order a browser produces it. The trailing `click`
 * matters: a delegated click listener is exactly how the duplicate emitter this test
 * guards against was implemented, and without it such a regression would go unseen.
 */
function clickEmptySlot(el) {
    const body = el.querySelector('.sc-column-body');
    expect(body).toBeTruthy();
    const opts = { bubbles: true, button: 0, clientY: 0 };
    body.dispatchEvent(new window.MouseEvent('mousedown', opts));
    document.dispatchEvent(new window.MouseEvent('mouseup', opts));
    body.dispatchEvent(new window.MouseEvent('click', opts));
}

describe('CalendarApp lifecycle', () => {
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

    it('should_not_accumulate_views_when_the_date_changes', async () => {
        app = new CalendarApp({ el: '#calendar', dataSource });
        await app.init();
        const columnCount = el.querySelectorAll('.sc-column').length;

        app.state.setCurrentDate(addDaysToString(TODAY, 1));
        await settle();

        expect(el.querySelectorAll('.sc-view')).toHaveLength(1);
        expect(el.querySelectorAll('.sc-toolbar')).toHaveLength(1);
        // Two grids here would mean a handler subscribed during dispatch also fired,
        // rebuilding the grid inside the emit that built it.
        expect(el.querySelectorAll('.sc-grid')).toHaveLength(1);
        expect(el.querySelectorAll('.sc-column')).toHaveLength(columnCount);
    });

    it('should_swap_the_view_tree_when_the_view_changes', async () => {
        app = new CalendarApp({ el: '#calendar', dataSource });
        await app.init();
        expect(el.querySelector('.sc-grid')).toBeTruthy();

        app.state.setCurrentView('dayGridMonth');
        await settle();
        expect(el.querySelector('.sc-month-grid')).toBeTruthy();
        expect(el.querySelector('.sc-grid')).toBeNull();
        expect(el.querySelectorAll('.sc-view')).toHaveLength(1);

        app.state.setCurrentView('list');
        await settle();
        expect(el.querySelector('.sc-list')).toBeTruthy();
        expect(el.querySelectorAll('.sc-view')).toHaveLength(1);
    });

    it('should_fire_a_slot_gesture_exactly_once', async () => {
        // CalendarGrid and SelectionHandler both used to emit slot:click, and
        // CalendarApp binds slot:click and slot:select to the same callback — so one
        // click on an empty slot opened two booking dialogs.
        const onSlotSelect = vi.fn();
        app = new CalendarApp({ el: '#calendar', dataSource, onSlotSelect });
        await app.init();

        clickEmptySlot(el);
        expect(onSlotSelect).toHaveBeenCalledTimes(1);
    });

    it('should_keep_gestures_working_after_a_view_round_trip', async () => {
        // Handlers are bound to the container, never to the view, so a full switch
        // away and back must not require rebinding them.
        const onSlotSelect = vi.fn();
        app = new CalendarApp({ el: '#calendar', dataSource, onSlotSelect });
        await app.init();

        app.state.setCurrentView('dayGridMonth');
        await settle();
        app.state.setCurrentView('resourceTimeGridDay');
        await settle();

        clickEmptySlot(el);
        expect(onSlotSelect).toHaveBeenCalledTimes(1);
    });

    it('should_dispatch_a_dom_event_alongside_the_callback', async () => {
        const domHandler = vi.fn();
        app = new CalendarApp({ el: '#calendar', dataSource });
        await app.init();
        el.addEventListener('sc:slot:select', domHandler);

        clickEmptySlot(el);
        expect(domHandler).toHaveBeenCalledTimes(1);
    });

    it('should_route_event_clicks_to_the_callback', async () => {
        const onEventClick = vi.fn();
        app = new CalendarApp({ el: '#calendar', dataSource, onEventClick });
        await app.init();

        const event = el.querySelector('.sc-event[data-event-id="r1"]');
        expect(event).toBeTruthy();
        event.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

        expect(onEventClick).toHaveBeenCalledTimes(1);
        expect(onEventClick.mock.calls[0][0].id).toBe('r1');
    });

    it('should_leave_no_document_listeners_behind_after_destroy', async () => {
        // ResourceFilter, ViewSwitcher, ResourceViewSwitcher and DatePicker each add a
        // document-level click listener; leaking one per instance would be invisible.
        const added = new Set();
        const realAdd = document.addEventListener.bind(document);
        const realRemove = document.removeEventListener.bind(document);
        vi.spyOn(document, 'addEventListener').mockImplementation((type, fn, opts) => {
            added.add(fn);
            return realAdd(type, fn, opts);
        });
        vi.spyOn(document, 'removeEventListener').mockImplementation((type, fn, opts) => {
            added.delete(fn);
            return realRemove(type, fn, opts);
        });

        app = new CalendarApp({ el: '#calendar', dataSource });
        await app.init();
        app.destroy();
        app = null;

        expect([...added]).toHaveLength(0);
        vi.restoreAllMocks();
    });

    it('should_ignore_an_unrecognised_stored_resource_mode', async () => {
        app = new CalendarApp({
            el: '#calendar',
            contextId: 'workspace-1',
            dataSource,
            preferences: {
                async fetch() {
                    return { success: true, preferences: { resourceMode: 'reservationData' } };
                },
                async save() {},
            },
        });
        await app.init();

        // Not a RESOURCE_MODES key. It used to be assigned unvalidated, leaving state
        // in a mode nothing recognises; now it is rejected and the default stands.
        expect(app.state.currentResourceMode).toBe('primaryView');
        expect(el.querySelectorAll('.sc-view')).toHaveLength(1);
    });
});
