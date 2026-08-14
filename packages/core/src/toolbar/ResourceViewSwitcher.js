/**
 * ResourceViewSwitcher — Resource mode dropdown (Primary, Secondary, Integrated, Flat)
 *
 * Only visible when the current view is a resource view.
 * Switches between primary, secondary, integrated, and flat resource modes.
 */
import { translate } from '../core/Translations.js';
import { RESOURCE_MODES, VIEW_TYPES, isFlatMode } from '../core/CalendarConfig.js';

export default class ResourceViewSwitcher {
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
        this._wrapper = null;
        this._triggerBtn = null;
        this._dropdown = null;
        this._handleClick = null;
        this._handleOutsideClick = null;
        this._unsubs = [];
    }

    /**
     * Build resource view switcher and mount into container
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

        // Build dropdown items
        for (const [key, def] of Object.entries(RESOURCE_MODES)) {
            const item = document.createElement('div');
            item.className = 'sc-dropdown-item';
            item.dataset.mode = key;
            item.setAttribute('role', 'option');
            item.textContent = this.config.translations?.[key] ?? def.label;
            this._dropdown.appendChild(item);
        }

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
                const mode = item.dataset.mode;
                if (mode) {
                    this.state.setCurrentResourceMode(mode);
                    this._syncViewType(mode);
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
            this.bus.on('view:changed', () => this._updateVisibility()),
            this.bus.on('resource:changed', () => this._updateLabel())
        );

        this._updateLabel();
        this._updateVisibility();
    }

    /**
     * Sync view type when resource mode changes.
     * flatView -> timeGrid* (non-resource); others -> resourceTimeGrid* (resource)
     * @param {string} mode
     */
    _syncViewType(mode) {
        const currentView = this.state.currentView;
        const viewDef = VIEW_TYPES[currentView];
        if (!viewDef) return;

        const isFlat = isFlatMode(mode);
        const needsResource = !isFlat;
        const currentlyResource = viewDef.isResource;

        if (needsResource === currentlyResource) return;

        // Map between resource and non-resource view variants
        const viewMap = {
            timeGridDay: 'resourceTimeGridDay',
            timeGridThreeDay: 'resourceTimeGridThreeDay',
            timeGridWeek: 'resourceTimeGridWeek',
            resourceTimeGridDay: 'timeGridDay',
            resourceTimeGridThreeDay: 'timeGridThreeDay',
            resourceTimeGridWeek: 'timeGridWeek',
        };

        const newView = viewMap[currentView];
        if (newView) {
            this.state.setCurrentView(newView);
        }
    }

    /**
     * Update button label to match current resource mode
     */
    _updateLabel() {
        const mode = this.state.currentResourceMode;
        const def = RESOURCE_MODES[mode];
        const label = this.config.translations?.[mode] ?? def?.label ?? mode;
        this._triggerBtn.textContent = label + ' \u25BE'; // ▾

        // Update active state on items
        const items = this._dropdown.querySelectorAll('.sc-dropdown-item');
        for (const item of items) {
            if (item.dataset.mode === mode) {
                item.classList.add('sc-dropdown-item--active');
                item.setAttribute('aria-selected', 'true');
            } else {
                item.classList.remove('sc-dropdown-item--active');
                item.removeAttribute('aria-selected');
            }
        }
    }

    /**
     * Always visible — user must be able to switch resource mode from any view.
     * In Month/List views, lock the dropdown to flat mode only (no resource columns).
     */
    _updateVisibility() {
        if (!this._wrapper) {
            return;
        }
        this._wrapper.style.display = '';

        const view = this.state.currentView;
        const isNonResourceOnly = view === 'dayGridMonth' || view === 'list';

        // Hide non-flat items and disable toggle in Month/List views
        const items = this._dropdown.querySelectorAll('.sc-dropdown-item');
        for (const item of items) {
            item.style.display = (isNonResourceOnly && !isFlatMode(item.dataset.mode)) ? 'none' : '';
        }
        this._triggerBtn.disabled = isNonResourceOnly;
        this._triggerBtn.title = isNonResourceOnly ? translate(this.config.translations, 'resourceModeFixed') : '';
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
