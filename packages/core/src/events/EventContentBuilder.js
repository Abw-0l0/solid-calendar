/**
 * EventContentBuilder — Builds DOM content inside each .sc-event element
 *
 * Creates the visual representation of an event card including
 * text fields (client name, time, service, etc.), badges, color styling,
 * and resize handle. Respects card display settings for field visibility
 * and ordering. Uses document.createElement exclusively — NEVER innerHTML.
 */
import { translate } from '../core/Translations.js';

/**
 * A field id, reduced to something safe to append to a class name.
 * @param {string} id
 * @returns {string}
 */
function cssSafe(id) {
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '-');
}
import { lightenColor, getGroupColor } from '../utils/ColorUtils.js';
import { formatTimeRange, timeDiff } from '../utils/temporal.js';

export default class EventContentBuilder {
    /**
     * @param {import('../core/CalendarState.js').default} state
     * @param {import('../core/EventBus.js').default} bus
     * @param {object} config
     */
    constructor(state, bus, config) {
        this.state = state;
        this.bus = bus;
        this.config = config;
    }

    /**
     * Pre-compute group counts for all events to avoid O(n²) filtering per event.
     * @param {Array} events - InternalEvent[]
     * @returns {Map<string, number>} key is `${groupId}_${date}`, value is count
     */
    buildGroupCountMap(events) {
        const map = new Map();
        for (const event of events) {
            const groupId = event.groupId;
            if (!groupId) continue;
            const key = `${groupId}_${event.date}`;
            map.set(key, (map.get(key) ?? 0) + 1);
        }
        return map;
    }

    /**
     * Build a complete .sc-event element for an InternalEvent
     * @param {object} event - InternalEvent
     * @param {Map<string, number>} [groupCountMap] - pre-computed group counts (from buildGroupCountMap)
     * @returns {HTMLElement}
     */
    build(event, groupCountMap) {
        const el = document.createElement('div');
        el.className = this._buildClassName(event);
        el.dataset.eventId = event.id;

        // Color styling
        el.style.borderLeftColor = event.color;
        el.style.backgroundColor = lightenColor(event.color, 0.85);
        const content = document.createElement('div');
        content.className = 'sc-event-content';

        // Build text fields and badges using card display settings
        this._buildTextFields(content, event);
        this._buildBadges(content, event);

        el.appendChild(content);

        // Group indicator triangle (multi-event bookings)
        const groupId = event.groupId;
        if (groupId) {
            const key = `${groupId}_${event.date}`;
            const sameDateGroupCount = groupCountMap?.get(key) ?? 0;
            if (sameDateGroupCount > 1) {
                const color = getGroupColor(groupId);
                if (color) {
                    const triangle = document.createElement('div');
                    triangle.className = 'sc-event-group-indicator';
                    triangle.style.borderColor = `transparent ${color} transparent transparent`;
                    triangle.title = translate(this.config.translations, 'groupedAppointment');
                    el.appendChild(triangle);
                }
            }
        }

        // Resize handle
        const handle = document.createElement('div');
        handle.className = 'sc-event-resize-handle';
        el.appendChild(handle);

        return el;
    }

    /**
     * Build text fields into the content container based on card display settings.
     * Falls back to hardcoded behavior when no settings are available.
     * @param {HTMLElement} content - the sc-event-content container
     * @param {object} event - InternalEvent
     */
    _buildTextFields(content, event) {
        const settings = this.state.cardDisplaySettings;

        // Time block events always show title only (no configurable fields)
        if (event.isTimeBlock) {
            const title = document.createElement('div');
            title.className = 'sc-event-title';
            title.textContent = event.title ?? '';
            content.appendChild(title);

            const durationMinutes = timeDiff(event.startTime, event.endTime);
            const time = document.createElement('div');
            time.className = 'sc-event-time';
            time.textContent = formatTimeRange(event.startTime, durationMinutes, this.config?.locale);
            content.appendChild(time);
            return;
        }

        // No card settings — fall back to original hardcoded behavior
        if (!settings?.textItems) {
            this._buildLegacyTextFields(content, event);
            return;
        }

        const privacyMode = this.state.privacyMode;
        const suppressedIds = this.config.privacySuppression?.textFieldIds ?? [];

        // Get visible text items sorted by order
        const visibleItems = [...settings.textItems]
            .filter((item) => item.visible)
            .sort((a, b) => a.order - b.order);

        let isFirst = true;
        for (const item of visibleItems) {
            const fieldEl = document.createElement('div');
            const value = this._getTextFieldValue(item.id, event);

            if (value === null || value === undefined || value === '') {
                continue;
            }

            // Assign appropriate CSS class
            if (isFirst) {
                fieldEl.className = 'sc-event-title';
                isFirst = false;
            } else if (item.id === 'time') {
                fieldEl.className = 'sc-event-time';
            } else {
                fieldEl.className = `sc-event-field sc-event-field--${cssSafe(item.id)}`;
            }

            fieldEl.textContent = value;
            fieldEl.dataset.fieldId = item.id;

            // Apply privacy blur
            if (privacyMode && suppressedIds.includes(item.id)) {
                fieldEl.classList.add('sc-privacy-blur');
            }

            content.appendChild(fieldEl);
        }
    }

    /**
     * Get the display value for a text field
     * @param {string} fieldId
     * @param {object} event - InternalEvent
     * @returns {string}
     */
    _getTextFieldValue(fieldId, event) {
        if (fieldId === 'time') {
            const durationMinutes = timeDiff(event.startTime, event.endTime);
            return formatTimeRange(event.startTime, durationMinutes, this.config?.locale);
        }

        // Look up from the resolved textFields on the event
        return event.textFields?.[fieldId] ?? '';
    }

    /**
     * Build badges into the content container based on card display settings.
     * @param {HTMLElement} content - the sc-event-content container
     * @param {object} event - InternalEvent
     */
    _buildBadges(content, event) {
        if (event.isTimeBlock) {
            return;
        }

        const settings = this.state.cardDisplaySettings;
        if (!settings?.badgeItems) {
            return;
        }

        const eventBadges = event.badges ?? [];
        if (eventBadges.length === 0) {
            return;
        }

        const privacyMode = this.state.privacyMode;
        const suppressedBadgeIds = this.config.privacySuppression?.badgeIds ?? [];
        const badgeTypes = this.config.badgeTypes ?? {};

        // Get visible badge items sorted by order
        const visibleBadgeItems = [...settings.badgeItems]
            .filter((item) => item.visible)
            .sort((a, b) => a.order - b.order);

        // Build a lookup of event badges by typeId
        const badgesByType = new Map();
        for (const badge of eventBadges) {
            badgesByType.set(badge.typeId, badge);
        }

        const badgeContainer = document.createElement('div');
        badgeContainer.className = 'sc-event-badges';
        let hasBadges = false;

        for (const item of visibleBadgeItems) {
            const badge = badgesByType.get(item.id);
            if (!badge) {
                continue;
            }

            const typeDef = badgeTypes[item.id];
            if (!typeDef) {
                continue;
            }

            const badgeEl = this._buildBadgeElement(badge, typeDef);
            if (!badgeEl) {
                continue;
            }

            // Apply privacy blur
            if (privacyMode && suppressedBadgeIds.includes(item.id)) {
                badgeEl.classList.add('sc-privacy-blur');
            }

            badgeContainer.appendChild(badgeEl);
            hasBadges = true;
        }

        if (hasBadges) {
            content.appendChild(badgeContainer);
        }
    }

    /**
     * Build a single badge DOM element
     * @param {object} badge - { typeId, label?, tooltip?, count?, meta? }
     * @param {object} typeDef - badge type definition from config.badgeTypes
     * @returns {HTMLElement|null}
     */
    _buildBadgeElement(badge, typeDef) {
        const el = document.createElement('span');
        el.className = `sc-event-badge sc-event-badge--${typeDef.style ?? 'filled'}`;
        el.style.backgroundColor = typeDef.bgColor ?? '';
        el.style.color = typeDef.textColor ?? '';

        if (typeDef.borderColor) {
            el.style.borderColor = typeDef.borderColor;
        }

        if (typeDef.maxWidth) {
            el.style.maxWidth = `${typeDef.maxWidth}px`;
        }

        if (badge.tooltip) {
            el.title = badge.tooltip;
        }

        // Icon
        if (typeof typeDef.createIcon === 'function') {
            el.appendChild(typeDef.createIcon());
        }

        // Secondary icon, e.g. a lock on a grouped booking
        if (badge.meta?.showSecondaryIcon && typeof typeDef.createSecondaryIcon === 'function') {
            el.appendChild(typeDef.createSecondaryIcon());
        }

        // Label text
        if (badge.label) {
            const labelSpan = document.createElement('span');
            labelSpan.className = 'sc-event-badge-label';
            labelSpan.textContent = badge.label;
            el.appendChild(labelSpan);
        }

        // Count, e.g. how many secondary resources a booking occupies
        if (badge.count !== undefined && badge.count !== null) {
            const countSpan = document.createElement('span');
            countSpan.className = 'sc-event-badge-count';
            countSpan.textContent = `(${badge.count})`;
            el.appendChild(countSpan);
        }

        return el;
    }

    /**
     * Legacy text field builder — used when no card display settings are available.
     * Preserves original hardcoded behavior for backward compatibility.
     * @param {HTMLElement} content
     * @param {object} event - InternalEvent
     */
    _buildLegacyTextFields(content, event) {
        // Title (client name)
        const title = document.createElement('div');
        title.className = 'sc-event-title';
        title.textContent = this._getDisplayTitle(event);
        content.appendChild(title);

        // Time range
        const time = document.createElement('div');
        time.className = 'sc-event-time';
        const durationMinutes = timeDiff(event.startTime, event.endTime);
        time.textContent = formatTimeRange(event.startTime, durationMinutes, this.config?.locale);
        content.appendChild(time);

        // Service name (appointments only)
        if (event.serviceName) {
            const service = document.createElement('div');
            service.className = 'sc-event-service';
            service.textContent = event.serviceName;
            content.appendChild(service);
        }
    }

    /**
     * Update an existing event element with new data.
     * Rebuilds the content container to reflect current settings.
     * @param {HTMLElement} el - existing .sc-event element
     * @param {object} event - updated InternalEvent
     */
    update(el, event) {
        el.className = this._buildClassName(event);
        el.style.borderLeftColor = event.color;
        el.style.backgroundColor = lightenColor(event.color, 0.85);

        // Replace the content container entirely to respect current settings
        const oldContent = el.querySelector('.sc-event-content');
        if (oldContent) {
            const content = document.createElement('div');
            content.className = 'sc-event-content';
            this._buildTextFields(content, event);
            this._buildBadges(content, event);
            oldContent.replaceWith(content);
        }
    }

    /**
     * Build CSS class string for an event
     * @param {object} event - InternalEvent
     * @returns {string}
     */
    _buildClassName(event) {
        const classes = ['sc-event', '', ''];

        if (event.isCancelled) {
            classes.push('sc-event--cancelled');
        }
        if (event.isTimeBlock) {
            classes.push('sc-event--timeblock');
        }
        if (event.isSecondaryResourceEvent) {
            classes.push('sc-event--secondary');
        }

        return classes.join(' ');
    }

    /**
     * Get the display title for an event
     * Strips newline separators used internally for multi-line rendering
     * @param {object} event - InternalEvent
     * @returns {string}
     */
    _getDisplayTitle(event) {
        if (event.isTimeBlock) {
            return event.title ?? '';
        }

        // The client name, kept by the mapper rather than recovered by splitting
        // the composed title on a newline.
        return event.clientName || (event.title ?? '').split('\n')[0] || '';
    }

    init() {}
    destroy() {}
}
