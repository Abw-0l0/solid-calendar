import { describe, it, expect } from 'vitest';
import {
    DEFAULT_FIELD_MAP, HEALTHCARE_FIELD_MAP, compileFieldMap, candidateNames,
} from './FieldMap.js';

describe('field map', () => {
    describe('candidate resolution', () => {
        it('should_take_the_first_non_nullish_candidate', () => {
            const f = compileFieldMap({ event: { id: ['a', 'b', 'c'] } });
            expect(f.event.id({ b: 'from-b', c: 'from-c' })).toBe('from-b');
        });

        it('should_treat_empty_string_and_zero_as_hits', () => {
            // Matches the `??` chains this replaced: a colour of '' or an order of 0 is
            // a supplied value, not a missing one.
            const f = compileFieldMap({ resource: { color: ['a', 'b'] } });
            expect(f.resource.color({ a: '', b: '#fff' })).toBe('');
            expect(f.resource.order({ order: 0 })).toBe(0);
        });

        it('should_return_undefined_when_no_candidate_matches', () => {
            const f = compileFieldMap();
            expect(f.event.title({})).toBeUndefined();
        });

        it('should_resolve_a_dotted_path', () => {
            const f = compileFieldMap({ event: { id: 'meta.ref.id' } });
            expect(f.event.id({ meta: { ref: { id: 'x' } } })).toBe('x');
        });

        it('should_not_throw_on_a_missing_intermediate', () => {
            const f = compileFieldMap({ event: { id: 'meta.ref.id' } });
            expect(() => f.event.id({})).not.toThrow();
            expect(f.event.id({ meta: null })).toBeUndefined();
        });

        it('should_accept_a_function_spec', () => {
            const f = compileFieldMap({ event: { id: (raw) => `${raw.a}-${raw.b}` } });
            expect(f.event.id({ a: 1, b: 2 })).toBe('1-2');
        });

        it('should_tolerate_a_nullish_source', () => {
            const f = compileFieldMap();
            expect(f.event.id(null)).toBeUndefined();
            expect(f.event.owners(undefined)).toBeUndefined();
        });
    });

    describe('shape coercion', () => {
        // The bug this exists for: `staff` used to sit in both the singular owner chain
        // and the plural owners chain — one key meaning two different shapes.
        it('should_skip_an_array_when_an_object_is_expected', () => {
            const f = compileFieldMap({ event: { owner: ['staff', 'assignee'] } });
            expect(f.event.owner({ staff: [{ id: 'a' }], assignee: { id: 'b' } })).toEqual({ id: 'b' });
        });

        it('should_skip_an_object_when_an_array_is_expected', () => {
            const f = compileFieldMap({ event: { owners: ['staff', 'assignees'] } });
            expect(f.event.owners({ staff: { id: 'a' }, assignees: [{ id: 'b' }] })).toEqual([{ id: 'b' }]);
        });

        it('should_let_one_key_serve_both_shapes', () => {
            const f = compileFieldMap(HEALTHCARE_FIELD_MAP);
            expect(f.event.owner({ staff: { id: 'solo' } })).toEqual({ id: 'solo' });
            expect(f.event.owners({ staff: [{ id: 'a' }, { id: 'b' }] })).toHaveLength(2);
            // ...and each ignores the other's shape rather than mis-reading it.
            expect(f.event.owner({ staff: [{ id: 'a' }] })).toBeUndefined();
            expect(f.event.owners({ staff: { id: 'solo' } })).toBeUndefined();
        });
    });

    describe('merging', () => {
        it('should_replace_a_key_rather_than_extend_it', () => {
            const f = compileFieldMap({ event: { owner: ['assignedTo'] } });
            expect(f.event.owner({ assignedTo: { id: 'x' } })).toEqual({ id: 'x' });
            // The default 'assignee' is gone, which is what makes defaults removable.
            expect(f.event.owner({ assignee: { id: 'y' } })).toBeUndefined();
        });

        it('should_leave_sibling_keys_at_their_defaults', () => {
            const f = compileFieldMap({ event: { owner: ['assignedTo'] } });
            expect(f.event.client({ client: { name: 'Jo' } })).toEqual({ name: 'Jo' });
        });

        it('should_leave_other_entities_at_their_defaults', () => {
            const f = compileFieldMap({ event: { owner: ['assignedTo'] } });
            expect(f.resource.name({ name: 'Alex' })).toBe('Alex');
            expect(f.dataset.resources({ resources: [1, 2] })).toEqual([1, 2]);
        });

        it('should_support_extending_by_spreading_the_defaults', () => {
            const f = compileFieldMap({
                event: { owner: ['assignedTo', ...DEFAULT_FIELD_MAP.event.owner] },
            });
            expect(f.event.owner({ assignedTo: { id: 'x' } })).toEqual({ id: 'x' });
            expect(f.event.owner({ assignee: { id: 'y' } })).toEqual({ id: 'y' });
        });
    });

    describe('caching', () => {
        it('should_compile_once_per_map_identity', () => {
            const map = { event: { id: 'ref' } };
            expect(compileFieldMap(map)).toBe(compileFieldMap(map));
        });

        it('should_share_one_compiled_instance_for_the_defaults', () => {
            expect(compileFieldMap()).toBe(compileFieldMap(undefined));
        });
    });

    describe('defaults', () => {
        it('should_carry_no_domain_vocabulary', () => {
            const flat = JSON.stringify(DEFAULT_FIELD_MAP);
            for (const name of ['therapist', 'patient', 'menu', 'equipment', 'booking_color', 'set_menu_id']) {
                expect(flat).not.toContain(name);
            }
        });

        it('should_keep_snake_case_api_conventions', () => {
            const f = compileFieldMap();
            expect(f.event.startTime({ start_time: '09:00' })).toBe('09:00');
            expect(f.event.groupId({ group_id: 'g1' })).toBe('g1');
            expect(f.resource.closedDays({ closed_days: [0] })).toEqual([0]);
            expect(f.event.id({ uuid: 'u1' })).toBe('u1');
        });

        it('should_be_frozen', () => {
            expect(Object.isFrozen(DEFAULT_FIELD_MAP)).toBe(true);
            expect(Object.isFrozen(DEFAULT_FIELD_MAP.event)).toBe(true);
        });
    });

    describe('candidateNames', () => {
        it('should_report_what_a_reader_looks_for', () => {
            expect(candidateNames('dataset', 'resources')).toEqual(['resources', 'assignees']);
            expect(candidateNames('dataset', 'resources', { dataset: { resources: 'crew' } })).toEqual(['crew']);
            expect(candidateNames('event', 'id', { event: { id: () => 1 } })).toEqual([]);
        });
    });
});
