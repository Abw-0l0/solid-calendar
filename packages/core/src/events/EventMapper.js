/**
 * EventMapper — normalises raw event objects into the internal event shape.
 *
 * Together with CalendarApp._buildResources this is one of only two places that read
 * raw incoming field names, and it does so through the compiled field map rather than
 * hardcoding them. Everything downstream reads the normalised shape. That boundary is
 * what stops raw-shape knowledge leaking into renderers, which is how the resource filter,
 * the ListView columns and the event-card service line all came to read fields nothing
 * ever wrote. tests/graph.test.js enforces it.
 */
import { translate } from '../core/Translations.js';
import { compileFieldMap } from '../core/FieldMap.js';
import { DEFAULT_RESOURCE_COLOR, DEFAULT_NEUTRAL_COLOR } from '../core/CalendarConfig.js';

export default class EventMapper {
    constructor(state, bus, config) {
        this.state = state;
        this.bus = bus;
        this.config = config;
        this.fields = compileFieldMap(config?.fieldMap);
    }

    mapAll(rawEvents) {
        if (!Array.isArray(rawEvents)) return [];
        const f = this.fields;
        const events = [];
        const isResourceView = this.state.isResourceView;
        const eventTypeResolver = this.config.eventTypeResolver;
        const statusResolver = this.config.statusResolver;

        for (const raw of rawEvents) {
            const resourceOwner = f.event.owner(raw) ?? null;
            const client = f.event.client(raw) ?? null;
            const title = f.event.title(raw);
            const eventType = typeof eventTypeResolver === 'function'
                ? eventTypeResolver(raw)
                : (title?.trim() ? 'timeblock' : 'event');
            const status = typeof statusResolver === 'function'
                ? statusResolver(raw)
                : { cancelled: raw.status === 'Cancelled' };
            const isTimeBlock = eventType === 'timeblock';
            const isCancelled = status.cancelled ?? false;

            if (isTimeBlock) {
                this._mapTimeBlock(raw, resourceOwner, isResourceView, isCancelled, events);
            } else if (this._ownerId(resourceOwner) != null) {
                this._mapEvent(raw, resourceOwner, client, isCancelled, events);
            }

            const secondaryResources = f.event.secondaryResources(raw) ?? [];
            if (secondaryResources.length > 0 && isResourceView) {
                this._mapSecondaryResourceEvents(raw, resourceOwner, client, isTimeBlock, isCancelled, events);
            }
        }
        return events;
    }

    mapOne(raw) { return this.mapAll([raw]); }

    /**
     * Owner ids go through the same reader CalendarApp._buildResources uses, so a payload
     * keyed by `uuid` cannot build columns and then silently drop every event against them.
     */
    _ownerId(owner) {
        return owner ? this.fields.resource.id(owner) ?? null : null;
    }

    _ownerColor(owner, fallback) {
        return (owner ? this.fields.resource.color(owner) : undefined) ?? fallback;
    }

    _mapTimeBlock(raw, resourceOwner, isResourceView, isCancelled, events) {
        const title = this.fields.event.title(raw) ?? '';
        const owners = this.fields.event.owners(raw) ?? [];

        if (owners.length > 0) {
            if (isResourceView) {
                for (const owner of owners) {
                    const ownerId = this._ownerId(owner);
                    if (ownerId != null) {
                        events.push(this._createEvent(raw, {
                            title, resourceId: ownerId, resourceOwner: owner,
                            color: this._ownerColor(owner, DEFAULT_NEUTRAL_COLOR),
                            isTimeBlock: true, isCancelled
                        }));
                    }
                }
            } else {
                const primary = owners[0];
                const suffix = owners.length > 1 ? this._multiOwnerSuffix(owners.length) : '';
                events.push(this._createEvent(raw, {
                    title: title + suffix, resourceId: this._ownerId(primary),
                    resourceOwner: primary, color: this._ownerColor(primary, DEFAULT_NEUTRAL_COLOR),
                    isTimeBlock: true, isCancelled
                }));
            }
        } else if (this._ownerId(resourceOwner) != null) {
            events.push(this._createEvent(raw, {
                title, resourceId: this._ownerId(resourceOwner), resourceOwner,
                color: this._ownerColor(resourceOwner, DEFAULT_NEUTRAL_COLOR),
                isTimeBlock: true, isCancelled
            }));
        } else if (!isResourceView) {
            events.push(this._createEvent(raw, {
                title, resourceId: 'no-resource', resourceOwner: null,
                color: DEFAULT_NEUTRAL_COLOR, isTimeBlock: true, isCancelled
            }));
        }
    }

    _multiOwnerSuffix(count) {
        return ` ${translate(this.config.translations, 'multipleResources', { count })}`;
    }

    _mapEvent(raw, resourceOwner, client, isCancelled, events) {
        const clientName = this._clientName(client);
        const service = this.fields.event.service(raw) ?? null;
        const serviceName = (service ? this.fields.service.name(service) : '') ?? '';
        const title = serviceName ? `${clientName}\n${serviceName}` : clientName;

        events.push(this._createEvent(raw, {
            title, resourceId: this._ownerId(resourceOwner), resourceOwner, client, service,
            color: this._ownerColor(resourceOwner, DEFAULT_RESOURCE_COLOR),
            isTimeBlock: false, isCancelled
        }));
    }

    _clientName(client) {
        const name = client ? this.fields.client.name(client) : undefined;
        return name ?? translate(this.config.translations, 'unknownClient');
    }

    _mapSecondaryResourceEvents(raw, resourceOwner, client, isTimeBlock, isCancelled, events) {
        const f = this.fields;
        const secondaryResources = f.event.secondaryResources(raw) ?? [];
        const blockTitle = f.event.title(raw) ?? '';

        for (const resource of secondaryResources) {
            const title = isTimeBlock
                ? blockTitle
                : (f.client.name(client ?? {}) ?? translate(this.config.translations, 'reserved'));
            events.push(this._createEvent(raw, {
                title, resourceId: `secondary-${f.secondaryResource.id(resource)}`, resourceOwner,
                color: f.secondaryResource.color(resource) ?? DEFAULT_NEUTRAL_COLOR,
                isTimeBlock, isCancelled,
                isSecondaryResourceEvent: true
            }));
        }
    }

    _createEvent(raw, overrides) {
        const f = this.fields;
        const owner = overrides.resourceOwner ?? null;

        // Resolved once here so the group class, the group indicator and the connector
        // bars all agree. They previously read two different raw keys, so a payload got
        // the styling or the indicator but never both.
        const groupId = f.event.groupId(raw) ?? null;

        const classNames = [];
        if (overrides.isCancelled) classNames.push('sc-event--cancelled');
        if (overrides.isTimeBlock) classNames.push('sc-event--timeblock');
        if (groupId) classNames.push('sc-event--group');

        // Resolved before the callback runs, not inside the return literal below.
        // They used to be computed afterwards, so a resolveEventFields callback reading
        // mapped.clientName — the obvious thing to reach for, and what the field is named
        // for — got undefined and rendered a blank line.
        const resourceOwnerId = this._ownerId(owner);
        const resourceOwnerName = (owner ? f.resource.name(owner) : '') ?? '';
        const clientName = (overrides.client ? f.client.name(overrides.client) : '') ?? '';
        const serviceName = (overrides.service ? f.service.name(overrides.service) : '') ?? '';

        const resolveEventFields = this.config.callbacks?.resolveEventFields;
        let textFields = {};
        let badges = [];
        if (typeof resolveEventFields === 'function') {
            const resolved = resolveEventFields(raw, {
                ...overrides, resourceOwnerId, resourceOwnerName, clientName, serviceName, groupId
            });
            textFields = resolved?.textFields ?? {};
            badges = resolved?.badges ?? [];
        }

        return {
            id: f.event.id(raw) ?? '',
            title: overrides.title ?? '',
            date: f.event.date(raw),
            startTime: f.event.startTime(raw),
            endTime: f.event.endTime(raw),
            start: f.event.date(raw),
            end: f.event.date(raw),
            resourceId: overrides.resourceId ?? null,
            color: overrides.color ?? DEFAULT_RESOURCE_COLOR,
            isTimeBlock: overrides.isTimeBlock ?? false,
            isCancelled: overrides.isCancelled ?? false,
            isSecondaryResourceEvent: overrides.isSecondaryResourceEvent ?? false,
            client: overrides.client ?? null,
            resourceOwner: owner,
            service: overrides.service ?? null,

            // Normalised projections, so renderers never touch the raw shape.
            resourceOwnerId,
            resourceOwnerName,
            clientName,
            serviceName,
            groupId,
            /** Exempt from the resource filter — a system or all-resource booking. */
            ignoresResourceFilter: (owner ? f.resource.systemFlag(owner) : false) === true,

            textFields, badges,
            sourceData: raw,
            classNames
        };
    }

    init() {}
    destroy() {}
}
