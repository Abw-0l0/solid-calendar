/**
 * PluginManager — Manages calendar plugins
 */
export default class PluginManager {
    constructor() {
        this._plugins = new Map();
    }

    register(plugin, context) {
        if (!plugin?.name) {
            console.error('[SolidCalendar:PluginManager] Plugin must have a name');
            return;
        }
        if (this._plugins.has(plugin.name)) {
            console.warn(`[SolidCalendar:PluginManager] Plugin '${plugin.name}' already registered`);
            return;
        }
        this._plugins.set(plugin.name, plugin);
        if (typeof plugin.init === 'function') plugin.init(context);
    }

    get(name) { return this._plugins.get(name); }

    /**
     * First registered plugin matching a predicate, or null.
     * Used to discover capability interfaces a plugin also implements.
     * @param {(plugin: object) => boolean} predicate
     * @returns {object|null}
     */
    find(predicate) {
        for (const plugin of this._plugins.values()) {
            if (predicate(plugin)) return plugin;
        }
        return null;
    }

    destroy() {
        for (const plugin of this._plugins.values()) {
            if (typeof plugin.destroy === 'function') plugin.destroy();
        }
        this._plugins.clear();
    }
}
