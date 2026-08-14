/**
 * Locale and translations are independent.
 *
 * `locale` formats dates and numbers. `translations` supplies strings. They used to be
 * conflated: several UI strings were chosen by testing `locale === 'ja-JP'` inside a
 * renderer, which hardcoded Japanese into modules and made a third language unreachable.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CalendarApp from '../src/CalendarApp.js';
import { JA_TRANSLATIONS, DEFAULT_TRANSLATIONS, translate } from '../src/core/Translations.js';
import { getCurrentDate } from '../src/utils/temporal.js';

const TODAY = getCurrentDate();

const dataSource = {
    async fetchResources() {
        return { resources: [{ id: 't1', name: 'Alex' }] };
    },
    async fetchEvents() {
        return [{
            id: 'r1', date: TODAY, start_time: '09:00', end_time: '09:30',
            assignee: { id: 't1' }, client: { name: 'Jo' }, service: { name: 'Fitting' },
            status: 'Active',
        }];
    },
};

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('translate', () => {
    it('should_fall_back_to_the_english_default', () => {
        expect(translate(undefined, 'today')).toBe('Today');
        expect(translate({}, 'today')).toBe('Today');
    });

    it('should_prefer_a_supplied_string', () => {
        expect(translate({ today: 'Heute' }, 'today')).toBe('Heute');
    });

    it('should_substitute_placeholders', () => {
        expect(translate(undefined, 'multipleResources', { count: 3 })).toBe('(3)');
        expect(translate(JA_TRANSLATIONS, 'multipleResources', { count: 3 })).toBe('（3名）');
    });

    it('should_return_the_key_for_an_unknown_string', () => {
        expect(translate({}, 'noSuchKey')).toBe('noSuchKey');
    });

    it('should_cover_every_default_key_in_the_japanese_preset', () => {
        // A missing key silently renders English inside an otherwise Japanese UI.
        const missing = Object.keys(DEFAULT_TRANSLATIONS).filter((k) => !(k in JA_TRANSLATIONS));
        expect(missing).toEqual([]);
    });

    // Keys are as public as values — a host overrides translations *by key*, so a key
    // named for one industry is just as much a leak as a string. Scanning values alone is
    // why `staffDisplay` and `staff` survived the 0.2.0 generalisation.
    const DOMAIN_WORDS = ['patient', 'therapist', 'clinic', 'menu', 'staff', 'equipment'];

    it('should_carry_no_domain_vocabulary_in_the_english_defaults', () => {
        const flat = Object.values(DEFAULT_TRANSLATIONS).join(' ').toLowerCase();
        for (const word of DOMAIN_WORDS) {
            expect(flat).not.toContain(word);
        }
    });

    it('should_carry_no_domain_vocabulary_in_any_translation_key', () => {
        const keys = Object.keys(DEFAULT_TRANSLATIONS).join(' ').toLowerCase();
        for (const word of DOMAIN_WORDS) {
            expect(keys).not.toContain(word);
        }
    });

    it('should_carry_no_domain_vocabulary_in_the_japanese_defaults', () => {
        // The Japanese values had outlived their English counterparts: listResource read
        // "スタッフ" and listService read "メニュー" long after both keys went generic.
        const flat = Object.values(JA_TRANSLATIONS).join(' ');
        for (const word of ['スタッフ', 'メニュー', '患者']) {
            expect(flat).not.toContain(word);
        }
    });
});

describe('translations in the rendered calendar', () => {
    let el;
    let app;

    beforeEach(() => {
        document.body.innerHTML = '<div id="calendar"></div>';
        el = document.querySelector('#calendar');
    });

    afterEach(() => {
        app?.destroy();
        app = null;
    });

    it('should_render_generic_english_by_default', async () => {
        app = new CalendarApp({ el: '#calendar', dataSource });
        await app.init();

        app.state.setCurrentView('list');
        await settle();

        const headers = [...el.querySelectorAll('.sc-list th')].map((th) => th.textContent);
        expect(headers).toEqual(['Time', 'Client', 'Resource', 'Service', 'Status']);
        expect(el.querySelector('[aria-label="Today"]')?.textContent).toBe('Today');
    });

    it('should_render_japanese_when_the_preset_is_supplied', async () => {
        app = new CalendarApp({
            el: '#calendar', locale: 'ja-JP', translations: JA_TRANSLATIONS, dataSource,
        });
        await app.init();

        app.state.setCurrentView('list');
        await settle();

        const headers = [...el.querySelectorAll('.sc-list th')].map((th) => th.textContent);
        expect(headers).toEqual(['時間', '顧客', 'リソース', 'サービス', 'ステータス']);
    });

    it('should_accept_a_language_the_library_has_never_heard_of', async () => {
        // The point of the split: no locale branch anywhere gates these strings.
        app = new CalendarApp({
            el: '#calendar',
            translations: { listTime: 'Tid', listClient: 'Kund', listResource: 'Resurs', listService: 'Tjänst', listStatus: 'Status' },
            dataSource,
        });
        await app.init();

        app.state.setCurrentView('list');
        await settle();

        const headers = [...el.querySelectorAll('.sc-list th')].map((th) => th.textContent);
        expect(headers).toEqual(['Tid', 'Kund', 'Resurs', 'Tjänst', 'Status']);
    });

    it('should_format_durations_by_locale_not_by_translations', async () => {
        app = new CalendarApp({ el: '#calendar', dataSource });
        await app.init();

        // The Japanese minutes counter used to be appended in every locale.
        const time = el.querySelector('.sc-event-time');
        expect(time?.textContent).toContain('min');
        expect(time?.textContent).not.toContain('分');
    });

    it('should_use_the_japanese_counter_under_a_japanese_locale', async () => {
        app = new CalendarApp({ el: '#calendar', locale: 'ja-JP', dataSource });
        await app.init();

        expect(el.querySelector('.sc-event-time')?.textContent).toContain('分');
    });

    it('should_normalise_a_short_locale_code', async () => {
        // `ja` used to reach some modules unnormalised, producing a half-Japanese UI.
        app = new CalendarApp({ el: '#calendar', locale: 'ja', dataSource });
        await app.init();

        expect(el.querySelector('.sc-event-time')?.textContent).toContain('分');
    });
});
