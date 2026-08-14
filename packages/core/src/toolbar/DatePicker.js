/**
 * DatePicker — Mini calendar dropdown for jumping to any date
 *
 * Opens from the title button in DateNavigation. Renders a month grid
 * with prev/next month navigation and a "Return to today" button.
 */
import { createTranslator } from '../core/Translations.js';
import {
    getCurrentDate,
    getWeekdayNames,
    getMonthRange,
    parseLocalDate,
    isToday,
    isSameDay,
    getLocale
} from '../utils/temporal.js';

/** English month names for header display */
const MONTH_NAMES_EN = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export default class DatePicker {
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

        this._triggerEl = null;
        this._mountEl = null;
        this._dropdown = null;
        this._headerLabel = null;
        this._weekdaysContainer = null;
        this._gridContainer = null;

        this._displayedYear = 0;
        this._displayedMonth = 0;
        this._isOpen = false;

        this._handleTriggerClick = null;
        this._handleOutsideClick = null;
        this._unsubs = [];
    }

    /**
     * Build and mount the date picker dropdown
     * @param {HTMLElement} triggerEl - The title button that toggles the dropdown
     * @param {HTMLElement} mountEl - Container for absolute positioning
     */
    init(triggerEl, mountEl) {
        this._triggerEl = triggerEl;
        this._mountEl = mountEl;
        mountEl.style.position = 'relative';

        this._dropdown = this._buildDropdown();
        mountEl.appendChild(this._dropdown);

        this._handleTriggerClick = (e) => {
            e.stopPropagation();
            this._toggle();
        };
        triggerEl.addEventListener('click', this._handleTriggerClick);

        this._handleOutsideClick = (e) => {
            if (!this._dropdown.contains(e.target) && !triggerEl.contains(e.target)) {
                this._close();
            }
        };
        document.addEventListener('click', this._handleOutsideClick);

        this._unsubs.push(
            this.bus.on('date:changed', () => {
                if (this._isOpen) {
                    this._syncFromState();
                    this._render();
                }
            })
        );
    }

    /**
     * Build the dropdown DOM structure
     * @returns {HTMLElement}
     */
    _buildDropdown() {
        const dropdown = document.createElement('div');
        dropdown.className = 'sc-datepicker';

        // Header: prev / month-year / next
        const header = document.createElement('div');
        header.className = 'sc-datepicker-header';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'sc-datepicker-nav';
        prevBtn.type = 'button';
        prevBtn.textContent = '\u2039';
        prevBtn.setAttribute('aria-label', this._t('previousMonthText'));
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._shiftMonth(-1);
        });

        this._headerLabel = document.createElement('span');
        this._headerLabel.className = 'sc-datepicker-month-year';

        const nextBtn = document.createElement('button');
        nextBtn.className = 'sc-datepicker-nav';
        nextBtn.type = 'button';
        nextBtn.textContent = '\u203A';
        nextBtn.setAttribute('aria-label', this._t('nextMonthText'));
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._shiftMonth(1);
        });

        header.appendChild(prevBtn);
        header.appendChild(this._headerLabel);
        header.appendChild(nextBtn);

        // Weekday headers
        this._weekdaysContainer = document.createElement('div');
        this._weekdaysContainer.className = 'sc-datepicker-weekdays';

        // Day grid
        this._gridContainer = document.createElement('div');
        this._gridContainer.className = 'sc-datepicker-grid';

        // Today button
        const todayBtn = document.createElement('button');
        todayBtn.className = 'sc-datepicker-today-btn';
        todayBtn.type = 'button';
        todayBtn.textContent = this._t('returnToTodayText');
        todayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._onTodayClick();
        });

        dropdown.appendChild(header);
        dropdown.appendChild(this._weekdaysContainer);
        dropdown.appendChild(this._gridContainer);
        dropdown.appendChild(todayBtn);

        return dropdown;
    }

    /**
     * Sync displayed month/year from calendar state
     */
    _syncFromState() {
        const [year, month] = this.state.currentDate.split('-').map(Number);
        this._displayedYear = year;
        this._displayedMonth = month;
    }

    _open() {
        this._syncFromState();
        this._render();
        this._dropdown.classList.add('sc-dropdown--open');
        this._triggerEl.setAttribute('aria-expanded', 'true');
        this._isOpen = true;
    }

    _close() {
        this._dropdown.classList.remove('sc-dropdown--open');
        this._triggerEl.setAttribute('aria-expanded', 'false');
        this._isOpen = false;
    }

    _toggle() {
        if (this._isOpen) {
            this._close();
        } else {
            this._open();
        }
    }

    /**
     * Render the full dropdown content
     */
    _render() {
        this._renderMonthYear();
        this._renderWeekdays();
        this._renderGrid();
    }

    _renderMonthYear() {
        const locale = getLocale(this.config.locale);
        if (locale === 'ja-JP') {
            this._headerLabel.textContent = `${this._displayedYear}\u5E74${this._displayedMonth}\u6708`;
        } else {
            this._headerLabel.textContent = `${MONTH_NAMES_EN[this._displayedMonth - 1]} ${this._displayedYear}`;
        }
    }

    _renderWeekdays() {
        while (this._weekdaysContainer.firstChild) {
            this._weekdaysContainer.removeChild(this._weekdaysContainer.firstChild);
        }

        const names = getWeekdayNames(this.config.locale);
        for (let i = 0; i < 7; i++) {
            const span = document.createElement('span');
            span.className = 'sc-datepicker-weekday';
            span.textContent = names[i];
            if (i === 0) {
                span.classList.add('sc-datepicker-weekday--sunday');
            }
            if (i === 6) {
                span.classList.add('sc-datepicker-weekday--saturday');
            }
            this._weekdaysContainer.appendChild(span);
        }
    }

    _renderGrid() {
        while (this._gridContainer.firstChild) {
            this._gridContainer.removeChild(this._gridContainer.firstChild);
        }

        const year = this._displayedYear;
        const month = this._displayedMonth;
        const { daysInMonth } = getMonthRange(year, month);

        // Calculate padding from previous month
        const firstDayStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const firstDayParsed = parseLocalDate(firstDayStr);
        // Temporal dayOfWeek: 1=Mon..7=Sun → convert to Sun=0 convention
        const firstDayOfWeek = firstDayParsed.dayOfWeek === 7 ? 0 : firstDayParsed.dayOfWeek;

        // Previous month days for padding
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const { daysInMonth: prevDaysInMonth } = getMonthRange(prevYear, prevMonth);

        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const day = prevDaysInMonth - i;
            const btn = this._createDayButton(day, true, null);
            this._gridContainer.appendChild(btn);
        }

        // Current month days
        const currentDate = this.state.currentDate;
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const btn = this._createDayButton(day, false, dateStr);

            if (isSameDay(dateStr, currentDate)) {
                btn.classList.add('sc-datepicker-day--selected');
            }
            if (isToday(dateStr)) {
                btn.classList.add('sc-datepicker-day--today');
            }

            // dayOfWeek for this date
            const parsed = parseLocalDate(dateStr);
            const dow = parsed.dayOfWeek === 7 ? 0 : parsed.dayOfWeek;
            if (dow === 0) {
                btn.classList.add('sc-datepicker-day--sunday');
            }
            if (dow === 6) {
                btn.classList.add('sc-datepicker-day--saturday');
            }

            this._gridContainer.appendChild(btn);
        }

        // Next month padding to complete the grid rows
        const totalCells = firstDayOfWeek + daysInMonth;
        const remainder = totalCells % 7;
        if (remainder > 0) {
            const fill = 7 - remainder;
            for (let i = 1; i <= fill; i++) {
                const btn = this._createDayButton(i, true, null);
                this._gridContainer.appendChild(btn);
            }
        }
    }

    /**
     * Create a day button element
     * @param {number} day
     * @param {boolean} isOther - whether this day is from another month
     * @param {string|null} dateStr - 'YYYY-MM-DD' or null for disabled
     * @returns {HTMLButtonElement}
     */
    _createDayButton(day, isOther, dateStr) {
        const btn = document.createElement('button');
        btn.className = 'sc-datepicker-day';
        btn.type = 'button';
        btn.textContent = day;

        if (isOther) {
            btn.classList.add('sc-datepicker-day--other');
            btn.disabled = true;
        } else if (dateStr) {
            btn.dataset.date = dateStr;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._onDayClick(dateStr);
            });
        }

        return btn;
    }

    _onDayClick(dateStr) {
        this.state.setCurrentDate(dateStr);
        this._close();
    }

    /**
     * Step the displayed month without touching the selected date.
     *
     * Uses parseLocalDate().add() rather than addMonths(), which returns a 'YYYY-MM-DD'
     * string: reading .year and .month off that string gave undefined, and undefined
     * propagated silently rather than throwing. getMonthRange produced daysInMonth: NaN,
     * the day loop never ran, and the picker rendered a header reading "undefined
     * undefined" over an empty grid — with no way back, since every later click recomputed
     * from the same corrupted pair.
     */
    _shiftMonth(direction) {
        const dateStr = `${this._displayedYear}-${String(this._displayedMonth).padStart(2, '0')}-01`;
        const shifted = parseLocalDate(dateStr).add({ months: direction });
        this._displayedYear = shifted.year;
        this._displayedMonth = shifted.month;
        this._render();
    }

    _onTodayClick() {
        this.state.setCurrentDate(getCurrentDate());
        this._close();
    }

    /**
     * Clean up listeners and DOM
     */
    destroy() {
        this._unsubs.forEach((fn) => fn());
        this._unsubs = [];
        this._triggerEl?.removeEventListener('click', this._handleTriggerClick);
        document.removeEventListener('click', this._handleOutsideClick);
        this._dropdown?.remove();
        this._dropdown = null;
        this._triggerEl = null;
        this._mountEl = null;
    }
}
