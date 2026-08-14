/**
 * steadycalendar — shared declarations
 *
 * Everything the headless entry point exposes lives here. `index.d.ts` re-exports it and
 * adds the rendering layer; `headless.d.ts` re-exports it alone. The split matters: the
 * headless entry deliberately does not export CalendarApp, and pointing both subpaths at
 * one declaration file made TypeScript accept an import that fails at runtime.
 */

// --- Events ---------------------------------------------------------------

export class EventBus {
    /** @returns an unsubscribe function */
    on(event: string, handler: (data?: any) => void): () => void;
    once(event: string, handler: (data?: any) => void): () => void;
    off(event: string, handler: (data?: any) => void): void;
    emit(event: string, data?: any): void;
    destroy(): void;
}

export interface DateRange { start: string; end: string; }

export interface CalendarPreferences {
    viewType?: string;
    date?: string;
    resourceFilters?: string[];
    resourceMode?: ResourceMode;
}

export interface CardDisplaySettings {
    textItems: Array<{ id: string; name: string; visible: boolean; order: number }>;
    badgeItems: Array<{ id: string; name: string; visible: boolean; order: number }>;
}

export interface BusinessHoursEntry { start: string; end: string; }

// --- Field mapping --------------------------------------------------------

/** A field name, or a dotted path such as `'service.name'`. */
export type FieldPath = string;
export type FieldAccessor<T = any> = (raw: any) => T;

/**
 * One name, an ordered list of candidates, or a function. The first candidate resolving
 * to a non-nullish value wins. A user entry REPLACES the default candidate list rather
 * than extending it; spread `DEFAULT_FIELD_MAP` to extend.
 */
export type FieldSpec = FieldPath | FieldPath[] | FieldAccessor;

export interface DatasetFieldMap {
    resources?: FieldSpec;
    secondaryResources?: FieldSpec;
    businessHours?: FieldSpec;
    businessOverrides?: FieldSpec;
    holidaySettings?: FieldSpec;
    publicHolidays?: FieldSpec;
}

export interface EventFieldMap {
    id?: FieldSpec;
    date?: FieldSpec;
    startTime?: FieldSpec;
    endTime?: FieldSpec;
    title?: FieldSpec;
    /** Resolved as an object; an array-valued hit falls through to the next candidate. */
    owner?: FieldSpec;
    /** Resolved as an array; a non-array hit falls through. */
    owners?: FieldSpec;
    client?: FieldSpec;
    service?: FieldSpec;
    secondaryResources?: FieldSpec;
    groupId?: FieldSpec;
}

export interface ResourceFieldMap {
    id?: FieldSpec;
    name?: FieldSpec;
    color?: FieldSpec;
    closedDays?: FieldSpec;
    order?: FieldSpec;
    schedules?: FieldSpec;
    overrides?: FieldSpec;
    /** Truthy marks an owner exempt from the resource filter. */
    systemFlag?: FieldSpec;
}

export interface SecondaryResourceFieldMap {
    id?: FieldSpec;
    name?: FieldSpec;
    color?: FieldSpec;
    order?: FieldSpec;
}

export interface NamedEntityFieldMap { name?: FieldSpec; }

export interface FieldMap {
    dataset?: DatasetFieldMap;
    event?: EventFieldMap;
    resource?: ResourceFieldMap;
    secondaryResource?: SecondaryResourceFieldMap;
    client?: NamedEntityFieldMap;
    service?: NamedEntityFieldMap;
}

/** Generic field names, used when `fieldMap` is absent or a key is unset. */
export const DEFAULT_FIELD_MAP: Required<FieldMap>;

/** The names this library used before it was made domain-neutral. */
export const HEALTHCARE_FIELD_MAP: FieldMap;

// --- Translations ---------------------------------------------------------

export const DEFAULT_TRANSLATIONS: Record<string, string>;
export const JA_TRANSLATIONS: Record<string, string>;

/**
 * Resolve a string, falling back to the English default, substituting `{name}` vars.
 */
export function translate(
    translations: Record<string, string> | undefined,
    key: string,
    vars?: Record<string, string | number>,
): string;

// --- Data shapes ----------------------------------------------------------

export interface CalendarResource {
    id: string;
    title: string;
    color: string;
    /** Weekday numbers (0 = Sunday) or names ('Monday'); both are matched. */
    closedDays?: Array<number | string>;
    order?: number;
    type: ResourceType;
    schedules?: any[];
    overrides?: any[];
    holiday_hours_setting?: string | null;
    holiday_start_time?: string | null;
    holiday_end_time?: string | null;
    holiday_hours?: any[];
}

export interface Badge {
    id: string;
    style: string;
    bgColor?: string;
    textColor?: string;
    text?: string;
}

export interface InternalEvent {
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    start: string;
    end: string;
    resourceId: string | null;
    color: string;
    isTimeBlock: boolean;
    isCancelled: boolean;
    isSecondaryResourceEvent: boolean;
    client: any | null;
    resourceOwner: any | null;
    service: any | null;

    /**
     * Normalised projections. Renderers read these rather than the raw shape — that
     * boundary is what stops raw field names leaking out of the mapper.
     */
    resourceOwnerId: string | null;
    resourceOwnerName: string;
    clientName: string;
    serviceName: string;
    groupId: string | null;
    /** Exempt from the resource filter. */
    ignoresResourceFilter: boolean;

    textFields: Record<string, string>;
    badges: Badge[];
    /** The untouched incoming object, for host callbacks. */
    sourceData: any;
    classNames: string[];
}

export interface DataSource {
    fetchEvents?(range: DateRange): Promise<any[]>;
    fetchResources?(): Promise<any>;
    eventsUrl?: string;
    resourcesUrl?: string;
}

export interface CalendarPlugin {
    name: string;
    init(context: { state: CalendarState; bus: EventBus; config: CalendarConfig }): void;
    destroy(): void;
}

export interface HolidayProvider {
    getHoliday(dateStr: string): { name: string; name_en?: string } | null;
    getHolidayName?(dateStr: string, locale?: string): string;
    preload?(start: string, end: string): void;
}

export interface PreferencesAdapter {
    fetch(contextId: string): Promise<{ success: boolean; preferences?: CalendarPreferences }>;
    save(contextId: string, prefs: CalendarPreferences): Promise<void>;
}

// --- Configuration --------------------------------------------------------

export interface CalendarConfig {
    el?: string | HTMLElement;
    loaderEl?: string | HTMLElement;
    dataSource?: DataSource;
    /** Load data and manage state, render nothing. */
    headless?: boolean;
    /** How incoming field names are read. Generic defaults; see FieldMap. */
    fieldMap?: FieldMap;
    eventTypeResolver?: (raw: any) => 'timeblock' | 'event';
    statusResolver?: (raw: any) => { cancelled?: boolean; completed?: boolean };
    plugins?: CalendarPlugin[];
    preferences?: PreferencesAdapter;
    contextId?: string;
    cardDisplaySettings?: CardDisplaySettings;
    /**
     * Primary holiday source. A registered plugin implementing `getHoliday` is adopted
     * automatically when this is not set.
     */
    holidayProvider?: HolidayProvider;
    /** Fallback holiday source: a date-to-name map. */
    holidays?: Record<string, string>;
    onEventClick?: (event: InternalEvent) => void;
    onSlotSelect?: (detail: { date: string; startTime: string; endTime?: string; resourceId?: string }) => void;
    onDateHeaderClick?: (date: string) => void;
    /** Defaults to `window.print()`. */
    onPrint?: () => void;
    /** Formats dates and numbers. Strings come from `translations`. */
    locale?: string;
    /** IANA zone used to resolve "today". Defaults to the system zone. Applies globally. */
    timezone?: string;
    /** Every user-visible string. See DEFAULT_TRANSLATIONS for the keys. */
    translations?: Record<string, string>;
    callbacks?: {
        resolveEventFields?: (raw: any, mapped: any) => { textFields?: Record<string, string>; badges?: Badge[] };
        fetchPreferences?: (contextId: string) => Promise<{ success: boolean; preferences?: CalendarPreferences }>;
        savePreferences?: (contextId: string, prefs: CalendarPreferences) => Promise<void>;
        onEventClick?: (event: InternalEvent) => void;
        onSlotSelect?: (detail: any) => void;
        onDateHeaderClick?: (date: string) => void;
        onCardSettingsClick?: () => void;
        onPrint?: () => void;
    };
    badgeTypes?: Record<string, any>;
    privacySuppression?: { textFieldIds?: string[]; badgeIds?: string[] };
}

// --- State ----------------------------------------------------------------

export class CalendarState {
    constructor(bus: EventBus);
    readonly currentDate: string;
    readonly currentView: string;
    readonly currentResourceMode: ResourceMode;
    readonly resources: CalendarResource[];
    readonly events: InternalEvent[];
    /** Ids of the primary resources currently shown. Secondary resources are not filterable. */
    readonly resourceFilters: string[];
    readonly privacyMode: boolean;
    readonly isLoading: boolean;
    readonly businessHours: Record<number, BusinessHoursEntry>;
    readonly businessOverrides: any[];
    readonly holidaySettings: any | null;
    readonly publicHolidays: Record<string, boolean>;
    readonly viewDuration: 'day' | '3day' | 'week' | 'month';
    readonly isResourceView: boolean;
    readonly dateRange: DateRange;
    readonly cardDisplaySettings: CardDisplaySettings | null;
    readonly lastInteractionEndTime: number;
    setCurrentDate(date: string): void;
    setCurrentView(view: string): void;
    setCurrentResourceMode(mode: ResourceMode): void;
    setResources(resources: CalendarResource[]): void;
    setEvents(events: InternalEvent[]): void;
    setResourceFilters(resourceIds: string[]): void;
    setPrivacyMode(enabled: boolean): void;
    setLoading(loading: boolean): void;
    setBusinessHours(hours: Record<number, BusinessHoursEntry>): void;
    setBusinessOverrides(overrides: any[]): void;
    setHolidaySettings(settings: any): void;
    setPublicHolidays(holidays: Record<string, boolean>): void;
    setCardDisplaySettings(settings: CardDisplaySettings): void;
    setLastInteractionEndTime(timestamp: number): void;
    applyPreferences(prefs: CalendarPreferences): void;
    toPreferences(): CalendarPreferences;
}

export class DataBridge {
    constructor(state: CalendarState, bus: EventBus, config: CalendarConfig);
    init(): void;
    loadStaticData(): Promise<any>;
    loadEvents(): Promise<void>;
    refresh(refreshStatic?: boolean): Promise<void>;
    getStaticData(): any | null;
    destroy(): void;
}

export class PreferencesBridge {
    constructor(state: CalendarState, bus: EventBus, config: CalendarConfig);
    init(): Promise<void>;
    destroy(): void;
}

export class EventMapper {
    constructor(state: CalendarState, bus: EventBus, config: CalendarConfig);
    mapAll(rawEvents: any[]): InternalEvent[];
    mapOne(raw: any): InternalEvent[];
    init(): void;
    destroy(): void;
}

export class PluginManager {
    register(plugin: CalendarPlugin, context: any): void;
    get(name: string): CalendarPlugin | undefined;
    /** First registered plugin matching the predicate, or null. */
    find(predicate: (plugin: any) => boolean): any | null;
    destroy(): void;
}

// --- Constants ------------------------------------------------------------

export const SLOT_INTERVAL: number;
export const LABEL_INTERVAL: number;
export const SLOT_HEIGHT: number;
export const MIN_EVENT_HEIGHT: number;
export const PREFERENCE_SAVE_DELAY: number;
export const NOW_INDICATOR_INTERVAL: number;
export const DEFAULT_BUSINESS_HOURS: { start: string; end: string };
export const DEFAULT_RESOURCE_COLOR: string;
export const DEFAULT_NEUTRAL_COLOR: string;
export const VIEW_TYPES: Record<string, { duration: string; isResource: boolean; label: string }>;
/** Resource mode names, which are also preference values and translation keys. */
export type ResourceMode = 'primaryView' | 'secondaryView' | 'integratedView' | 'flatView';

/** Which tier a resource belongs to: one column each, or additionally occupied. */
export type ResourceType = 'primary' | 'secondary';

export const RESOURCE_MODES: Record<ResourceMode, { label: string; type: 'primary' | 'secondary' | 'both' | 'flat' }>;
export const RESOURCE_TYPES: { PRIMARY: 'primary'; SECONDARY: 'secondary' };
export const DURATION_DAYS: Record<string, number>;
export const DEFAULTS: { view: string; resourceMode: ResourceMode; privacyMode: boolean };
export function isResourceView(viewType: string): boolean;
/** True when the mode shows date columns rather than one column per resource. */
export function isFlatMode(mode: string): boolean;

// --- Date and time --------------------------------------------------------

/** A calendar date with no time and no timezone. */
export interface PlainDate {
    readonly year: number;
    /** 1-12 */
    readonly month: number;
    /** 1-31 */
    readonly day: number;
    /** ISO-8601: 1 = Monday .. 7 = Sunday */
    readonly dayOfWeek: number;
    readonly daysInMonth: number;
    /** Months clamp to the end of the target month: Jan 31 + 1 month is Feb 28. */
    add(duration: { years?: number; months?: number; days?: number }): PlainDate;
    subtract(duration: { years?: number; months?: number; days?: number }): PlainDate;
    /** 'YYYY-MM-DD' */
    toString(): string;
    valueOf(): number;
}

/** A wall-clock time with no date and no timezone. */
export interface PlainTime {
    readonly hour: number;
    readonly minute: number;
    readonly second: number;
    /** 'HH:MM:SS' */
    toString(): string;
}

export namespace temporal {
    function getCurrentDate(timezone?: string): string;
    function getCurrentTime(timezone?: string): string;
    function getCurrentHour(timezone?: string): number;
    function getCurrentMinute(timezone?: string): number;
    /** Throws RangeError on a date that does not exist, e.g. '2026-02-30'. */
    function parseLocalDate(dateString: string | null): PlainDate;
    function parseTime(timeString: string | null): PlainTime | null;
    function extractTime(isoString: string): string;
    function formatDate(dateString: string, locale?: string): string;
    function formatDateJapanese(dateString: string): string;
    function formatDateWithDetails(dateString: string, locale?: string): {
        formatted: string; year: number; month: number; day: number; weekday: string;
    };
    function formatTime(timeStr: string): string;
    function formatTimeRange(startTime: string, durationMinutes: number, locale?: string): string;
    function convertTimeToMinutes(timeStr: string): number;
    function convertMinutesToTime(totalMinutes: number): string;
    function addMinutesToTime(timeStr: string, minutesToAdd: number): string;
    function timeDiff(startTime: string, endTime: string): number;
    function timeDiffDetailed(startTime: string, endTime: string): {
        hours: number; minutes: number; totalMinutes: number;
    };
    function addDays(dateString: string, days: number): PlainDate;
    function addDaysToString(dateString: string, days: number): string;
    function addMonths(dateString: string, months: number): string;
    function addYears(dateString: string, years: number): string;
    function getMonthRange(year: number, month: number): {
        start: string; end: string; year: number; month: number; daysInMonth: number;
    };
    function getWeekRange(dateString: string): DateRange;
    function getMonthDates(year: number, month: number): string[];
    function isToday(dateString: string, timezone?: string): boolean;
    function checkIfPast(dateString: string, timezone?: string): boolean;
    function isFuture(dateString: string, timezone?: string): boolean;
    function isSameDay(date1: string, date2: string): boolean;
    function isBefore(date1: string, date2: string): boolean;
    function isAfter(date1: string, date2: string): boolean;
    function isWithinRange(date: string, startDate: string, endDate: string): boolean;
    function getLocale(locale?: string): string;
    function getWeekdayNames(locale?: string): string[];
    /**
     * Sets the zone used to resolve "now". CalendarApp calls this from its constructor
     * with `config.timezone`. Module-level, so one zone applies per page. Pass null to
     * restore the default (STEADYCALENDAR_TIMEZONE, else the system zone).
     */
    function setDefaultTimezone(timeZone?: string | null): string;
    function getDefaultTimezone(): string;
    const WEEKDAYS_JA_SHORT: string[];
    const WEEKDAYS_EN_SHORT: string[];
}

export namespace ColorUtils {
    function getColorForId(id: string | number): { light: string; dark: string };
    function hexToRgb(hex: string): { r: number; g: number; b: number } | null;
    function lightenColor(hex: string, amount?: number): string;
    function getContrastTextColor(hex: string): '#000000' | '#FFFFFF';
    function getGroupColor(groupId: string | null): string | null;
}

export namespace holidays {
    function resolveHoliday(dateStr: string, state: any, config: any): { name: string; name_en?: string } | null;
    function resolveHolidayName(dateStr: string, locale: string | undefined, state: any, config: any): string;
    function isHoliday(dateStr: string, state: any, config: any): boolean;
}
