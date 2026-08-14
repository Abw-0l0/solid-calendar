import { createTranslator } from '../core/Translations.js';
import { RESOURCE_TYPES } from '../core/CalendarConfig.js';
/**
 * StaffFilter — Staff checkbox dropdown with drag-to-reorder
 *
 * Displays the primary resources with checkboxes and colored dots.
 * Supports HTML5 drag-and-drop reordering for column order.
 * Includes a "Select All" toggle to check/uncheck all at once.
 */
export default class StaffFilter {
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
        this._listEl = null;
        this._handleClick = null;
        this._handleOutsideClick = null;
        this._dragSrcEl = null;
        this._unsubs = [];
        this._dragHandlers = {};
    }

    /**
     * Build staff filter dropdown and mount into container
     * @param {HTMLElement} container
     */
    init(container) {
        this.container = container;

        this._wrapper = document.createElement('div');
        this._wrapper.className = 'sc-toolbar-group';
        this._wrapper.style.position = 'relative';

        // Trigger button
        this._triggerBtn = document.createElement('button');
        this._triggerBtn.className = 'sc-btn';
        this._triggerBtn.type = 'button';
        this._triggerBtn.textContent = this._t('staffDisplay') + ' \u25BE';
        this._triggerBtn.setAttribute('aria-haspopup', 'listbox');
        this._triggerBtn.setAttribute('aria-expanded', 'false');

        // Dropdown container
        this._dropdown = document.createElement('div');
        this._dropdown.className = 'sc-dropdown sc-staff-filter';
        this._dropdown.style.minWidth = '194px';

        // Header
        const header = document.createElement('div');
        header.className = 'sc-dropdown-item';
        header.style.fontWeight = '600';
        header.style.fontSize = '14px';
        header.style.cursor = 'default';
        header.textContent = this._t('staff');

        this._dropdown.appendChild(header);

        // List container
        this._listEl = document.createElement('div');
        this._listEl.setAttribute('role', 'listbox');
        this._dropdown.appendChild(this._listEl);

        this._wrapper.appendChild(this._triggerBtn);
        this._wrapper.appendChild(this._dropdown);

        // Click delegation
        this._handleClick = (e) => {
            const trigger = e.target.closest('.sc-btn');
            if (trigger === this._triggerBtn) {
                this._toggleDropdown();
                return;
            }

            // Handle clicks anywhere in a staff filter item row
            const item = e.target.closest('.sc-staff-filter-item');
            if (item) {
                const checkbox = item.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    // Toggle if click was not directly on the checkbox (browser already toggled it)
                    if (e.target !== checkbox) {
                        checkbox.checked = !checkbox.checked;
                    }
                    this._onCheckboxChange(checkbox);
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

        // Populate staff list
        this._buildList();

        this._unsubs.push(
            this.bus.on('filter:changed', () => this._syncCheckboxes()),
            // _syncCheckboxes can only tick existing rows; when resources arrive the list
            // has to be rebuilt, or the dropdown stays empty until it is next opened.
            this.bus.on('resources:loaded', () => this._buildList()),
        );
    }

    /**
     * @returns {Array} staff resources only, excluding rooms and equipment
     */
    _staffResources() {
        return this.state.resources.filter((r) => r.type === RESOURCE_TYPES.STAFF);
    }

    /**
     * Build the staff list items from state.resources
     */
    _buildList() {
        if (!this._listEl) {
            return;
        }

        // Clear existing
        while (this._listEl.firstChild) {
            this._listEl.removeChild(this._listEl.firstChild);
        }

        // "Select All" option
        const selectAllItem = this._createSelectAllItem();
        this._listEl.appendChild(selectAllItem);

        // Staff items
        const staffResources = this._staffResources();
        for (const staff of staffResources) {
            const item = this._createStaffItem(staff);
            this._listEl.appendChild(item);
        }
    }

    /**
     * Create the "Select All" option
     * @returns {HTMLElement}
     */
    _createSelectAllItem() {
        const item = document.createElement('div');
        item.className = 'sc-staff-filter-item';
        item.dataset.staffId = 'all';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = 'all';
        checkbox.className = 'sc-staff-checkbox';

        // Check whether every primary resource is selected
        const staffResources = this._staffResources();
        const filters = this.state.staffFilters.map(String);
        checkbox.checked = staffResources.length > 0 && staffResources.every((t) => filters.includes(String(t.id)));
        checkbox.indeterminate = filters.length > 0 && filters.length < staffResources.length;

        const dot = document.createElement('span');
        dot.className = 'sc-color-dot';
        dot.style.backgroundColor = '#C1C1C1';

        const label = document.createElement('span');
        label.textContent = this._t('selectAll');

        item.appendChild(checkbox);
        item.appendChild(dot);
        item.appendChild(label);

        return item;
    }

    /**
     * Create a staff list item with checkbox, color dot, and name
     * @param {{ id: string, title: string, color: string }} staff
     * @returns {HTMLElement}
     */
    _createStaffItem(staff) {
        const item = document.createElement('div');
        item.className = 'sc-staff-filter-item sc-staff-filter-item--draggable';
        item.dataset.staffId = staff.id;
        item.draggable = true;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = staff.id;
        checkbox.className = 'sc-staff-checkbox';
        checkbox.checked = this.state.staffFilters.map(String).includes(String(staff.id));

        const dot = document.createElement('span');
        dot.className = 'sc-color-dot';
        dot.style.backgroundColor = staff.color ?? '#999';

        const label = document.createElement('span');
        label.textContent = staff.title;

        item.appendChild(checkbox);
        item.appendChild(dot);
        item.appendChild(label);

        // Drag handlers
        item.addEventListener('dragstart', (e) => this._onDragStart(e, item));
        item.addEventListener('dragover', (e) => this._onDragOver(e));
        item.addEventListener('drop', (e) => this._onDrop(e, item));
        item.addEventListener('dragend', () => this._onDragEnd());

        return item;
    }

    /**
     * Handle checkbox change
     * @param {HTMLInputElement} checkbox
     */
    _onCheckboxChange(checkbox) {
        if (checkbox.value === 'all') {
            if (checkbox.checked) {
                // Select every primary resource id
                const allIds = this.state.resources
                    .filter((r) => r.type === RESOURCE_TYPES.STAFF)
                    .map((r) => r.id);
                this.state.setStaffFilters(allIds);
            } else {
                // Select none
                this.state.setStaffFilters([]);
            }
            return;
        }

        const checkboxes = this._listEl.querySelectorAll('.sc-staff-checkbox');
        const checkedIds = [];
        for (const cb of checkboxes) {
            if (cb.value !== 'all' && cb.checked) {
                checkedIds.push(cb.value);
            }
        }
        this.state.setStaffFilters(checkedIds);
    }

    /**
     * Sync checkbox states with current staff filters
     */
    _syncCheckboxes() {
        if (!this._listEl) {
            return;
        }
        const filters = this.state.staffFilters;
        const staffResources = this._staffResources();
        const checkboxes = this._listEl.querySelectorAll('.sc-staff-checkbox');
        for (const cb of checkboxes) {
            if (cb.value === 'all') {
                cb.checked = filters.length === staffResources.length && staffResources.length > 0;
                cb.indeterminate = filters.length > 0 && filters.length < staffResources.length;
                continue;
            }
            cb.checked = filters.map(String).includes(String(cb.value));
        }
    }

    /**
     * Drag start handler
     * @param {DragEvent} e
     * @param {HTMLElement} item
     */
    _onDragStart(e, item) {
        this._dragSrcEl = item;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset.staffId);
        item.style.opacity = '0.5';
    }

    /**
     * Drag over handler
     * @param {DragEvent} e
     */
    _onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    /**
     * Drop handler — reorder items
     * @param {DragEvent} e
     * @param {HTMLElement} targetItem
     */
    _onDrop(e, targetItem) {
        e.preventDefault();
        if (!this._dragSrcEl || this._dragSrcEl === targetItem) {
            return;
        }

        // Reorder in DOM
        const parent = this._dragSrcEl.parentNode;
        const allItems = [...parent.querySelectorAll('.sc-staff-filter-item--draggable')];
        const srcIdx = allItems.indexOf(this._dragSrcEl);
        const tgtIdx = allItems.indexOf(targetItem);

        if (srcIdx < tgtIdx) {
            parent.insertBefore(this._dragSrcEl, targetItem.nextSibling);
        } else {
            parent.insertBefore(this._dragSrcEl, targetItem);
        }

        // Emit new order
        this._emitReorderedFilters();
    }

    /**
     * Drag end handler — restore opacity
     */
    _onDragEnd() {
        if (this._dragSrcEl) {
            this._dragSrcEl.style.opacity = '';
            this._dragSrcEl = null;
        }
    }

    /**
     * Emit reordered staff filters (preserving checked state)
     */
    _emitReorderedFilters() {
        const checkboxes = this._listEl.querySelectorAll('.sc-staff-checkbox');
        const checkedIds = [];
        for (const cb of checkboxes) {
            if (cb.value !== 'all' && cb.checked) {
                checkedIds.push(cb.value);
            }
        }
        this.state.setStaffFilters(checkedIds);
    }

    /**
     * Toggle dropdown open/closed
     */
    _toggleDropdown() {
        const isOpen = this._dropdown.classList.contains('sc-dropdown--open');
        if (isOpen) {
            this._closeDropdown();
        } else {
            // Rebuild list in case resources changed
            this._buildList();
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
        this._listEl = null;
        this._dragSrcEl = null;
    }
}
