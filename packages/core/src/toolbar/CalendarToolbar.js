/**
 * CalendarToolbar — Main toolbar compositor
 *
 * Creates the .sc-toolbar container and composes all sub-modules
 * in order: DateNavigation | spacer | ViewSwitcher | ResourceViewSwitcher |
 * StaffFilter | PrivacyToggle | ActionButtons.
 */
import { createTranslator } from '../core/Translations.js';
import DateNavigation from './DateNavigation.js';
import ViewSwitcher from './ViewSwitcher.js';
import ResourceViewSwitcher from './ResourceViewSwitcher.js';
import StaffFilter from './StaffFilter.js';
import PrivacyToggle from './PrivacyToggle.js';
import ActionButtons from './ActionButtons.js';

export default class CalendarToolbar {
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

        this._dateNavigation = new DateNavigation(state, bus, config);
        this._viewSwitcher = new ViewSwitcher(state, bus, config);
        this._resourceViewSwitcher = new ResourceViewSwitcher(state, bus, config);
        this._staffFilter = new StaffFilter(state, bus, config);
        this._privacyToggle = new PrivacyToggle(state, bus, config);
        this._actionButtons = new ActionButtons(state, bus, config);
    }

    /**
     * Build the toolbar and mount into the given container
     * @param {HTMLElement} container - Parent element to mount toolbar into
     */
    init(container) {
        // Create toolbar container
        this.container = document.createElement('div');
        this.container.className = 'sc-toolbar';
        this.container.setAttribute('role', 'toolbar');
        this.container.setAttribute('aria-label', this._t('calendarControls'));

        // Left group: Heading + DateNavigation
        const leftGroup = document.createElement('div');
        leftGroup.className = 'sc-toolbar-group';

        // Reuse SSR-rendered heading if present, otherwise create one
        const existingHeading = container.querySelector('h2.sc-heading');
        const heading = existingHeading || document.createElement('h2');
        heading.className = 'sc-heading';
        heading.textContent = this._t('Reservations');
        leftGroup.appendChild(heading);

        this._dateNavigation.init(leftGroup);
        this.container.appendChild(leftGroup);

        // Spacer
        const spacer = document.createElement('div');
        spacer.className = 'sc-toolbar-spacer';
        this.container.appendChild(spacer);

        // Right group: ViewSwitcher + ResourceViewSwitcher + StaffFilter + PrivacyToggle + ActionButtons
        const rightGroup = document.createElement('div');
        rightGroup.className = 'sc-toolbar-group';
        this._viewSwitcher.init(rightGroup);
        this._resourceViewSwitcher.init(rightGroup);
        this._staffFilter.init(rightGroup);
        this._privacyToggle.init(rightGroup);
        this._actionButtons.init(rightGroup);
        this.container.appendChild(rightGroup);

        // Insert toolbar before calendar content
        container.insertBefore(this.container, container.firstChild);
    }

    /**
     * Clean up all sub-modules and remove toolbar DOM
     */
    destroy() {
        this._dateNavigation.destroy();
        this._viewSwitcher.destroy();
        this._resourceViewSwitcher.destroy();
        this._staffFilter.destroy();
        this._privacyToggle.destroy();
        this._actionButtons.destroy();
        this.container?.remove();
        this.container = null;
    }
}
