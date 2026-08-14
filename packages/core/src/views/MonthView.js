/**
 * MonthView — Month grid view (dayGridMonth)
 *
 * Renders a 7-column CSS grid showing all days of the month.
 * Each cell displays day number and up to 3 event previews with
 * a "+N more" link for overflow. Clicking a day number navigates
 * to day view; clicking an event dot emits event:click.
 */
import { parseLocalDate, isToday, getLocale, getWeekdayNames, getMonthDates, isSameDay } from '../utils/temporal.js';
import { resolveHoliday, resolveHolidayName } from '../utils/holidays.js';

/** Maximum events shown per cell before "+N more" */
const MAX_EVENTS_PER_CELL = 3;

export default class MonthView {
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

        /** @type {HTMLElement|null} */
        this._viewEl = null;
        /** @type {HTMLElement|null} */
        this._gridEl = null;
        this._unsubs = [];
        this._handleClick = this._onClick.bind(this);
    }

    /**
     * Build the month view inside the container
     * @param {HTMLElement} container
     */
    init(container) {
        this.container = container;

        this._viewEl = document.createElement('div');
        this._viewEl.className = 'sc-view sc-view--month';
        this.container.appendChild(this._viewEl);

        this._renderWeekdayHeader();
        this._renderGrid();
        this._attachListeners();
    }

    /**
     * Render the weekday header row (Sun–Sat)
     */
    _renderWeekdayHeader() {
        const locale = getLocale(this.config.locale);
        const weekdayNames = getWeekdayNames(locale);
        const header = document.createElement('div');
        header.className = 'sc-month-weekday-header';

        for (let i = 0; i < 7; i++) {
            const cell = document.createElement('div');
            cell.className = 'sc-month-weekday-cell';
            cell.textContent = weekdayNames[i] ?? '';

            if (i === 0) {
                cell.classList.add('sc-date-header-cell--holiday');
            } else if (i === 6) {
                cell.classList.add('sc-date-header-cell--saturday');
            }

            header.appendChild(cell);
        }

        this._viewEl.appendChild(header);
    }

    /**
     * Render the month grid with day cells
     */
    _renderGrid() {
        this._gridEl = document.createElement('div');
        this._gridEl.className = 'sc-month-grid';

        const currentDate = parseLocalDate(this.state.currentDate);
        const currentMonth = currentDate.month;
        const monthDates = getMonthDates(currentDate.year, currentMonth);
        const locale = getLocale(this.config.locale);
        const events = this.state.events;

        for (const dateStr of monthDates) {
            const cell = this._createCell(dateStr, currentMonth, locale, events);
            this._gridEl.appendChild(cell);
        }

        this._viewEl.appendChild(this._gridEl);
    }

    /**
     * Create a single day cell
     * @param {string} dateStr - 'YYYY-MM-DD'
     * @param {number} currentMonth
     * @param {string} locale
     * @param {Array} events
     * @returns {HTMLElement}
     */
    _createCell(dateStr, currentMonth, locale, events) {
        const cell = document.createElement('div');
        cell.className = 'sc-month-cell';
        cell.dataset.date = dateStr;

        const date = parseLocalDate(dateStr);
        const isCurrentMonth = date.month === currentMonth;
        const todayFlag = isToday(dateStr);
        const dayOfWeek = date.dayOfWeek; // 1=Mon..7=Sun
        const isSunday = dayOfWeek === 7;
        const holiday = resolveHoliday(dateStr, this.state, this.config);

        if (!isCurrentMonth) {
            cell.classList.add('sc-month-cell--other');
        }
        if (todayFlag) {
            cell.classList.add('sc-month-cell--today');
        }

        // Day number
        const dayNumber = document.createElement('div');
        dayNumber.className = 'sc-month-day-number';
        dayNumber.textContent = String(date.day);
        dayNumber.dataset.date = dateStr;

        if (holiday || isSunday) {
            dayNumber.classList.add('sc-date-header-cell--holiday');
        } else if (dayOfWeek === 6) {
            dayNumber.classList.add('sc-date-header-cell--saturday');
        }

        cell.appendChild(dayNumber);

        // Holiday name
        if (holiday) {
            const holidayEl = document.createElement('div');
            holidayEl.className = 'sc-date-header-holiday';
            holidayEl.textContent = resolveHolidayName(dateStr, locale, this.state, this.config);
            cell.appendChild(holidayEl);
        }

        // Events for this date
        const dayEvents = events.filter((e) => isSameDay(e.date, dateStr));
        dayEvents.sort((a, b) => (a.startTime < b.startTime ? -1 : 1));

        const visibleEvents = dayEvents.slice(0, MAX_EVENTS_PER_CELL);
        for (const evt of visibleEvents) {
            const eventEl = this._createEventDot(evt);
            cell.appendChild(eventEl);
        }

        const remaining = dayEvents.length - MAX_EVENTS_PER_CELL;
        if (remaining > 0) {
            const moreEl = document.createElement('div');
            moreEl.className = 'sc-month-more';
            moreEl.textContent = `+${remaining} more`;
            moreEl.dataset.date = dateStr;
            cell.appendChild(moreEl);
        }

        return cell;
    }

    /**
     * Create a compact event element for the month cell
     * @param {object} event - InternalEvent
     * @returns {HTMLElement}
     */
    _createEventDot(event) {
        const el = document.createElement('div');
        el.className = 'sc-month-event';
        el.dataset.eventId = event.id;

        if (event.isCancelled) {
            el.classList.add('sc-event--cancelled');
        }

        el.style.backgroundColor = event.color ? `${event.color}20` : 'rgba(59, 130, 246, 0.12)';
        el.style.borderLeft = `3px solid ${event.color ?? '#3b82f6'}`;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'sc-month-event-time';
        timeSpan.textContent = event.startTime ?? '';
        el.appendChild(timeSpan);

        const titleSpan = document.createElement('span');
        titleSpan.className = 'sc-month-event-title';
        titleSpan.textContent = event.title ?? '';
        el.appendChild(titleSpan);

        return el;
    }

    /**
     * Attach event delegation
     */
    _attachListeners() {
        this._viewEl?.addEventListener('click', this._handleClick);

        this._unsubs.push(this.bus.on('events:loaded', () => this._refresh()));
    }

    /**
     * Handle delegated clicks
     * @param {MouseEvent} e
     */
    _onClick(e) {
        // Click on event
        const eventEl = e.target.closest('.sc-month-event');
        if (eventEl) {
            const eventId = eventEl.dataset.eventId;
            const event = this.state.events.find((ev) => String(ev.id) === String(eventId));
            if (event) {
                this.bus.emit('event:click', { event, element: eventEl });
            }
            return;
        }

        // Click on day number → switch to day view
        const dayNumber = e.target.closest('.sc-month-day-number');
        if (dayNumber) {
            const date = dayNumber.dataset.date;
            if (date) {
                this.bus.emit('dateHeader:click', { date });
            }
            return;
        }

        // Click on "+N more" → switch to day view
        const moreEl = e.target.closest('.sc-month-more');
        if (moreEl) {
            const date = moreEl.dataset.date;
            if (date) {
                this.bus.emit('dateHeader:click', { date });
            }
        }
    }

    /**
     * Refresh the grid when events are updated
     */
    _refresh() {
        if (!this._viewEl || !this._gridEl) {
            return;
        }

        this._gridEl.remove();
        this._gridEl = null;
        this._renderGrid();
    }

    /**
     * Get the grid (not applicable for month view)
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
        this._gridEl = null;
        this.container = null;
    }
}
