/**
 * ActionButtons — Print, Card Settings, and Add Reservation buttons
 *
 * Print button emits print:requested on the EventBus; CalendarApp forwards it to
 * config.onPrint, which defaults to window.print().
 * Card Settings button emits cardSettings:click on EventBus.
 * Add Reservation button emits slot:click with default time values.
 */
import { createTranslator } from '../core/Translations.js';
import { getCurrentDate, getCurrentTime } from '../utils/temporal.js';

export default class ActionButtons {
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
        this._group = null;
        this._handleClick = null;
    }

    /**
     * Build action buttons and mount into container
     * @param {HTMLElement} container
     */
    init(container) {
        this.container = container;

        this._group = document.createElement('div');
        this._group.className = 'sc-toolbar-group';

        // Print button
        const printBtn = document.createElement('button');
        printBtn.className = 'sc-btn sc-btn--print';
        printBtn.type = 'button';
        printBtn.textContent = this._t('print');
        printBtn.setAttribute('aria-label', this._t('print'));

        // Card Display Settings button (gear icon)
        const cardSettingsLabel = this._t('cardSettings');
        const cardSettingsBtn = document.createElement('button');
        cardSettingsBtn.className = 'sc-btn sc-btn--card-settings';
        cardSettingsBtn.type = 'button';
        cardSettingsBtn.setAttribute('aria-label', cardSettingsLabel);
        cardSettingsBtn.title = cardSettingsLabel;
        // Static SVG gear icon — no user-controlled content
        cardSettingsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary, #007CBE)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';

        // Add Reservation button
        const addBtn = document.createElement('button');
        addBtn.className = 'sc-btn sc-btn--primary sc-btn--add';
        addBtn.type = 'button';
        // Visible "+" with screen-reader-only "Add Reservation" text for a11y + E2E compat
        const plusSpan = document.createElement('span');
        plusSpan.setAttribute('aria-hidden', 'true');
        plusSpan.textContent = '+';
        const srLabel = document.createElement('span');
        srLabel.className = 'sr-only';
        srLabel.textContent = this._t('addReservation');
        addBtn.appendChild(plusSpan);
        addBtn.appendChild(srLabel);
        addBtn.setAttribute('aria-label', this._t('addReservation'));

        this._group.appendChild(printBtn);
        this._group.appendChild(cardSettingsBtn);
        this._group.appendChild(addBtn);

        // Event delegation
        this._handleClick = (e) => {
            const btn = e.target.closest('.sc-btn');
            if (!btn) {
                return;
            }

            if (btn.classList.contains('sc-btn--print')) {
                this.bus.emit('print:requested');
            } else if (btn.classList.contains('sc-btn--card-settings')) {
                this.bus.emit('cardSettings:click');
            } else if (btn.classList.contains('sc-btn--add')) {
                this.bus.emit('slot:click', {
                    date: this.state.currentDate ?? getCurrentDate(),
                    time: getCurrentTime(),
                    resourceId: null
                });
            }
        };
        this._group.addEventListener('click', this._handleClick);

        container.appendChild(this._group);
    }

    /**
     * Clean up listeners and DOM
     */
    destroy() {
        this._group?.removeEventListener('click', this._handleClick);
        this._group?.remove();
        this._group = null;
    }
}
