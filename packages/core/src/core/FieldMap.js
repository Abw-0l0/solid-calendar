/**
 * FieldMap — how incoming data is read.
 *
 * This library normalises whatever shape your API returns into one internal event and
 * resource shape. The field names it looks for are declared here rather than hardcoded
 * at the read sites, so any domain can describe its own payload without reshaping it:
 *
 *     new CalendarApp({
 *       fieldMap: {
 *         dataset: { resources: 'crew', secondaryResources: 'bays' },
 *         event:   { id: 'ref', date: 'on', startTime: 'from', endTime: 'to',
 *                    owner: 'assignedTo', client: 'booker', service: 'job' },
 *       },
 *     })
 *
 * A field spec is a name, an ordered list of candidate names, or a function. Names may
 * be dotted paths ('service.name'). The first candidate resolving to a non-nullish value
 * wins, matching the `a ?? b` chains this replaced — so '' and 0 are hits, not misses.
 *
 * A user entry REPLACES that key's candidate list rather than extending it; otherwise a
 * default could never be removed. Spread DEFAULT_FIELD_MAP to extend instead:
 *
 *     event: { owner: ['assignedTo', ...DEFAULT_FIELD_MAP.event.owner] }
 *
 * Merging is per key, so overriding `event.owner` leaves `event.client` alone.
 *
 * The one rule that keeps this honest: raw field names are read HERE and nowhere else.
 * EventMapper and CalendarApp._buildResources are the only callers; every renderer reads
 * the normalised shape. tests/graph.test.js enforces it.
 */

/**
 * Expected shape per field, applied by the compiler so a call site cannot forget it.
 *
 * This exists because `staff` used to appear in both the singular owner chain and the
 * plural owners chain — the same key meaning an object in one place and an array in the
 * other. Coercing by declared kind makes a wrong-shaped hit fall through to the next
 * candidate instead of corrupting the mapping. Kinds are a library contract, so they are
 * deliberately not user-configurable.
 *
 * @type {Record<string, Record<string, 'object' | 'array'>>}
 */
const FIELD_KINDS = {
    dataset: {
        resources: 'array',
        secondaryResources: 'array',
        businessHours: 'array',
        businessOverrides: 'array',
    },
    event: {
        owner: 'object',
        owners: 'array',
        client: 'object',
        service: 'object',
        secondaryResources: 'array',
    },
};

/** Generic field names, used when `fieldMap` is absent or a key is unset. */
export const DEFAULT_FIELD_MAP = Object.freeze({
    dataset: Object.freeze({
        resources: ['resources', 'assignees'],
        secondaryResources: ['secondaryResources', 'rooms'],
        businessHours: ['businessHours'],
        businessOverrides: ['businessOverrides'],
        holidaySettings: ['holidaySettings'],
        publicHolidays: ['publicHolidays'],
    }),
    event: Object.freeze({
        id: ['id', 'uuid'],
        date: ['date'],
        startTime: ['start_time', 'startTime'],
        endTime: ['end_time', 'endTime'],
        title: ['title'],
        owner: ['assignee', 'owner'],
        owners: ['assignees', 'owners'],
        client: ['client', 'attendee'],
        service: ['service'],
        secondaryResources: ['secondaryResources'],
        groupId: ['groupId', 'group_id'],
    }),
    resource: Object.freeze({
        id: ['id', 'uuid'],
        name: ['name'],
        color: ['color'],
        closedDays: ['closedDays', 'closed_days'],
        order: ['order'],
        schedules: ['schedules', 'staffSchedules'],
        overrides: ['overrides', 'staffOverrides'],
        systemFlag: ['isSystemResource'],
    }),
    secondaryResource: Object.freeze({
        id: ['id', 'uuid'],
        name: ['name'],
        color: ['color'],
        order: ['order'],
    }),
    client: Object.freeze({ name: ['name', 'full_name'] }),
    service: Object.freeze({ name: ['name', 'title'] }),
});

/**
 * The field names this library used before it was made domain-neutral, kept as a preset
 * so an existing healthcare payload migrates in one line:
 *
 *     new CalendarApp({ fieldMap: HEALTHCARE_FIELD_MAP, ... })
 *
 * Note `staff` appearing in both `owner` and `owners`: that is only safe because the
 * compiler now disambiguates them by shape.
 */
export const HEALTHCARE_FIELD_MAP = Object.freeze({
    dataset: Object.freeze({
        resources: ['therapists', 'staff', 'assignees'],
        secondaryResources: ['equipment', 'resources', 'rooms'],
        businessHours: ['businessHours', 'facilityBusinessHours'],
        businessOverrides: ['businessOverrides', 'facilityBusinessOverrides'],
        holidaySettings: ['holidaySettings', 'facilityHolidaySettings'],
    }),
    event: Object.freeze({
        owner: ['therapist', 'staff', 'assignee'],
        owners: ['therapists', 'staff', 'assignees'],
        client: ['patient', 'client', 'attendee'],
        service: ['menu', 'service'],
        secondaryResources: ['equipment', 'secondaryResources'],
        groupId: ['set_menu_id', 'groupId', 'group_id'],
    }),
    resource: Object.freeze({
        name: ['full_name', 'name'],
        color: ['booking_color', 'color'],
        systemFlag: ['is_system_staff'],
    }),
    client: Object.freeze({ name: ['full_name', 'name'] }),
});

const ENTITIES = Object.keys(DEFAULT_FIELD_MAP);

/** @returns {(value: any) => any} */
function coercerFor(kind) {
    if (kind === 'array') return (v) => (Array.isArray(v) ? v : undefined);
    if (kind === 'object') return (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : undefined);
    return (v) => v;
}

function readPath(source, path) {
    let value = source;
    for (const key of path) {
        if (value == null) return undefined;
        value = value[key];
    }
    return value;
}

/**
 * Build a reader for one field. The spec is normalised and any dotted paths are split
 * once here rather than on every event.
 */
function compileAccessor(spec, kind) {
    const coerce = coercerFor(kind);

    if (typeof spec === 'function') {
        return (source) => coerce(spec(source));
    }

    const candidates = (Array.isArray(spec) ? spec : [spec]).filter((c) => typeof c === 'string' && c);
    const paths = candidates.map((c) => (c.includes('.') ? c.split('.') : c));

    if (paths.length === 1 && typeof paths[0] === 'string') {
        const key = paths[0];
        return (source) => coerce(source?.[key]);
    }

    return (source) => {
        if (source == null) return undefined;
        for (const path of paths) {
            const raw = typeof path === 'string' ? source[path] : readPath(source, path);
            if (raw == null) continue;
            const value = coerce(raw);
            if (value !== undefined) return value;
        }
        return undefined;
    };
}

// Compiled maps are cached by the identity of the user's fieldMap object, so several
// CalendarApp instances sharing one config compile once.
const _cache = new WeakMap();
let _defaultCompiled = null;

/**
 * @param {object} [userMap] the value of `config.fieldMap`
 * @returns {Record<string, Record<string, (source: any) => any>>} readers, by entity
 */
export function compileFieldMap(userMap) {
    if (!userMap) {
        if (!_defaultCompiled) _defaultCompiled = compile({});
        return _defaultCompiled;
    }
    let compiled = _cache.get(userMap);
    if (!compiled) {
        compiled = compile(userMap);
        _cache.set(userMap, compiled);
    }
    return compiled;
}

function compile(userMap) {
    const readers = {};
    for (const entity of ENTITIES) {
        const defaults = DEFAULT_FIELD_MAP[entity];
        const overrides = userMap[entity] ?? {};
        const kinds = FIELD_KINDS[entity] ?? {};
        const entityReaders = {};
        for (const field of Object.keys(defaults)) {
            const spec = Object.prototype.hasOwnProperty.call(overrides, field)
                ? overrides[field]
                : defaults[field];
            entityReaders[field] = compileAccessor(spec, kinds[field]);
        }
        readers[entity] = entityReaders;
    }
    return readers;
}

/**
 * Candidate names a reader looks for, for diagnostics. Returns [] for function specs.
 * @returns {string[]}
 */
export function candidateNames(entity, field, userMap) {
    const spec = userMap?.[entity]?.[field] ?? DEFAULT_FIELD_MAP[entity]?.[field];
    if (typeof spec === 'function') return [];
    return Array.isArray(spec) ? [...spec] : (typeof spec === 'string' ? [spec] : []);
}
