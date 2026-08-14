/**
 * PrivacyToggle — Privacy mode toggle button
 *
 * Toggles privacy mode, which blurs client names and service details
 * on calendar events. Shows active styling when privacy is on.
 */
import { createTranslator } from '../core/Translations.js';

export default class PrivacyToggle {
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
        this._btn = null;
        this._handleClick = null;
        this._unsubs = [];
    }

    /**
     * Build privacy toggle button and mount into container
     * @param {HTMLElement} container
     */
    init(container) {
        this.container = container;

        this._btn = document.createElement('button');
        this._btn.className = 'sc-btn';
        this._btn.type = 'button';
        this._btn.setAttribute('aria-pressed', String(this.state.privacyMode));

        this._updateLabel();

        this._handleClick = () => {
            this.state.setPrivacyMode(!this.state.privacyMode);
        };
        this._btn.addEventListener('click', this._handleClick);

        container.appendChild(this._btn);

        // Listen for privacy state changes
        this._unsubs.push(this.bus.on('privacy:changed', () => this._updateLabel()));
    }

    /**
     * Update button label and active styling
     */
    _updateLabel() {
        if (!this._btn) {
            return;
        }

        const isActive = this.state.privacyMode;
        // Eye icon: open eye when privacy off, closed eye when on
        const icon = isActive ? '\uD83D\uDE48' : '\uD83D\uDC41'; // 🙈 or 👁
        this._btn.textContent = icon;
        this._btn.setAttribute('aria-pressed', String(isActive));
        this._btn.setAttribute('aria-label', this._t('privacyMode'));

        if (isActive) {
            this._btn.classList.add('sc-btn--active');
        } else {
            this._btn.classList.remove('sc-btn--active');
        }
    }

    /**
     * Clean up listeners and DOM
     */
    destroy() {
        this._unsubs.forEach((fn) => fn());
        this._unsubs = [];
        this._btn?.removeEventListener('click', this._handleClick);
        this._btn?.remove();
        this._btn = null;
    }
}
