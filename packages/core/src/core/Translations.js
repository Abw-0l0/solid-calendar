/**
 * Translations — every user-visible string the library emits.
 *
 * The split this enforces: **locale formats dates and numbers; translations supply
 * strings.** `config.locale` decides whether a date reads `2026/03/04` or `2026年3月4日`;
 * `config.translations` decides whether a button says "Today" or anything else. Before
 * this, several strings were selected by testing `locale === 'ja-JP'` inside a renderer,
 * which meant Japanese was hardcoded into modules and no third language was reachable.
 *
 *     import { JA_TRANSLATIONS } from 'steadycalendar';
 *     new CalendarApp({ locale: 'ja-JP', translations: JA_TRANSLATIONS })
 *
 * Every key falls back to its English default, so supplying none, or a partial map, is
 * always safe. `{count}` is the only placeholder.
 */

/** @type {Record<string, string>} */
export const DEFAULT_TRANSLATIONS = Object.freeze({
    // Toolbar
    Reservations: 'Schedule',
    today: 'Today',
    previous: 'Previous',
    next: 'Next',
    calendarControls: 'Calendar controls',
    print: 'Print',
    cardSettings: 'Card display settings',
    addReservation: 'Add booking',
    privacyMode: 'Privacy mode',

    // Resource filter
    staffDisplay: 'Resources',
    staff: 'Resources',
    selectAll: 'Select all',

    // Date picker
    previousMonthText: 'Previous month',
    nextMonthText: 'Next month',
    returnToTodayText: 'Return to today',

    // List view
    listTime: 'Time',
    listClient: 'Client',
    listResource: 'Resource',
    listService: 'Service',
    listStatus: 'Status',
    listEmpty: 'Nothing scheduled for this date',

    // Events
    groupedAppointment: 'Grouped booking',
    unknownClient: 'Unknown',
    reserved: 'Reserved',
    /** Suffix on a time block covering several resources in a flat view. */
    multipleResources: '({count})',

    // Resource modes
    resourceModeFixed: 'Resource mode is fixed in this view',
});

/**
 * Japanese strings, for `translations: JA_TRANSLATIONS`.
 *
 * Supplying this is what makes the UI Japanese. Setting `locale: 'ja-JP'` alone changes
 * only date formatting — that separation is deliberate, since the two are independent
 * choices for a host serving several regions.
 */
export const JA_TRANSLATIONS = Object.freeze({
    Reservations: '予約',
    today: '今日',
    previous: '前へ',
    next: '次へ',
    calendarControls: 'カレンダー操作',
    print: '印刷',
    cardSettings: 'カード表示設定',
    addReservation: '予約を追加',
    privacyMode: 'プライバシーモード',

    staffDisplay: 'スタッフ表示',
    staff: 'スタッフ',
    selectAll: '全選択',

    previousMonthText: '前の月',
    nextMonthText: '次の月',
    returnToTodayText: '今日に戻る',

    listTime: '時間',
    listClient: '顧客',
    listResource: 'スタッフ',
    listService: 'メニュー',
    listStatus: 'ステータス',
    listEmpty: '指定された日付の予約はありません',

    groupedAppointment: 'セット予約',
    unknownClient: '不明',
    reserved: '予約済み',
    multipleResources: '（{count}名）',

    resourceModeFixed: 'このビューではリソース表示を変更できません',
});

/**
 * Resolve a string, falling back to the English default.
 * @param {Record<string, string>|undefined} translations
 * @param {string} key
 * @param {Record<string, string|number>} [vars] `{name}` placeholders to substitute
 * @returns {string}
 */
export function translate(translations, key, vars) {
    const template = translations?.[key] ?? DEFAULT_TRANSLATIONS[key] ?? key;
    if (!vars) return template;
    return Object.entries(vars).reduce(
        (out, [name, value]) => out.split(`{${name}}`).join(String(value)),
        template,
    );
}

/**
 * A bound `translate` for a module that holds one config.
 * @param {object} config
 * @returns {(key: string, vars?: Record<string, string|number>) => string}
 */
export function createTranslator(config) {
    const translations = config?.translations;
    return (key, vars) => translate(translations, key, vars);
}
