/**
 * BusinessHoursOverlay — Gray overlay on non-business-hour time slots
 *
 * Per-column overlays: each resource can have different business hours.
 * Falls back to DEFAULT_BUSINESS_HOURS when resource-specific hours
 * are not defined. Creates positioned overlay divs within each column body.
 */
import { isHoliday } from '../utils/holidays.js';
import { SLOT_HEIGHT, SLOT_INTERVAL, DEFAULT_BUSINESS_HOURS, RESOURCE_TYPES } from '../core/CalendarConfig.js';
import { convertTimeToMinutes, convertMinutesToTime, parseLocalDate } from '../utils/temporal.js';

/** Map day-of-week number (0=Sun) to day name used in API */
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * @param {Array<string|number>|undefined} days
 * @param {string} dayName e.g. 'Monday'
 * @param {number} dayOfWeek 0=Sunday
 * @returns {boolean}
 */
function matchesWeekday(days, dayName, dayOfWeek) {
    if (!Array.isArray(days)) return false;
    return days.some((d) => (typeof d === 'number' ? d === dayOfWeek : String(d) === dayName));
}

export default class BusinessHoursOverlay {
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

        /** @type {HTMLElement[]} */
        this._overlayElements = [];
        this._unsubs = [];
    }

    /**
     * Create overlays for all columns in the grid
     * @param {HTMLElement} container - The .sc-columns-container element
     */
    init(container) {
        this.container = container;
        this._renderOverlays();

        this._unsubs.push(
            this.bus.on('resource:changed', () => this._renderOverlays()),
            this.bus.on('view:changed', () => this._renderOverlays()),
            this.bus.on('date:changed', () => this._renderOverlays()),
            this.bus.on('resources:loaded', () => this._renderOverlays())
        );
    }

    /**
     * Render non-business-hour overlays for each column
     */
    _renderOverlays() {
        this._clearOverlays();

        if (!this.container) {
            return;
        }

        const columns = this.container.querySelectorAll('.sc-column');

        for (const column of columns) {
            const body = column.querySelector('.sc-column-body');
            if (!body) {
                continue;
            }

            const resourceId = column.dataset.resourceId;
            const columnDate = column.dataset.date ?? this.state.currentDate;

            // Get day-of-week for this specific column's date
            const { dayOfWeek, dayName } = this._getDayInfo(columnDate);

            // Fix: compare as strings since DOM dataset values are always strings
            const resource = resourceId
                ? this.state.resources.find((r) => String(r.id) === String(resourceId))
                : null;

            const resolvedHours = this._resolveHoursForResource(resource, dayName, dayOfWeek, columnDate);
            this._createOverlaysForColumn(body, resolvedHours);
        }
    }

    /**
     * Get day-of-week number and name from a date string
     * @param {string} dateStr - 'YYYY-MM-DD'
     * @returns {{ dayOfWeek: number, dayName: string }}
     */
    _getDayInfo(dateStr) {
        // No initialiser: both branches below assign it, and a placeholder 0 would
        // silently mean Sunday if either ever stopped doing so.
        let dayOfWeek;
        try {
            const parsed = parseLocalDate(dateStr);
            dayOfWeek = parsed.dayOfWeek; // 1=Mon..7=Sun in Temporal
            dayOfWeek = dayOfWeek === 7 ? 0 : dayOfWeek; // convert to JS 0=Sun
        } catch {
            // Fallback for a malformed date. Parsed as UTC and read in UTC, so it cannot
            // drift in zones that transition at midnight.
            dayOfWeek = new Date(dateStr + 'T00:00:00Z').getUTCDay();
        }
        return { dayOfWeek, dayName: DAY_NAMES[dayOfWeek] };
    }

    /**
     * Resolve business hours for a resource on the given day and date.
     *
     * Priority for staff resources:
     *   1. Staff override for specific date (highest)
     *   2. Closed day check (staff closed on this weekday)
     *   3. Public holiday handling (per staff holiday settings)
     *   4. Regular staff schedule
     *   5. Business override for specific date
     *   6. Business regular hours (fallback)
     *   7. Intersect staff hours with business hours
     *
     * Equipment resources always use business hours.
     *
     * @param {object|null} resource
     * @param {string} dayName - e.g. 'Monday'
     * @param {number} dayOfWeek - 0=Sun..6=Sat
     * @param {string} columnDate - 'YYYY-MM-DD'
     * @returns {Array<{start: string, end: string}>|null} Array of time ranges, or null (entire column non-business)
     */
    _resolveHoursForResource(resource, dayName, dayOfWeek, columnDate) {
        // Resolve business hours for this date (with overrides and holidays)
        const businessHours = this._resolveBusinessHours(dayOfWeek, columnDate);

        // Equipment resources or no resource: use business hours
        if (!resource || resource.type === RESOURCE_TYPES.RESOURCE) {
            return businessHours;
        }

        // --- Staff resource resolution ---

        // 1. Staff override for specific date
        const staffOverride = this._findStaffOverride(resource, columnDate);
        if (staffOverride) {
            if (staffOverride.type === 'closed') {
                return null; // entire column grayed out
            }
            if (staffOverride.type === 'open' && staffOverride.start_time && staffOverride.end_time) {
                const staffHours = [{
                    start: staffOverride.start_time.slice(0, 5),
                    end: staffOverride.end_time.slice(0, 5)
                }];
                return this._intersectWithBusiness(staffHours, businessHours);
            }
        }

        // 2. Closed day check. Payloads express weekdays either as names ('Monday')
        // or as numbers (0=Sun); only names used to match, so numeric ones never closed.
        if (matchesWeekday(resource.closedDays, dayName, dayOfWeek)) {
            return null;
        }

        // 3. Public holiday handling
        if (isHoliday(columnDate, this.state, this.config)) {
            const holidayResult = this._resolveStaffHolidayHours(resource, columnDate);
            if (holidayResult !== undefined) {
                // null = closed, array = custom hours
                if (holidayResult === null) {
                    return null;
                }
                return this._intersectWithBusiness(holidayResult, businessHours);
            }
            // undefined = 'normal', fall through to regular schedule
        }

        // 4. Regular staff schedule
        if (resource.schedules?.length) {
            const daySchedules = resource.schedules.filter(
                (s) => s.day_of_week === dayName
            );
            if (daySchedules.length > 0) {
                // Use earliest start / latest end across all entries for this day
                let start = daySchedules[0].start_time ?? daySchedules[0].start;
                let end = daySchedules[0].end_time ?? daySchedules[0].end;
                for (let i = 1; i < daySchedules.length; i++) {
                    const s = daySchedules[i].start_time ?? daySchedules[i].start;
                    const e = daySchedules[i].end_time ?? daySchedules[i].end;
                    if (s < start) start = s;
                    if (e > end) end = e;
                }
                const staffHours = [{ start: start.slice(0, 5), end: end.slice(0, 5) }];
                return this._intersectWithBusiness(staffHours, businessHours);
            }
        }

        // 5/6. No staff schedule — fallback to business hours
        return businessHours;
    }

    /**
     * Resolve business hours for a given date, considering overrides and holidays.
     * @param {number} dayOfWeek - 0=Sun..6=Sat
     * @param {string} columnDate - 'YYYY-MM-DD'
     * @returns {Array<{start: string, end: string}>|null}
     */
    _resolveBusinessHours(dayOfWeek, columnDate) {
        // Check business overrides for this specific date
        const businessOverride = this._findBusinessOverride(columnDate);
        if (businessOverride) {
            if (businessOverride.type === 'closed') {
                return null;
            }
            if (businessOverride.type === 'open' && businessOverride.start_time && businessOverride.end_time) {
                return [{
                    start: businessOverride.start_time.slice(0, 5),
                    end: businessOverride.end_time.slice(0, 5)
                }];
            }
        }

        // Check public holiday for this context
        if (isHoliday(columnDate, this.state, this.config)) {
            const businessHolidayHours = this._resolveBusinessHolidayHours();
            if (businessHolidayHours !== undefined) {
                return businessHolidayHours;
            }
            // undefined = 'normal', fall through to regular hours
        }

        // Regular business hours
        const regularHours = this.state.businessHours[dayOfWeek] ?? null;
        if (!regularHours) {
            return null;
        }
        return [{ start: regularHours.start, end: regularHours.end }];
    }

    /**
     * Find a business override matching the given date.
     * @param {string} dateStr - 'YYYY-MM-DD'
     * @returns {object|null}
     */
    _findBusinessOverride(dateStr) {
        const overrides = this.state.businessOverrides;
        if (!overrides?.length) {
            return null;
        }
        for (const override of overrides) {
            const fromDate = override.from_date;
            const toDate = override.to_date ?? fromDate;
            if (dateStr >= fromDate && dateStr <= toDate) {
                return override;
            }
        }
        return null;
    }

    /**
     * Find a staff override matching the given date.
     * @param {object} resource
     * @param {string} dateStr - 'YYYY-MM-DD'
     * @returns {object|null}
     */
    _findStaffOverride(resource, dateStr) {
        const overrides = resource.overrides;
        if (!overrides?.length) {
            return null;
        }
        for (const override of overrides) {
            const fromDate = override.from_date;
            const toDate = override.to_date ?? fromDate;
            if (dateStr >= fromDate && dateStr <= toDate) {
                return override;
            }
        }
        return null;
    }

    /**
     * Resolve business holiday hours from settings.
     * @returns {Array<{start: string, end: string}>|null|undefined}
     *   null = closed, array = custom hours, undefined = use normal hours
     */
    _resolveBusinessHolidayHours() {
        const settings = this.state.holidaySettings;
        if (!settings) {
            return undefined;
        }
        const setting = settings.holiday_hours_setting || 'normal';
        if (setting === 'closed') {
            return null;
        }
        if (setting === 'custom') {
            const ranges = settings.holiday_hours?.length > 0
                ? settings.holiday_hours
                : (settings.holiday_start_time && settings.holiday_end_time
                    ? [{ start_time: settings.holiday_start_time, end_time: settings.holiday_end_time }]
                    : []);
            if (ranges.length > 0) {
                return ranges.map((r) => ({
                    start: (r.start_time ?? r.start).slice(0, 5),
                    end: (r.end_time ?? r.end).slice(0, 5)
                }));
            }
        }
        // 'normal' or no valid custom hours — use regular schedule
        return undefined;
    }

    /**
     * Resolve staff holiday hours based on staff's holiday_hours_setting.
     * Follows v1 resolveStaffHolidaySettings pattern.
     * @param {object} resource
     * @param {string} columnDate
     * @returns {Array<{start: string, end: string}>|null|undefined}
     *   null = closed, array = custom hours, undefined = use normal schedule
     */
    _resolveStaffHolidayHours(resource, _columnDate) {
        const staffSetting = resource.holiday_hours_setting;

        // If staff has no setting or says 'follow', use business holiday settings
        if (!staffSetting || staffSetting === 'follow') {
            const businessResult = this._resolveBusinessHolidayHours();
            return businessResult;
        }

        if (staffSetting === 'closed') {
            return null;
        }

        if (staffSetting === 'custom') {
            const ranges = resource.holiday_hours?.length > 0
                ? resource.holiday_hours
                : (resource.holiday_start_time && resource.holiday_end_time
                    ? [{ start_time: resource.holiday_start_time, end_time: resource.holiday_end_time }]
                    : []);
            if (ranges.length > 0) {
                return ranges.map((r) => ({
                    start: (r.start_time ?? r.start).slice(0, 5),
                    end: (r.end_time ?? r.end).slice(0, 5)
                }));
            }
        }

        // 'normal' — use regular schedule
        return undefined;
    }

    /**
     * Intersect staff hours with business hours.
     * Staff hours cannot extend beyond business hours.
     * @param {Array<{start: string, end: string}>} staffHours
     * @param {Array<{start: string, end: string}>|null} businessHours
     * @returns {Array<{start: string, end: string}>|null}
     */
    _intersectWithBusiness(staffHours, businessHours) {
        if (!businessHours || businessHours.length === 0) {
            // Business is closed — staff can't work
            return null;
        }
        if (!staffHours || staffHours.length === 0) {
            return businessHours;
        }

        const result = [];
        for (const staffSlot of staffHours) {
            const staffStart = convertTimeToMinutes(staffSlot.start);
            const staffEnd = convertTimeToMinutes(staffSlot.end);

            for (const businessSlot of businessHours) {
                const businessStart = convertTimeToMinutes(businessSlot.start);
                const businessEnd = convertTimeToMinutes(businessSlot.end);

                const intersectionStart = Math.max(staffStart, businessStart);
                const intersectionEnd = Math.min(staffEnd, businessEnd);

                if (intersectionStart < intersectionEnd) {
                    result.push({
                        start: convertMinutesToTime(intersectionStart),
                        end: convertMinutesToTime(intersectionEnd)
                    });
                }
            }
        }

        return result.length > 0 ? result : null;
    }

    /**
     * Create overlays for a single column body based on resolved hours.
     * Supports multiple business hour slots (e.g., morning + afternoon with lunch break).
     * @param {HTMLElement} body - The .sc-column-body element
     * @param {Array<{start: string, end: string}>|null} resolvedHours
     */
    _createOverlaysForColumn(body, resolvedHours) {
        const gridStart = convertTimeToMinutes(DEFAULT_BUSINESS_HOURS.start);
        const gridEnd = convertTimeToMinutes(DEFAULT_BUSINESS_HOURS.end);

        // null = entire column is non-business (closed)
        if (!resolvedHours || resolvedHours.length === 0) {
            const overlay = this._createOverlay(gridStart, gridEnd, gridStart);
            body.appendChild(overlay);
            this._overlayElements.push(overlay);
            return;
        }

        // Sort slots by start time
        const sorted = [...resolvedHours].sort(
            (a, b) => convertTimeToMinutes(a.start) - convertTimeToMinutes(b.start)
        );

        // Create overlays for gaps: before first slot, between slots, after last slot
        let currentPos = gridStart;

        for (const slot of sorted) {
            const slotStart = convertTimeToMinutes(slot.start);
            const slotEnd = convertTimeToMinutes(slot.end);

            // Gap before this slot
            if (slotStart > currentPos) {
                const overlay = this._createOverlay(currentPos, slotStart, gridStart);
                body.appendChild(overlay);
                this._overlayElements.push(overlay);
            }

            currentPos = Math.max(currentPos, slotEnd);
        }

        // Gap after last slot
        if (currentPos < gridEnd) {
            const overlay = this._createOverlay(currentPos, gridEnd, gridStart);
            body.appendChild(overlay);
            this._overlayElements.push(overlay);
        }
    }

    /**
     * Create a single overlay div positioned within a column body
     * @param {number} startMinutes
     * @param {number} endMinutes
     * @param {number} gridStartMinutes
     * @returns {HTMLElement}
     */
    _createOverlay(startMinutes, endMinutes, gridStartMinutes) {
        const overlay = document.createElement('div');
        overlay.className = 'sc-non-business';

        const topOffset = ((startMinutes - gridStartMinutes) / SLOT_INTERVAL) * SLOT_HEIGHT;
        const height = ((endMinutes - startMinutes) / SLOT_INTERVAL) * SLOT_HEIGHT;

        overlay.style.top = `${topOffset}px`;
        overlay.style.height = `${height}px`;

        return overlay;
    }

    /**
     * Remove all existing overlay elements
     */
    _clearOverlays() {
        for (const el of this._overlayElements) {
            el.remove();
        }
        this._overlayElements = [];
    }

    /**
     * Cleanup overlays and listeners
     */
    destroy() {
        for (const unsub of this._unsubs) {
            unsub();
        }
        this._unsubs = [];

        this._clearOverlays();
        this.container = null;
    }
}
