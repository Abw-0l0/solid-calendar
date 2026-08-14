/**
 * ResourceColumnBuilder — Builds columns for resource views
 *
 * Creates one column per resource (staff/room/equipment) with a colored
 * header dot, title, and a relatively-positioned body for event placement.
 *
 * Supports two modes:
 * - Flat mode (day view): one column per resource
 * - Grouped mode (multi-day): date groups, each containing resource sub-columns
 */
import { SLOT_HEIGHT, SLOT_INTERVAL, DEFAULT_BUSINESS_HOURS, RESOURCE_MODES, RESOURCE_TYPES, isFlatMode } from '../core/CalendarConfig.js';
import { convertTimeToMinutes, parseLocalDate, isToday, getLocale, getWeekdayNames } from '../utils/temporal.js';
import { resolveHoliday, resolveHolidayName } from '../utils/holidays.js';

export default class ResourceColumnBuilder {
    /**
     * @param {import('../core/CalendarState.js').default} state
     * @param {import('../core/EventBus.js').default} bus
     * @param {object} config
     */
    constructor(state, bus, config) {
        this.state = state;
        this.bus = bus;
        this.config = config;
        this.container = null;
        /** @type {Map<string, HTMLElement>} */
        this._columnMap = new Map();
        /** @type {string[]|null} */
        this._dates = null;
        this._handleDateHeaderClick = null;
    }

    /**
     * Build resource columns inside the columns container (flat mode — single day)
     * @param {HTMLElement} container - The .sc-columns-container element
     * @param {Array} [resources] - Override resources (defaults to state)
     */
    init(container, resources) {
        this.container = container;
        this._columnMap.clear();
        this._dates = null;
        this._render(resources ?? this.state.resources);
    }

    /**
     * Build grouped resource columns (multi-day mode — date groups with sub-columns)
     * @param {HTMLElement} container - The .sc-columns-container element
     * @param {string[]} dates - Array of 'YYYY-MM-DD' strings
     * @param {Array} [resources] - Override resources (defaults to state)
     */
    initGrouped(container, dates, resources) {
        this.container = container;
        this._columnMap.clear();
        this._dates = dates;
        this._renderGrouped(resources ?? this.state.resources, dates);
    }

    /**
     * Filter resources based on the current resource mode
     * @param {Array} resources
     * @returns {Array}
     */
    _filterByMode(resources) {
        const mode = RESOURCE_MODES[this.state.currentResourceMode];
        if (!mode || mode.type === 'both' || mode.type === 'flat') {
            return resources;
        }
        return resources.filter((r) => r.type === mode.type);
    }

    /**
     * Flat render — one column per resource (day view)
     * @param {Array} resources
     */
    _render(resources) {
        if (!this.container) {
            return;
        }

        this.container.textContent = '';

        const filtered = this._filterByMode(resources);
        for (const resource of filtered) {
            const column = this._createColumn(resource);
            this.container.appendChild(column);
            this._columnMap.set(resource.id, column);
        }
    }

    /**
     * Grouped render — date groups with resource sub-columns (multi-day view)
     * @param {Array} resources
     * @param {string[]} dates
     */
    _renderGrouped(resources, dates) {
        if (!this.container) {
            return;
        }

        this.container.textContent = '';

        const filtered = this._filterByMode(resources);
        const locale = getLocale(this.config.locale);
        const weekdayNames = getWeekdayNames(locale);

        this._handleDateHeaderClick = (e) => {
            const cell = e.target.closest('.sc-date-group-header');
            if (cell?.dataset.date) {
                this.bus.emit('dateHeader:click', { date: cell.dataset.date });
            }
        };

        for (const dateStr of dates) {
            const group = this._createDateGroup(dateStr, filtered, weekdayNames, locale);
            this.container.appendChild(group);
        }

        this.container.addEventListener('click', this._handleDateHeaderClick);
    }

    /**
     * Create a date group containing a header and resource sub-columns
     * @param {string} dateStr
     * @param {Array} resources
     * @param {string[]} weekdayNames
     * @param {string} locale
     * @returns {HTMLElement}
     */
    _createDateGroup(dateStr, resources, weekdayNames, locale) {
        const group = document.createElement('div');
        group.className = 'sc-date-group';
        group.dataset.date = dateStr;

        // Date group header
        const header = this._createDateGroupHeader(dateStr, weekdayNames, locale);
        group.appendChild(header);

        // Resource sub-columns container
        const columnsRow = document.createElement('div');
        columnsRow.className = 'sc-date-group-columns';

        for (const resource of resources) {
            const column = this._createColumn(resource, dateStr);
            columnsRow.appendChild(column);
            // Key: "resourceId::date" for multi-day lookup
            this._columnMap.set(`${resource.id}::${dateStr}`, column);
        }

        group.appendChild(columnsRow);
        return group;
    }

    /**
     * Create date group header cell
     * @param {string} dateStr
     * @param {string[]} weekdayNames
     * @param {string} locale
     * @returns {HTMLElement}
     */
    _createDateGroupHeader(dateStr, weekdayNames, locale) {
        const header = document.createElement('div');
        header.className = 'sc-date-group-header date-header-clickable';
        header.dataset.date = dateStr;

        const date = parseLocalDate(dateStr);
        const dayOfWeek = date.dayOfWeek; // 1=Mon..7=Sun
        const isSaturday = dayOfWeek === 6;
        const isSunday = dayOfWeek === 7;
        const todayFlag = isToday(dateStr);
        const holiday = resolveHoliday(dateStr, this.state, this.config);

        if (todayFlag) {
            header.classList.add('sc-date-group-header--today');
        }
        if (holiday || isSunday) {
            header.classList.add('sc-date-group-header--holiday');
        } else if (isSaturday) {
            header.classList.add('sc-date-group-header--saturday');
        }

        const weekdayIndex = dayOfWeek === 7 ? 0 : dayOfWeek;
        const weekday = weekdayNames[weekdayIndex] ?? '';
        const month = String(date.month).padStart(2, '0');
        const day = String(date.day).padStart(2, '0');

        const textEl = document.createElement('span');
        textEl.className = 'sc-date-group-header-text';
        textEl.textContent = `${month}/${day}(${weekday})`;
        header.appendChild(textEl);

        if (holiday) {
            const holidayEl = document.createElement('span');
            holidayEl.className = 'sc-date-group-header-holiday';
            holidayEl.textContent = resolveHolidayName(dateStr, locale, this.state, this.config);
            header.appendChild(holidayEl);
        }

        return header;
    }

    /**
     * Create a single resource column
     * @param {object} resource
     * @param {string} [dateStr] - Date for multi-day grouped columns
     * @returns {HTMLElement}
     */
    _createColumn(resource, dateStr) {
        const column = document.createElement('div');
        column.className = 'sc-column';
        column.dataset.resourceId = resource.id;
        if (dateStr) {
            column.dataset.date = dateStr;
        }

        const header = this._createHeader(resource);
        column.appendChild(header);

        const body = this._createBody(resource);
        column.appendChild(body);

        return column;
    }

    /**
     * Create column header with color dot and title
     * @param {object} resource
     * @returns {HTMLElement}
     */
    _createHeader(resource) {
        const header = document.createElement('div');
        header.className = 'sc-column-header';

        const dot = document.createElement('span');
        dot.className = 'sc-color-dot';
        dot.style.backgroundColor = resource.color ?? '#6b7280';
        header.appendChild(dot);

        const title = document.createElement('span');
        title.className = 'sc-column-title';
        title.textContent = resource.title ?? '';
        header.appendChild(title);

        return header;
    }

    /**
     * Create column body with correct height for time slots
     * @param {object} resource
     * @returns {HTMLElement}
     */
    _createBody(_resource) {
        const body = document.createElement('div');
        body.className = 'sc-column-body';

        const startMinutes = convertTimeToMinutes(DEFAULT_BUSINESS_HOURS.start);
        const endMinutes = convertTimeToMinutes(DEFAULT_BUSINESS_HOURS.end);
        const slotCount = Math.ceil((endMinutes - startMinutes) / SLOT_INTERVAL);
        const totalHeight = slotCount * SLOT_HEIGHT;

        body.style.height = `${totalHeight}px`;

        return body;
    }

    /**
     * Get the column element for a given resource ID (flat mode)
     * @param {string} resourceId
     * @returns {HTMLElement|null}
     */
    getColumnForResource(resourceId) {
        return this._columnMap.get(resourceId) ?? null;
    }

    /**
     * Get the column body for a given resource ID (flat mode)
     * @param {string} resourceId
     * @returns {HTMLElement|null}
     */
    getColumnBodyForResource(resourceId) {
        const column = this._columnMap.get(resourceId);
        return column?.querySelector('.sc-column-body') ?? null;
    }

    /**
     * Get all column entries
     * @returns {Map<string, HTMLElement>}
     */
    getColumnMap() {
        return this._columnMap;
    }

    /**
     * Apply staff filter — hide/show columns based on selected staff IDs
     * @param {string[]} staffIds - checked staff IDs
     */
    applyStaffFilter(staffIds) {
        const mode = this.state.currentResourceMode;
        if (isFlatMode(mode)) {
            return;
        }

        const staffSet = new Set(staffIds.map(String));

        for (const [, column] of this._columnMap) {
            const resourceId = column.dataset.resourceId;
            const resource = this.state.resources.find((r) => String(r.id) === String(resourceId));
            if (!resource) {
                continue;
            }

            if (resource.type === RESOURCE_TYPES.RESOURCE) {
                column.style.display = '';
                continue;
            }

            column.style.display = staffSet.has(String(resourceId)) ? '' : 'none';
        }

        // Grouped mode: hide date groups where all sub-columns are hidden
        if (this._dates && this.container) {
            for (const group of this.container.querySelectorAll('.sc-date-group')) {
                const cols = group.querySelectorAll('.sc-column');
                const allHidden = [...cols].every((c) => c.style.display === 'none');
                group.style.display = allHidden ? 'none' : '';
            }
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.container) {
            this.container.removeEventListener('click', this._handleDateHeaderClick);
            this.container.textContent = '';
        }
        this._columnMap.clear();
        this._dates = null;
        this._handleDateHeaderClick = null;
        this.container = null;
    }
}
