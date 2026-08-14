/**
 * DateNavigation — Date controls: Today, Prev/Next, Title display
 *
 * Navigates by view duration (day, 3-day, week, month) and displays
 * a formatted date title that adapts to locale and view type.
 */
import { createTranslator } from '../core/Translations.js';
import { formatViewTitle } from '../views/formatTitle.js';
import { DURATION_DAYS } from '../core/CalendarConfig.js';
import { getCurrentDate, addDaysToString, addMonths, getLocale } from '../utils/temporal.js';
import DatePicker from './DatePicker.js';

export default class DateNavigation {
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
        this._titleEl = null;
        this._datePicker = null;
        this._unsubs = [];
    }

    /**
     * Build date navigation controls and mount into container
     * @param {HTMLElement} container
     */
    init(container) {
        this.container = container;

        const group = document.createElement('div');
        group.className = 'sc-toolbar-group';
        const todayBtn = document.createElement('button');
        todayBtn.className = 'sc-btn';
        todayBtn.type = 'button';
        todayBtn.textContent = this._t('today');
        todayBtn.setAttribute('aria-label', this._t('today'));
        const prevBtn = document.createElement('button');
        prevBtn.className = 'sc-btn sc-btn--icon';
        prevBtn.type = 'button';
        prevBtn.textContent = '\u2039'; // ‹
        prevBtn.setAttribute('aria-label', this._t('previous'));
        const nextBtn = document.createElement('button');
        nextBtn.className = 'sc-btn sc-btn--icon';
        nextBtn.type = 'button';
        nextBtn.textContent = '\u203A'; // ›
        nextBtn.setAttribute('aria-label', this._t('next'));
        this._titleEl = document.createElement('button');
        this._titleEl.className = 'sc-title sc-title--clickable';
        this._titleEl.type = 'button';
        this._titleEl.setAttribute('aria-haspopup', 'dialog');
        this._titleEl.setAttribute('aria-expanded', 'false');
        this._titleEl.setAttribute('aria-live', 'polite');

        group.appendChild(todayBtn);
        group.appendChild(prevBtn);
        group.appendChild(nextBtn);
        group.appendChild(this._titleEl);

        // Event delegation on group
        this._handleClick = (e) => {
            const btn = e.target.closest('.sc-btn');
            if (!btn) {
                return;
            }

            if (btn === todayBtn) {
                this.state.setCurrentDate(getCurrentDate());
            } else if (btn === prevBtn) {
                this._navigate(-1);
            } else if (btn === nextBtn) {
                this._navigate(1);
            }
        };
        group.addEventListener('click', this._handleClick);

        container.appendChild(group);

        // Date picker dropdown — mounted on the toolbar group for positioning
        this._datePicker = new DatePicker(this.state, this.bus, this.config);
        this._datePicker.init(this._titleEl, group);

        // Listen for state changes to update title
        this._unsubs.push(
            // ViewManager owns title formatting and publishes the result. Subscribing
            // here rather than recomputing keeps the toolbar and the grid in agreement.
            this.bus.on('title:updated', ({ title }) => this._setTitle(title))
        );

        this._setTitle(formatViewTitle(
            this.state.currentDate,
            this.state.viewDuration,
            getLocale(this.config.locale),
        ));
    }

    /**
     * Navigate forward or backward by the current view duration
     * @param {number} direction - 1 for forward, -1 for backward
     */
    _navigate(direction) {
        const duration = this.state.viewDuration;

        if (duration === 'month') {
            // addMonths already returns 'YYYY-MM-DD'. The .toString() that used to be here
            // was a no-op that read as though it returned a date object — the same
            // misreading that left DatePicker's month arrows dead.
            this.state.setCurrentDate(addMonths(this.state.currentDate, direction));
            return;
        }

        const days = DURATION_DAYS[duration] ?? 1;
        const newDate = addDaysToString(this.state.currentDate, direction * days);
        this.state.setCurrentDate(newDate);
    }

    /**
     * @param {string} title as published by ViewManager
     */
    _setTitle(title) {
        if (this._titleEl) this._titleEl.textContent = title;
    }

    /**
     * Clean up listeners and remove DOM
     */
    destroy() {
        this._unsubs.forEach((fn) => fn());
        this._unsubs = [];
        this._datePicker?.destroy();
        this._datePicker = null;
        if (this.container) {
            const group = this.container.querySelector('.sc-toolbar-group');
            group?.removeEventListener('click', this._handleClick);
        }
        this._titleEl = null;
    }
}
