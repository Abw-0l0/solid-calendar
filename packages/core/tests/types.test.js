// @vitest-environment node
/**
 * The declarations must match what the modules actually export.
 *
 * They had drifted badly: 18 of 31 runtime exports were undeclared, so TypeScript users
 * got an error on more than half the public API. The `./headless` subpath also pointed at
 * the root declarations, which declare CalendarApp — a class headless does not export —
 * so TypeScript accepted an import that failed at runtime.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import * as index from '../src/index.js';
import * as headless from '../src/headless.js';

/** Every name a declaration file exports, following its `export * from` re-exports. */
function declaredNames(file, seen = new Set()) {
    if (seen.has(file)) return new Set();
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    const names = new Set();

    const DECL = /export\s+(?:declare\s+)?(?:class|const|function|namespace|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
    for (const m of source.matchAll(DECL)) names.add(m[1]);

    for (const m of source.matchAll(/export \* from '\.\/([\w.-]+)\.js';/g)) {
        for (const n of declaredNames(`types/${m[1]}.d.ts`, seen)) names.add(n);
    }
    return names;
}

describe('type declarations', () => {
    it('should_declare_every_runtime_export_of_the_package_root', () => {
        const declared = declaredNames('types/index.d.ts');
        const undeclared = Object.keys(index).filter((n) => !declared.has(n));
        expect(undeclared).toEqual([]);
    });

    it('should_declare_every_runtime_export_of_the_headless_entry', () => {
        const declared = declaredNames('types/headless.d.ts');
        const undeclared = Object.keys(headless).filter((n) => !declared.has(n));
        expect(undeclared).toEqual([]);
    });

    it('should_not_declare_CalendarApp_on_the_headless_entry', () => {
        // Declaring it would let TypeScript accept an import that fails at runtime.
        expect(declaredNames('types/headless.d.ts').has('CalendarApp')).toBe(false);
        expect(Object.keys(headless)).not.toContain('CalendarApp');
    });

    it('should_keep_the_headless_surface_a_subset_of_the_root', () => {
        const rootExports = new Set(Object.keys(index));
        const extra = Object.keys(headless).filter((n) => !rootExports.has(n));
        expect(extra).toEqual([]);
    });
});
