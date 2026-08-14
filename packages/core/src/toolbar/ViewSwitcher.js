/**
 * ViewSwitcher — View type dropdown (Day, 3 Day, Week, Month, List)
 *
 * Shows resource views (resourceTimeGrid*) when in resource mode,
 * simple views (timeGrid*) otherwise. Also includes Month and List.
 */
import { createTranslator } from '../core/Translations.js';
import { VIEW_TYPES, isFlatMode } from '../core/CalendarConfig.js';

export default class ViewSwitcher {
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
        this._wrapper = null;
        this._triggerBtn = null;
        this._dropdown = null;
        this._handleClick = null;
        this._handleOutsideClick = null;
        this._unsubs = [];
    }

    /**
     * Build view switcher and mount into container
     * @param {HTMLElement} container
     */
    init(container) {
        this.container = container;

        this._wrapper = document.createElement('div');
        this._wrapper.className = 'sc-toolbar-group';
        this._wrapper.style.position = 'relative';
        this._triggerBtn = document.createElement('button');
        this._triggerBtn.className = 'sc-btn';
        this._triggerBtn.type = 'button';
        this._triggerBtn.setAttribute('aria-haspopup', 'listbox');
        this._triggerBtn.setAttribute('aria-expanded', 'false');

        // Dropdown
        this._dropdown = document.createElement('div');
        this._dropdown.className = 'sc-dropdown';
        this._dropdown.setAttribute('role', 'listbox');

        this._wrapper.appendChild(this._triggerBtn);
        this._wrapper.appendChild(this._dropdown);

        // Event delegation
        this._handleClick = (e) => {
            const trigger = e.target.closest('.sc-btn');
            if (trigger === this._triggerBtn) {
                this._toggleDropdown();
                return;
            }

            const item = e.target.closest('.sc-dropdown-item');
            if (item) {
                const view = item.dataset.view;
                if (view) {
                    this.state.setCurrentView(view);
                    // Month and List views have no resource columns — auto-switch to flat mode
                    if ((view === 'dayGridMonth' || view === 'list') && !isFlatMode(this.state.currentResourceMode)) {
                        this.state.setCurrentResourceMode('flatView');
                    }
                    this._closeDropdown();
                }
            }
        };
        this._wrapper.addEventListener('click', this._handleClick);

        // Close on outside click
        this._handleOutsideClick = (e) => {
            if (!this._wrapper.contains(e.target)) {
                this._closeDropdown();
            }
        };
        document.addEventListener('click', this._handleOutsideClick);

        container.appendChild(this._wrapper);

        // Listen for state changes
        this._unsubs.push(
            this.bus.on('view:changed', () => this._render()),
            this.bus.on('resource:changed', () => this._render())
        );

        this._render();
    }

    /**
     * Rebuild the dropdown items and update trigger label
     */
    _render() {
        const currentView = this.state.currentView;
        const isResource = this.state.isResourceView;

        // Update trigger button text
        const viewDef = VIEW_TYPES[currentView];
        const label = this.config.translations?.[currentView] ?? viewDef?.label ?? currentView;
        this._triggerBtn.textContent = label + ' \u25BE'; // ▾

        // Rebuild dropdown
        while (this._dropdown.firstChild) {
            this._dropdown.removeChild(this._dropdown.firstChild);
        }

        const viewEntries = this._getViewEntries(isResource);
        for (const entry of viewEntries) {
            const item = document.createElement('div');
            item.className = 'sc-dropdown-item';
            item.dataset.view = entry.key;
            item.setAttribute('role', 'option');
            item.textContent = this.config.translations?.[entry.key] ?? entry.label;

            if (entry.key === currentView) {
                item.classList.add('sc-dropdown-item--active');
                item.setAttribute('aria-selected', 'true');
            }

            this._dropdown.appendChild(item);
        }
    }

    /**
     * Get the list of view entries based on resource mode
     * @param {boolean} isResource
     * @returns {Array<{key: string, label: string}>}
     */
    _getViewEntries(isResource) {
        const entries = [];

        if (isResource) {
            entries.push({ key: 'resourceTimeGridDay', label: 'Day' });
            entries.push({ key: 'resourceTimeGridThreeDay', label: '3 Day' });
            entries.push({ key: 'resourceTimeGridWeek', label: 'Week' });
        } else {
            entries.push({ key: 'timeGridDay', label: 'Day' });
            entries.push({ key: 'timeGridThreeDay', label: '3 Day' });
            entries.push({ key: 'timeGridWeek', label: 'Week' });
        }

        entries.push({ key: 'dayGridMonth', label: 'Month' });
        entries.push({ key: 'list', label: 'List' });

        return entries;
    }

    /**
     * Toggle dropdown open/closed
     */
    _toggleDropdown() {
        const isOpen = this._dropdown.classList.contains('sc-dropdown--open');
        if (isOpen) {
            this._closeDropdown();
        } else {
            this._dropdown.classList.add('sc-dropdown--open');
            this._triggerBtn.setAttribute('aria-expanded', 'true');
        }
    }

    /**
     * Close the dropdown
     */
    _closeDropdown() {
        this._dropdown.classList.remove('sc-dropdown--open');
        this._triggerBtn.setAttribute('aria-expanded', 'false');
    }

    /**
     * Clean up listeners and DOM
     */
    destroy() {
        this._unsubs.forEach((fn) => fn());
        this._unsubs = [];
        this._wrapper?.removeEventListener('click', this._handleClick);
        document.removeEventListener('click', this._handleOutsideClick);
        this._wrapper?.remove();
        this._wrapper = null;
        this._triggerBtn = null;
        this._dropdown = null;
    }
}
