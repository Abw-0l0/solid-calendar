/**
 * EventRenderer — Positions event DOM elements within grid column bodies
 *
 * Computes absolute top/height from time-to-pixel formulas, uses
 * EventOverlapEngine for left/width of overlapping events, and
 * EventContentBuilder for the visual content. Listens to events:loaded
 * and filter:changed from EventBus.
 */
import { SLOT_HEIGHT, SLOT_INTERVAL, DEFAULT_BUSINESS_HOURS, MIN_EVENT_HEIGHT } from '../core/CalendarConfig.js';
import { convertTimeToMinutes, timeDiff } from '../utils/temporal.js';
import { calculateOverlapLayout } from './EventOverlapEngine.js';
import EventContentBuilder from './EventContentBuilder.js';

export default class EventRenderer {
    /**
     * @param {import('../core/CalendarState.js').default} state
     * @param {import('../core/EventBus.js').default} bus
     * @param {object} config
     */
    constructor(state, bus, config) {
        this.state = state;
        this.bus = bus;
        this.config = config;
        this.contentBuilder = new EventContentBuilder(state, bus, config);
        this.container = null;

        /** @type {Map<string, HTMLElement>} eventId → DOM element */
        this._elements = new Map();

        /** @type {Function[]} */
        this._unsubscribers = [];
    }

    /**
     * Initialize renderer — attach to container and listen for events
     * @param {HTMLElement} container - the .sc-calendar-container or .sc-grid element
     */
    init(container) {
        this.container = container;

        this._unsubscribers.push(
            this.bus.on('events:loaded', ({ events }) => this.render(events)),
            this.bus.on('filter:changed', ({ resourceIds }) => this._applyFilter(resourceIds)),
            this.bus.on('view:changed', () => this._clearAll()),
            this.bus.on('resource:changed', () => this._clearAll()),
            this.bus.on('cardSettings:changed', () => {
                if (this.state.events.length > 0) {
                    this.render(this.state.events);
                }
            })
        );
    }

    /**
     * Render all events into their respective column bodies
     * @param {Array} events - InternalEvent[]
     */
    render(events) {
        this._clearAll();

        if (!this.container || !events?.length) {
            return;
        }

        // Pre-compute group counts once for all events (avoids O(n²) per-event filtering)
        this._groupCountMap = this.contentBuilder.buildGroupCountMap(events);

        // Group events by resourceId + date for column-based rendering
        const groups = this._groupByColumn(events);

        for (const [, columnEvents] of groups) {
            const overlapLayout = calculateOverlapLayout(columnEvents);
            this._renderColumnEvents(columnEvents, overlapLayout);
        }

        // Mark connected group siblings once every event is positioned
        this._markConnectedSiblings(events);

        // Always apply resource filters after rendering
        this._applyFilter(this.state.resourceFilters);
    }

    /**
     * Group events by their target column (resourceId + date)
     * @param {Array} events
     * @returns {Map<string, Array>}
     */
    _groupByColumn(events) {
        const groups = new Map();

        for (const event of events) {
            const key = `${event.resourceId ?? 'none'}_${event.date}`;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(event);
        }

        return groups;
    }

    /**
     * Render events for a single column
     * @param {Array} events - events in this column
     * @param {Map} overlapLayout - from EventOverlapEngine
     */
    _renderColumnEvents(events, overlapLayout) {
        for (const event of events) {
            const columnBody = this._findColumnBody(event);
            if (!columnBody) {
                continue;
            }

            const el = this.contentBuilder.build(event, this._groupCountMap);

            // Position the event
            const { top, height } = this._calculatePosition(event);
            el.style.top = `${top}px`;
            el.style.height = `${Math.max(height, MIN_EVENT_HEIGHT)}px`;

            // Apply overlap layout
            const layout = overlapLayout.get(event.id);
            if (layout) {
                el.style.left = layout.left;
                el.style.width = layout.width;
            }

            columnBody.appendChild(el);
            this._elements.set(event.id, el);
        }
    }

    /**
     * Find the .sc-column-body element for an event
     * @param {object} event - InternalEvent
     * @returns {HTMLElement|null}
     */
    _findColumnBody(event) {
        if (!this.container) {
            return null;
        }

        // Try combined resource+date column first (multi-day resource views — most specific)
        if (event.resourceId && event.date) {
            const combinedColumn = this.container.querySelector(`.sc-column[data-resource-id="${event.resourceId}"][data-date="${event.date}"] .sc-column-body`);
            if (combinedColumn) {
                return combinedColumn;
            }
        }

        // Try resource-only column (single-day resource views)
        if (event.resourceId) {
            const resourceColumn = this.container.querySelector(`.sc-column[data-resource-id="${event.resourceId}"] .sc-column-body`);
            if (resourceColumn) {
                return resourceColumn;
            }
        }

        // Try date-based column (non-resource views and flatView mode)
        if (event.date) {
            const dateColumn = this.container.querySelector(`.sc-column[data-date="${event.date}"] .sc-column-body`);
            if (dateColumn) {
                return dateColumn;
            }
        }

        // Deliberately no fallback: an event whose column is absent must not render
        // in a different resource’s column.
        return null;
    }

    /**
     * Calculate pixel position and height for an event
     * @param {object} event - InternalEvent
     * @returns {{ top: number, height: number }}
     */
    _calculatePosition(event) {
        const businessStart = DEFAULT_BUSINESS_HOURS.start;
        const dayStartMinutes = convertTimeToMinutes(businessStart);
        const eventStartMinutes = convertTimeToMinutes(event.startTime);
        const durationMinutes = timeDiff(event.startTime, event.endTime);

        const top = ((eventStartMinutes - dayStartMinutes) / SLOT_INTERVAL) * SLOT_HEIGHT;
        const height = (durationMinutes / SLOT_INTERVAL) * SLOT_HEIGHT;

        return { top, height };
    }

    /**
     * Apply the resource filter — hide events not matching it
     * @param {string[]} resourceIds - checked primary-resource ids
     */
    _applyFilter(resourceIds) {
        const resourceSet = new Set(resourceIds.map(String));

        for (const event of this.state.events) {
            const el = this._elements.get(event.id);
            if (!el) {
                continue;
            }

            // resourceOwnerId, not resourceId: secondary-resource events carry a
            // 'secondary-' prefix and owner-less time blocks carry a 'no-resource'
            // sentinel, so filtering on resourceId would hide the wrong things.
            const ownerId = event.resourceOwnerId;
            const visible = event.isSecondaryResourceEvent
                || ownerId == null
                || event.ignoresResourceFilter
                || resourceSet.has(String(ownerId));
            el.style.display = visible ? '' : 'none';
        }
    }

    /**
     * Get the DOM element for a given event ID
     * @param {string} eventId
     * @returns {HTMLElement|null}
     */
    getElement(eventId) {
        return this._elements.get(eventId) ?? null;
    }

    /**
     * Detect adjacent siblings of the same group in a column and mark them
     * with CSS classes for the visual connector bar.
     * @param {Array} events - InternalEvent[]
     */
    _markConnectedSiblings(events) {
        // Group connected events by groupId + resourceId (same column)
        const groups = new Map();

        for (const event of events) {
            const groupId = event.groupId;
            if (!groupId || event.isTimeBlock) {
                continue;
            }
            const key = `${groupId}_${event.resourceId ?? 'none'}_${event.date}`;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(event);
        }

        for (const [, siblings] of groups) {
            if (siblings.length < 2) {
                continue;
            }

            // Sort by start time
            siblings.sort((a, b) => (a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0));

            for (let i = 0; i < siblings.length - 1; i++) {
                const upper = siblings[i];
                const lower = siblings[i + 1];

                // Connected if upper's endTime === lower's startTime
                if (upper.endTime === lower.startTime) {
                    const upperEl = this._elements.get(upper.id);
                    const lowerEl = this._elements.get(lower.id);

                    if (upperEl && lowerEl) {
                        upperEl.classList.add('sc-event--connected-bottom');
                        lowerEl.classList.add('sc-event--connected-top');
                    }
                }
            }
        }
    }

    /**
     * Remove all rendered events
     */
    _clearAll() {
        for (const el of this._elements.values()) {
            el.remove();
        }
        this._elements.clear();
    }

    /**
     * Cleanup
     */
    destroy() {
        this._clearAll();
        for (const unsub of this._unsubscribers) {
            unsub();
        }
        this._unsubscribers = [];
        this.container = null;
    }
}
