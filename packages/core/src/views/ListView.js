/**
 * ListView — Tabular event list view
 *
 * Renders events as table rows grouped by date with day headers.
 * Columns: Time, Client, Resource, Service, Status.
 * Sorted by date then start time. Shows empty state when no events.
 */
import { createTranslator } from '../core/Translations.js';
import { DURATION_DAYS } from '../core/CalendarConfig.js';
import { addDaysToString, parseLocalDate, isToday, getLocale, formatDateJapanese, formatTimeRange, timeDiff, getWeekdayNames, isSameDay } from '../utils/temporal.js';
import { resolveHoliday, resolveHolidayName } from '../utils/holidays.js';

export default class ListView {
    /**
     * @param {import('../core/CalendarState.js').default} state
     * @param {import('../core/EventBus.js').default} bus
     * @param {object} config
     */
    constructor(state, bus, config) {
        this.state = state;
        this.bus = bus;
        this.config = config;
        this._t = createTranslator(config);
        this.container = null;

        /** @type {HTMLElement|null} */
        this._viewEl = null;
        /** @type {HTMLTableElement|null} */
        this._tableEl = null;
        this._unsubs = [];
        this._handleClick = this._onClick.bind(this);
    }

    /**
     * Build the list view inside the container
     * @param {HTMLElement} container
     */
    init(container) {
        this.container = container;

        this._viewEl = document.createElement('div');
        this._viewEl.className = 'sc-view sc-view--list';
        this.container.appendChild(this._viewEl);

        this._render();
        this._attachListeners();
    }

    /**
     * Render the full list table
     */
    _render() {
        const dates = this._getViewDates();
        const events = this._getEventsForRange(dates);
        const locale = getLocale(this.config.locale);
        const isJa = locale === 'ja-JP';

        if (events.length === 0) {
            this._renderEmptyState();
            return;
        }

        this._tableEl = document.createElement('table');
        this._tableEl.className = 'sc-list';

        this._renderTableHeader();
        this._renderTableBody(dates, events, locale, isJa);

        this._viewEl.appendChild(this._tableEl);
    }

    /** Render the table header row. */
    _renderTableHeader() {
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        tr.className = 'sc-list-header';

        const headers = [
            this._t('listTime'),
            this._t('listClient'),
            this._t('listResource'),
            this._t('listService'),
            this._t('listStatus'),
        ];

        for (const text of headers) {
            const th = document.createElement('th');
            th.textContent = text;
            tr.appendChild(th);
        }

        thead.appendChild(tr);
        this._tableEl.appendChild(thead);
    }

    /**
     * Render table body with day-grouped rows
     * @param {string[]} dates
     * @param {Array} events
     * @param {string} locale
     * @param {boolean} isJa
     */
    _renderTableBody(dates, events, locale, isJa) {
        const tbody = document.createElement('tbody');
        const weekdayNames = getWeekdayNames(locale);

        for (const dateStr of dates) {
            const dayEvents = events.filter((e) => isSameDay(e.date, dateStr));
            if (dayEvents.length === 0) {
                continue;
            }

            dayEvents.sort((a, b) => (a.startTime < b.startTime ? -1 : 1));

            // Day header row
            const dayHeaderRow = this._createDayHeaderRow(dateStr, weekdayNames, locale, isJa);
            tbody.appendChild(dayHeaderRow);

            // Event rows
            for (const event of dayEvents) {
                const row = this._createEventRow(event);
                tbody.appendChild(row);
            }
        }

        this._tableEl.appendChild(tbody);
    }

    /**
     * Create a day header row
     * @param {string} dateStr
     * @param {string[]} weekdayNames
     * @param {string} locale
     * @param {boolean} isJa
     * @returns {HTMLTableRowElement}
     */
    _createDayHeaderRow(dateStr, weekdayNames, locale, isJa) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.className = 'sc-list-day-header';

        const date = parseLocalDate(dateStr);
        const dayOfWeek = date.dayOfWeek; // 1=Mon..7=Sun
        const weekdayIndex = dayOfWeek === 7 ? 0 : dayOfWeek;
        const weekdayName = weekdayNames[weekdayIndex] ?? '';

        const todayFlag = isToday(dateStr);
        const holiday = resolveHoliday(dateStr, this.state, this.config);
        const isSunday = dayOfWeek === 7;

        let text;
        if (isJa) {
            text = formatDateJapanese(dateStr);
        } else {
            const y = date.year;
            const m = String(date.month).padStart(2, '0');
            const d = String(date.day).padStart(2, '0');
            text = `${y}/${m}/${d} (${weekdayName})`;
        }

        td.textContent = text;

        if (todayFlag) {
            td.classList.add('sc-date-header-cell--today');
        }
        if (holiday || isSunday) {
            td.classList.add('sc-date-header-cell--holiday');
        }

        if (holiday) {
            const holidaySpan = document.createElement('span');
            holidaySpan.className = 'sc-date-header-holiday';
            holidaySpan.textContent = ` ${resolveHolidayName(dateStr, locale, this.state, this.config)}`;
            td.appendChild(holidaySpan);
        }

        tr.appendChild(td);
        return tr;
    }

    /**
     * Display name for a resource id, from the resource records rather than the event.
     * @param {string|null} resourceId
     * @returns {string}
     */
    _resourceTitle(resourceId) {
        if (resourceId == null) return '';
        const match = this.state.resources.find((r) => String(r.id) === String(resourceId));
        return match?.title ?? '';
    }

    /**
     * Create an event row
     * @param {object} event - InternalEvent
     * @returns {HTMLTableRowElement}
     */
    _createEventRow(event) {
        const tr = document.createElement('tr');
        tr.className = 'sc-list-row';
        tr.dataset.eventId = event.id;

        if (event.isCancelled) {
            tr.classList.add('sc-event--cancelled');
        }

        // Time
        const timeTd = document.createElement('td');
        const durationMinutes = timeDiff(event.startTime, event.endTime);
        timeTd.textContent = formatTimeRange(event.startTime, durationMinutes, this.config?.locale);
        tr.appendChild(timeTd);

        // Client
        const clientTd = document.createElement('td');
        clientTd.textContent = event.clientName || event.title || '';
        tr.appendChild(clientTd);

        // Resource. The owner object on an event usually carries only an id and a colour;
        // the display name lives on the resource record, so fall back to that.
        const resourceTd = document.createElement('td');
        resourceTd.textContent = event.resourceOwnerName || this._resourceTitle(event.resourceOwnerId) || '';
        tr.appendChild(resourceTd);

        // Service
        const serviceTd = document.createElement('td');
        serviceTd.textContent = event.serviceName ?? '';
        tr.appendChild(serviceTd);

        // Status indicator
        const statusTd = document.createElement('td');
        const statusDot = document.createElement('span');
        statusDot.className = 'sc-color-dot';
        statusDot.style.backgroundColor = event.color ?? '#6b7280';
        statusTd.appendChild(statusDot);
        tr.appendChild(statusTd);

        return tr;
    }

    /** Render the empty state. */
    _renderEmptyState() {
        const empty = document.createElement('div');
        empty.className = 'sc-list-empty';
        empty.textContent = this._t('listEmpty');
        this._viewEl.appendChild(empty);
    }

    /**
     * Attach event delegation
     */
    _attachListeners() {
        this._viewEl?.addEventListener('click', this._handleClick);

        this._unsubs.push(this.bus.on('events:loaded', () => this._refresh()));
    }

    /**
     * Handle delegated clicks on event rows
     * @param {MouseEvent} e
     */
    _onClick(e) {
        const row = e.target.closest('.sc-list-row');
        if (!row) {
            return;
        }

        const eventId = row.dataset.eventId;
        const event = this.state.events.find((ev) => String(ev.id) === String(eventId));
        if (event) {
            this.bus.emit('event:click', { event, element: row });
        }
    }

    /**
     * Refresh the list when events are updated
     */
    _refresh() {
        if (!this._viewEl) {
            return;
        }

        // Clear existing content
        this._viewEl.textContent = '';
        this._tableEl = null;

        this._render();
    }

    /**
     * Get the date strings for the current view range
     * @returns {string[]}
     */
    _getViewDates() {
        const duration = this.state.viewDuration;
        const dayCount = DURATION_DAYS[duration] ?? 7;
        const dates = [];
        for (let i = 0; i < dayCount; i++) {
            dates.push(addDaysToString(this.state.currentDate, i));
        }
        return dates;
    }

    /**
     * Get events within the date range, sorted
     * @param {string[]} dates
     * @returns {Array}
     */
    _getEventsForRange(dates) {
        if (dates.length === 0) {
            return [];
        }
        const startDate = dates[0];
        const endDate = dates[dates.length - 1];

        return this.state.events.filter((e) => {
            return e.date >= startDate && e.date <= endDate;
        });
    }

    /**
     * Get the grid (not applicable for list view)
     * @returns {null}
     */
    getGrid() {
        return null;
    }

    /**
     * Cleanup listeners and DOM
     */
    destroy() {
        this._viewEl?.removeEventListener('click', this._handleClick);

        for (const unsub of this._unsubs) {
            unsub();
        }
        this._unsubs = [];

        if (this._viewEl) {
            this._viewEl.remove();
        }
        this._viewEl = null;
        this._tableEl = null;
        this.container = null;
    }
}
