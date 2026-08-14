/**
 * DateHeaderRenderer — Renders date headers above grid columns
 *
 * Creates a flex container of date header cells showing day number,
 * weekday name, and holiday info. Highlights today, holidays (red),
 * and saturdays (blue). Click on date header emits dateHeader:click.
 *
 * Holiday lookup is delegated to config.holidayProvider (optional).
 */
import { resolveHoliday, resolveHolidayName } from '../utils/holidays.js';
import { parseLocalDate, isToday, getLocale, getWeekdayNames } from '../utils/temporal.js';

export default class DateHeaderRenderer {
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
        this._headerEl = null;
        this._handleClick = this._onClick.bind(this);
    }

    /**
     * Build the date header inside the container
     * @param {HTMLElement} container
     * @param {string[]} dates - Array of 'YYYY-MM-DD' strings
     */
    init(container, dates) {
        this.container = container;

        this._headerEl = document.createElement('div');
        this._headerEl.className = 'sc-date-header';
        this._headerEl.addEventListener('click', this._handleClick);

        const locale = getLocale(this.config.locale);
        const weekdayNames = getWeekdayNames(locale);

        for (const dateStr of dates) {
            const cell = this._createCell(dateStr, weekdayNames, locale);
            this._headerEl.appendChild(cell);
        }

        this.container.appendChild(this._headerEl);
    }

    /**
     * Create a single date header cell
     * @param {string} dateStr - 'YYYY-MM-DD'
     * @param {string[]} weekdayNames
     * @param {string} locale
     * @returns {HTMLElement}
     */
    _createCell(dateStr, weekdayNames, locale) {
        const cell = document.createElement('div');
        cell.className = 'sc-date-header-cell date-header-clickable';
        cell.dataset.date = dateStr;

        const date = parseLocalDate(dateStr);
        const dayOfWeek = date.dayOfWeek; // 1=Mon..7=Sun
        const isSaturday = dayOfWeek === 6;
        const isSunday = dayOfWeek === 7;
        const todayFlag = isToday(dateStr);

        const holiday = resolveHoliday(dateStr, this.state, this.config);

        if (todayFlag) {
            cell.classList.add('sc-date-header-cell--today');
        }
        if (holiday || isSunday) {
            cell.classList.add('sc-date-header-cell--holiday');
        } else if (isSaturday) {
            cell.classList.add('sc-date-header-cell--saturday');
        }

        // dayOfWeek: 1=Mon..7=Sun; weekdayNames: 0=Sun, 1=Mon..6=Sat
        const weekdayIndex = dayOfWeek === 7 ? 0 : dayOfWeek;
        const weekday = weekdayNames[weekdayIndex] ?? '';
        const month = String(date.month).padStart(2, '0');
        const day = String(date.day).padStart(2, '0');

        const textEl = document.createElement('span');
        textEl.className = 'sc-date-header-text';
        textEl.textContent = `${month}/${day}(${weekday})`;
        cell.appendChild(textEl);

        if (holiday) {
            const holidayEl = document.createElement('div');
            holidayEl.className = 'sc-date-header-holiday';
            holidayEl.textContent = resolveHolidayName(dateStr, locale, this.state, this.config);
            cell.appendChild(holidayEl);
        }

        return cell;
    }

    /**
     * Handle click on date header cell
     * @param {MouseEvent} e
     */
    _onClick(e) {
        const cell = e.target.closest('.sc-date-header-cell');
        if (!cell) return;
        const date = cell.dataset.date;
        if (date) {
            this.bus.emit('dateHeader:click', { date });
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this._headerEl) {
            this._headerEl.removeEventListener('click', this._handleClick);
            this._headerEl.remove();
        }
        this._headerEl = null;
        this.container = null;
    }
}
