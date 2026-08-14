/**
 * The toolbar's mini date picker.
 *
 * This file had no tests at all, which is how it shipped a completely dead control: both
 * month arrows read `.year` off `addMonths()`, which returns a string. Nothing threw —
 * `undefined` propagated into `getMonthRange`, `daysInMonth` became NaN, the day loop
 * `for (day = 1; day <= NaN)` never ran, and the picker rendered a header reading
 * "undefined undefined" over a grid with no clickable date. It was also sticky: every
 * later click recomputed from the same corrupted pair.
 *
 * So the assertions here are about the rendered grid, not about internal state. Anything
 * weaker would have passed against the broken version.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CalendarApp from '../src/CalendarApp.js';

function dataSource() {
    return {
        async fetchResources() {
            return { resources: [{ id: 't1', name: 'Alex Chen', color: '#8935FF' }] };
        },
        async fetchEvents() {
            return [];
        },
    };
}

const q = (sel) => document.querySelector(sel);
const all = (sel) => [...document.querySelectorAll(sel)];

/** Day cells for the displayed month — the padding cells are disabled and carry no date. */
const dayCells = () => all('.sc-datepicker-day:not(.sc-datepicker-day--other)');
const header = () => q('.sc-datepicker-month-year').textContent;
const navButtons = () => all('.sc-datepicker-nav');

describe('DatePicker', () => {
    let el;
    let app;

    beforeEach(async () => {
        document.body.innerHTML = '<div id="calendar"></div>';
        el = document.querySelector('#calendar');
        app = new CalendarApp({ el: '#calendar', dataSource: dataSource() });
        await app.init();
        // A fixed date, so the assertions below do not depend on when the suite runs.
        app.state.setCurrentDate('2026-03-14');
        q('.sc-title--clickable').click();
    });

    afterEach(() => {
        app?.destroy();
        app = null;
    });

    it('should_open_on_the_month_of_the_current_date', () => {
        expect(header()).toBe('March 2026');
        expect(dayCells()).toHaveLength(31);
    });

    it('should_advance_a_month_on_the_next_arrow', () => {
        navButtons()[1].click();

        expect(header()).toBe('April 2026');
        expect(dayCells()).toHaveLength(30);
    });

    it('should_step_back_a_month_on_the_previous_arrow', () => {
        navButtons()[0].click();

        expect(header()).toBe('February 2026');
        expect(dayCells()).toHaveLength(28);
    });

    it('should_keep_stepping_rather_than_sticking_after_the_first_click', () => {
        const next = navButtons()[1];
        next.click();
        next.click();
        next.click();

        expect(header()).toBe('June 2026');
        expect(dayCells()).toHaveLength(30);
    });

    it('should_roll_backward_across_a_year_boundary', () => {
        const prev = navButtons()[0];
        for (let i = 0; i < 3; i++) prev.click();

        expect(header()).toBe('December 2025');
        expect(dayCells()).toHaveLength(31);
    });

    it('should_land_on_a_leap_february', () => {
        const prev = navButtons()[0];
        for (let i = 0; i < 13; i++) prev.click();

        expect(header()).toBe('February 2025');
        expect(dayCells()).toHaveLength(28);

        const next = navButtons()[1];
        for (let i = 0; i < 12; i++) next.click();
        expect(header()).toBe('February 2026');
    });

    it('should_not_change_the_selected_date_while_browsing_months', () => {
        navButtons()[1].click();
        navButtons()[1].click();

        expect(app.state.currentDate).toBe('2026-03-14');
    });

    it('should_set_the_date_and_close_when_a_day_is_clicked', () => {
        navButtons()[1].click();
        const cells = dayCells();
        cells[9].click();

        expect(app.state.currentDate).toBe('2026-04-10');
        expect(q('.sc-datepicker').classList.contains('sc-dropdown--open')).toBe(false);
    });

    it('should_resync_to_the_current_date_when_reopened', () => {
        navButtons()[1].click();
        expect(header()).toBe('April 2026');

        q('.sc-title--clickable').click();  // close
        q('.sc-title--clickable').click();  // reopen

        expect(header()).toBe('March 2026');
    });

    it('should_render_the_japanese_header_format', async () => {
        app.destroy();
        app = new CalendarApp({ el: '#calendar', dataSource: dataSource(), locale: 'ja-JP' });
        await app.init();
        app.state.setCurrentDate('2026-03-14');
        q('.sc-title--clickable').click();

        expect(header()).toBe('2026年3月');
        navButtons()[1].click();
        expect(header()).toBe('2026年4月');
    });
});
