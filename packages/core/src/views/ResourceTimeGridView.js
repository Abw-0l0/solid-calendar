/**
 * ResourceTimeGridView — Resource-based time grid (day/3-day/week)
 *
 * Used for resourceTimeGridDay, resourceTimeGridThreeDay, resourceTimeGridWeek.
 * Creates a grid with resource columns (one per staff/equipment).
 * For multi-day views, creates date groups each containing resource columns.
 *
 * Composes: CalendarGrid + TimeSlotGenerator + ResourceColumnBuilder
 *           + NowIndicator + BusinessHoursOverlay
 */
import { DURATION_DAYS } from '../core/CalendarConfig.js';
import { parseLocalDate, isToday, getLocale, getWeekdayNames } from '../utils/temporal.js';
import { resolveHoliday, resolveHolidayName } from '../utils/holidays.js';
import CalendarGrid from '../grid/CalendarGrid.js';
import NowIndicator from '../grid/NowIndicator.js';
import BusinessHoursOverlay from '../grid/BusinessHoursOverlay.js';
import AutoScroll from '../grid/AutoScroll.js';

export default class ResourceTimeGridView {
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
        /** @type {CalendarGrid|null} */
        this._grid = null;
        /** @type {NowIndicator|null} */
        this._nowIndicator = null;
        /** @type {BusinessHoursOverlay|null} */
        this._businessHoursOverlay = null;
        /** @type {AutoScroll|null} */
        this._autoScroll = null;
        /** @type {HTMLElement|null} */
        this._dayViewDateHeader = null;
    }

    /**
     * Build the resource time grid view inside the container
     * @param {HTMLElement} container
     */
    init(container) {
        this.container = container;

        this._viewEl = document.createElement('div');
        this._viewEl.className = 'sc-view sc-view--resource-time-grid';
        this.container.appendChild(this._viewEl);

        const duration = this.state.viewDuration;
        const dayCount = DURATION_DAYS[duration] ?? 1;

        if (dayCount > 1) {
            this._renderMultiDay(dayCount);
        } else {
            this._renderSingleDay();
        }
    }

    /**
     * Render single-day resource grid with date header
     */
    _renderSingleDay() {
        this._dayViewDateHeader = this._createDayViewDateHeader();
        this._viewEl.appendChild(this._dayViewDateHeader);

        this._grid = new CalendarGrid(this.state, this.bus, this.config);
        this._grid.init(this._viewEl);

        this._initOverlays();
    }

    /**
     * Create the Day view date header with MM/DD(weekday) format
     * Uses sc-date-header styling consistent with DateHeaderRenderer
     * @returns {HTMLElement}
     */
    _createDayViewDateHeader() {
        const header = document.createElement('div');
        header.className = 'sc-date-header';

        const cell = document.createElement('div');
        cell.className = 'sc-date-header-cell';

        const dateStr = this.state.currentDate;
        cell.dataset.date = dateStr;

        const date = parseLocalDate(dateStr);
        const locale = getLocale(this.config.locale);
        const weekdayNames = getWeekdayNames(locale);

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

        const month = String(date.month).padStart(2, '0');
        const day = String(date.day).padStart(2, '0');
        const weekdayIndex = dayOfWeek === 7 ? 0 : dayOfWeek;
        const weekday = weekdayNames[weekdayIndex] ?? '';

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

        header.appendChild(cell);
        return header;
    }

    /**
     * Render multi-day resource grid with grouped date columns.
     * Date headers are embedded inside the grid (via ResourceColumnBuilder.initGrouped),
     * so no separate DateHeaderRenderer is needed.
     * @param {number} _dayCount unused: date headers come from ResourceColumnBuilder
     */
    _renderMultiDay(_dayCount) {
        this._grid = new CalendarGrid(this.state, this.bus, this.config);
        this._grid.init(this._viewEl);

        this._initOverlays();
    }

    /**
     * Initialize now indicator and business hours overlay
     */
    _initOverlays() {
        const gridEl = this._grid?.getGridElement();
        if (!gridEl) {
            return;
        }

        this._nowIndicator = new NowIndicator(this.state, this.bus, this.config);
        this._nowIndicator.init(gridEl);

        this._autoScroll = new AutoScroll(this.state, this.bus, this.config);
        this._autoScroll.init(gridEl);

        const columnsContainer = this._grid?.getColumnsContainer();
        if (columnsContainer) {
            this._businessHoursOverlay = new BusinessHoursOverlay(this.state, this.bus, this.config);
            this._businessHoursOverlay.init(columnsContainer);
        }
    }

    /**
     * Get the grid instance (for EventRenderer positioning)
     * @returns {CalendarGrid|null}
     */
    getGrid() {
        return this._grid;
    }

    /**
     * Cleanup all composed modules and DOM
     */
    destroy() {
        this._businessHoursOverlay?.destroy();
        this._businessHoursOverlay = null;

        this._nowIndicator?.destroy();
        this._nowIndicator = null;

        this._autoScroll?.destroy();
        this._autoScroll = null;

        if (this._dayViewDateHeader) {
            this._dayViewDateHeader.remove();
        }
        this._dayViewDateHeader = null;

        this._grid?.destroy();
        this._grid = null;

        if (this._viewEl) {
            this._viewEl.remove();
        }
        this._viewEl = null;
        this.container = null;
    }
}
