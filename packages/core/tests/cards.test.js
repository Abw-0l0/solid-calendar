/**
 * Card content: custom text fields and badges.
 *
 * Badges had no coverage at all. `_buildBadgeElement` was never reached by any test,
 * because every existing fixture omitted `cardDisplaySettings` and so returned at the
 * first guard in `_buildBadges`. That is how the shipped `Badge` declaration came to
 * describe a shape — `{ id, style, text }` — sharing no member with what the renderer
 * reads, without a single test going red.
 *
 * So these assert the rendered DOM, not the mapped data. A badge that reaches
 * `event.badges` and is then silently dropped is exactly the bug being guarded against.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CalendarApp from '../src/CalendarApp.js';
import { getCurrentDate } from '../src/utils/temporal.js';

const TODAY = getCurrentDate();

function dataSource() {
    return {
        async fetchResources() {
            return { resources: [{ id: 't1', name: 'Alex Chen', color: '#8935FF' }] };
        },
        async fetchEvents() {
            return [
                {
                    id: 'r1',
                    date: TODAY,
                    start_time: '09:00',
                    end_time: '09:30',
                    // Carries its own name: resourceOwnerName is projected from the
                    // assignee embedded in the event, not looked up in the resource list.
                    assignee: { id: 't1', name: 'Alex Chen' },
                    client: { name: 'J. Ferreira' },
                    service: { name: 'Consultation' },
                    status: 'Active',
                },
            ];
        },
    };
}

/** The three-way agreement a badge needs: badgeItems, badgeTypes, and the badge itself. */
function badgeConfig({ badges, badgeTypes, badgeItems } = {}) {
    return {
        el: '#calendar',
        dataSource: dataSource(),
        cardDisplaySettings: {
            textItems: [{ id: 'client', name: 'Client', visible: true, order: 1 }],
            badgeItems: badgeItems ?? [{ id: 'status', name: 'Status', visible: true, order: 1 }],
        },
        badgeTypes: badgeTypes ?? {
            status: { style: 'outlined', bgColor: '#1f2937', textColor: '#f9fafb' },
        },
        callbacks: {
            resolveEventFields: (raw, mapped) => ({
                textFields: { client: mapped.clientName },
                badges: badges ?? [{ typeId: 'status', label: 'Confirmed' }],
            }),
        },
    };
}

describe('card content', () => {
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

    describe('badges', () => {
        it('should_render_a_badge_matching_a_visible_badge_item', async () => {
            app = new CalendarApp(badgeConfig());
            await app.init();

            const badge = el.querySelector('.sc-event-badge');
            expect(badge).not.toBeNull();
            expect(badge.querySelector('.sc-event-badge-label').textContent).toBe('Confirmed');
        });

        it('should_take_every_visual_property_from_the_badge_type', async () => {
            app = new CalendarApp(
                badgeConfig({
                    badgeTypes: {
                        status: {
                            style: 'outlined',
                            bgColor: 'rgb(31, 41, 55)',
                            textColor: 'rgb(249, 250, 251)',
                            borderColor: 'rgb(255, 0, 0)',
                            maxWidth: 90,
                        },
                    },
                }),
            );
            await app.init();

            const badge = el.querySelector('.sc-event-badge');
            expect(badge.classList.contains('sc-event-badge--outlined')).toBe(true);
            expect(badge.style.backgroundColor).toBe('rgb(31, 41, 55)');
            expect(badge.style.color).toBe('rgb(249, 250, 251)');
            expect(badge.style.borderColor).toBe('rgb(255, 0, 0)');
            expect(badge.style.maxWidth).toBe('90px');
        });

        it('should_render_a_count_and_a_tooltip', async () => {
            app = new CalendarApp(
                badgeConfig({ badges: [{ typeId: 'status', label: 'Rooms', count: 3, tooltip: 'Three rooms' }] }),
            );
            await app.init();

            const badge = el.querySelector('.sc-event-badge');
            expect(badge.querySelector('.sc-event-badge-count').textContent).toBe('(3)');
            expect(badge.title).toBe('Three rooms');
        });

        it('should_call_the_icon_factories_from_the_badge_type', async () => {
            app = new CalendarApp(
                badgeConfig({
                    badges: [{ typeId: 'status', label: 'Locked', meta: { showSecondaryIcon: true } }],
                    badgeTypes: {
                        status: {
                            createIcon: () => {
                                const i = document.createElement('i');
                                i.className = 'primary-icon';
                                return i;
                            },
                            createSecondaryIcon: () => {
                                const i = document.createElement('i');
                                i.className = 'secondary-icon';
                                return i;
                            },
                        },
                    },
                }),
            );
            await app.init();

            const badge = el.querySelector('.sc-event-badge');
            expect(badge.querySelector('.primary-icon')).not.toBeNull();
            expect(badge.querySelector('.secondary-icon')).not.toBeNull();
        });

        it('should_not_render_the_secondary_icon_without_the_meta_flag', async () => {
            app = new CalendarApp(
                badgeConfig({
                    badges: [{ typeId: 'status', label: 'Plain' }],
                    badgeTypes: {
                        status: {
                            createSecondaryIcon: () => {
                                const i = document.createElement('i');
                                i.className = 'secondary-icon';
                                return i;
                            },
                        },
                    },
                }),
            );
            await app.init();

            expect(el.querySelector('.secondary-icon')).toBeNull();
        });

        // The three silent-skip paths. Each one produced a "badges just don't work"
        // report at some point, so each is pinned rather than left to inference.
        it('should_drop_a_badge_with_no_matching_badge_type', async () => {
            app = new CalendarApp(badgeConfig({ badgeTypes: {} }));
            await app.init();

            expect(el.querySelector('.sc-event')).not.toBeNull();
            expect(el.querySelector('.sc-event-badge')).toBeNull();
        });

        it('should_drop_a_badge_whose_type_id_matches_no_badge_item', async () => {
            app = new CalendarApp(badgeConfig({ badges: [{ typeId: 'unknown', label: 'Nope' }] }));
            await app.init();

            expect(el.querySelector('.sc-event-badge')).toBeNull();
        });

        it('should_drop_a_badge_whose_badge_item_is_not_visible', async () => {
            app = new CalendarApp(
                badgeConfig({ badgeItems: [{ id: 'status', name: 'Status', visible: false, order: 1 }] }),
            );
            await app.init();

            expect(el.querySelector('.sc-event-badge')).toBeNull();
        });

        it('should_render_badges_in_badge_item_order_not_badge_array_order', async () => {
            app = new CalendarApp({
                ...badgeConfig({
                    badges: [
                        { typeId: 'second', label: 'Second' },
                        { typeId: 'first', label: 'First' },
                    ],
                    badgeItems: [
                        { id: 'first', name: 'First', visible: true, order: 1 },
                        { id: 'second', name: 'Second', visible: true, order: 2 },
                    ],
                    badgeTypes: { first: {}, second: {} },
                }),
            });
            await app.init();

            const labels = [...el.querySelectorAll('.sc-event-badge-label')].map((n) => n.textContent);
            expect(labels).toEqual(['First', 'Second']);
        });
    });

    describe('resolveEventFields', () => {
        // The projections used to be computed after the callback ran, so the fields it is
        // named for were undefined and every card built from them rendered blank.
        it('should_receive_the_resolved_name_projections', async () => {
            let seen = null;
            app = new CalendarApp({
                el: '#calendar',
                dataSource: dataSource(),
                callbacks: {
                    resolveEventFields: (raw, mapped) => {
                        seen = mapped;
                        return {};
                    },
                },
            });
            await app.init();

            expect(seen.clientName).toBe('J. Ferreira');
            expect(seen.serviceName).toBe('Consultation');
            expect(seen.resourceOwnerName).toBe('Alex Chen');
            expect(seen.resourceOwnerId).toBe('t1');
        });

        it('should_still_receive_the_raw_record_untouched', async () => {
            let seenRaw = null;
            app = new CalendarApp({
                el: '#calendar',
                dataSource: dataSource(),
                callbacks: {
                    resolveEventFields: (raw) => {
                        seenRaw = raw;
                        return {};
                    },
                },
            });
            await app.init();

            expect(seenRaw.id).toBe('r1');
            expect(seenRaw.client).toEqual({ name: 'J. Ferreira' });
        });

        it('should_render_text_fields_built_from_the_projections', async () => {
            app = new CalendarApp({
                el: '#calendar',
                dataSource: dataSource(),
                cardDisplaySettings: {
                    textItems: [
                        { id: 'client', name: 'Client', visible: true, order: 1 },
                        { id: 'service', name: 'Service', visible: true, order: 2 },
                    ],
                },
                callbacks: {
                    resolveEventFields: (raw, mapped) => ({
                        textFields: { client: mapped.clientName, service: mapped.serviceName },
                    }),
                },
            });
            await app.init();

            // The first visible field with a value becomes the title, whatever its id.
            expect(el.querySelector('.sc-event-title').textContent).toBe('J. Ferreira');
            expect(el.querySelector('.sc-event-field--service').textContent).toBe('Consultation');
        });
    });
});
