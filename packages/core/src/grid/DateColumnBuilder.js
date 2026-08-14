/**
 * DateColumnBuilder — Builds columns for simple (non-resource) date views
 *
 * Each column represents a date with header showing day number + weekday.
 * Highlights today, holidays, and saturdays with appropriate CSS classes.
 */
import { resolveHolidayName } from '../utils/holidays.js';
import { SLOT_HEIGHT, SLOT_INTERVAL, DEFAULT_BUSINESS_HOURS } from '../core/CalendarConfig.js';
import { parseLocalDate, isToday, convertTimeToMinutes, addDaysToString, getWeekdayNames, getLocale } from '../utils/temporal.js';

export default class DateColumnBuilder {
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
    }

    /**
     * Build date columns inside the columns container
     * @param {HTMLElement} container - The .sc-columns-container element
     * @param {string[]} [dates] - Override dates (defaults to state dateRange)
     */
    init(container, dates) {
        this.container = container;
        this._columnMap.clear();

        const datesToRender = dates ?? this._getDatesFromState();
        this._render(datesToRender);
    }

    /**
     * Compute dates from state dateRange
     * @returns {string[]}
     */
    _getDatesFromState() {
        const { start, end } = this.state.dateRange;
        const dates = [];
        let current = start;

        while (current <= end) {
            dates.push(current);
            current = addDaysToString(current, 1);
        }

        return dates;
    }

    /**
     * @param {string[]} dates
     */
    _render(dates) {
        if (!this.container) {
            return;
        }

        this.container.textContent = '';
        const locale = getLocale(this.config?.locale);
        const weekdayNames = getWeekdayNames(locale);

        for (const dateStr of dates) {
            const column = this._createColumn(dateStr, weekdayNames, locale);
            this.container.appendChild(column);
            this._columnMap.set(dateStr, column);
        }
    }

    /**
     * Create a single date column
     * @param {string} dateStr - 'YYYY-MM-DD'
     * @param {string[]} weekdayNames
     * @param {string} locale
     * @returns {HTMLElement}
     */
    _createColumn(dateStr, weekdayNames, locale) {
        const column = document.createElement('div');
        column.className = 'sc-column';
        column.dataset.date = dateStr;

        const header = this._createHeader(dateStr, weekdayNames, locale);
        column.appendChild(header);

        const body = this._createBody();
        column.appendChild(body);

        return column;
    }

    /**
     * Create column header with day number and weekday
     * @param {string} dateStr
     * @param {string[]} weekdayNames
     * @param {string} locale
     * @returns {HTMLElement}
     */
    _createHeader(dateStr, weekdayNames, locale) {
        const header = document.createElement('div');
        header.className = 'sc-column-header';

        const date = parseLocalDate(dateStr);
        const dayOfWeek = date.dayOfWeek; // 1=Mon ... 7=Sun
        const isSaturday = dayOfWeek === 6;
        const isSunday = dayOfWeek === 7;
        const holidayName = resolveHolidayName(dateStr, locale, this.state, this.config);
        const todayFlag = isToday(dateStr);

        if (todayFlag) {
            header.classList.add('sc-date-header-cell--today');
        }
        if (holidayName || isSunday) {
            header.classList.add('sc-date-header-cell--holiday');
        }
        if (isSaturday) {
            header.classList.add('sc-date-header-cell--saturday');
        }

        const dayNumber = document.createElement('span');
        dayNumber.className = 'sc-date-header-day';
        dayNumber.textContent = String(date.day);
        header.appendChild(dayNumber);

        const weekday = document.createElement('span');
        weekday.className = 'sc-date-header-weekday';
        // dayOfWeek is 1-based (Mon=1), weekdayNames is 0-based (Sun=0)
        const weekdayIndex = dayOfWeek === 7 ? 0 : dayOfWeek;
        weekday.textContent = weekdayNames[weekdayIndex] ?? '';
        header.appendChild(weekday);

        if (holidayName) {
            const holiday = document.createElement('span');
            holiday.className = 'sc-date-header-holiday';
            holiday.textContent = holidayName;
            header.appendChild(holiday);
        }

        return header;
    }

    /**
     * Create column body with correct height
     * @returns {HTMLElement}
     */
    _createBody() {
        const body = document.createElement('div');
        body.className = 'sc-column-body';

        const hours = DEFAULT_BUSINESS_HOURS;
        const startMinutes = convertTimeToMinutes(hours.start);
        const endMinutes = convertTimeToMinutes(hours.end);
        const slotCount = Math.ceil((endMinutes - startMinutes) / SLOT_INTERVAL);
        const totalHeight = slotCount * SLOT_HEIGHT;

        body.style.height = `${totalHeight}px`;

        return body;
    }

    /**
     * Get the column element for a given date
     * @param {string} dateStr - 'YYYY-MM-DD'
     * @returns {HTMLElement|null}
     */
    getColumnForDate(dateStr) {
        return this._columnMap.get(dateStr) ?? null;
    }

    /**
     * Get the column body for a given date
     * @param {string} dateStr - 'YYYY-MM-DD'
     * @returns {HTMLElement|null}
     */
    getColumnBodyForDate(dateStr) {
        const column = this._columnMap.get(dateStr);
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
     * Cleanup
     */
    destroy() {
        if (this.container) {
            this.container.textContent = '';
        }
        this._columnMap.clear();
        this.container = null;
    }
}
