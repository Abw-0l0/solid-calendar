// @vitest-environment node
// esbuild refuses to run under jsdom, whose TextEncoder does not produce a real Uint8Array.
/**
 * Import-graph guard.
 *
 * The defect this exists for: ten modules — the entire rendering layer — compiled
 * cleanly, were covered by no test, and were reachable from nothing. init() wrote no
 * DOM and every check in the repo stayed green. A file that nothing imports is dead
 * weight at best and a silently missing feature at worst, so the graph is asserted.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join, relative, sep } from 'path';
import * as esbuild from 'esbuild';

const ENTRY = 'src/index.js';

/** Modules that are legitimately not part of the runtime graph. */
const ALLOWED_ORPHANS = new Set([
    // A second entry point, bundled separately.
    'src/headless.js',
]);

function collectSources(dir, acc = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) collectSources(path, acc);
        else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) acc.push(path);
    }
    return acc;
}

const posix = (p) => relative(process.cwd(), p).split(sep).join('/');

describe('module graph', () => {
    it('should_reach_every_source_module_from_the_entry_point', async () => {
        const result = await esbuild.build({
            entryPoints: [ENTRY],
            bundle: true,
            write: false,
            metafile: true,
            format: 'esm',
            target: ['es2020'],
            logLevel: 'silent',
        });

        const reached = new Set(Object.keys(result.metafile.inputs).map((p) => p.split(sep).join('/')));
        const orphans = collectSources('src')
            .map(posix)
            .filter((f) => !reached.has(f) && !ALLOWED_ORPHANS.has(f));

        // Before the rendering layer was wired this listed ViewManager, CalendarToolbar,
        // EventRenderer, the five interaction handlers, and both auxiliary renderers.
        expect(orphans).toEqual([]);
    });

    it('should_resolve_every_import_in_every_module', async () => {
        // The published build bundles one entry point, so a broken import inside a module
        // outside that graph cannot fail it. Making every file an entry point resolves
        // every import — this is what caught getHoliday/getHolidayName.
        const entryPoints = collectSources('src');

        await expect(
            esbuild.build({
                entryPoints,
                bundle: true,
                write: false,
                outdir: 'virtual',
                format: 'esm',
                target: ['es2020'],
                logLevel: 'silent',
            }),
        ).resolves.toBeDefined();
    });

    it('should_not_import_any_runtime_dependency', async () => {
        // Zero runtime dependencies is the design constraint the architecture is built
        // around, so it is asserted rather than trusted.
        const result = await esbuild.build({
            entryPoints: [ENTRY],
            bundle: true,
            write: false,
            metafile: true,
            format: 'esm',
            target: ['es2020'],
            logLevel: 'silent',
        });

        const external = Object.keys(result.metafile.inputs).filter((p) => p.includes('node_modules'));
        expect(external).toEqual([]);
    });
});

describe('raw-shape containment', () => {
    // Raw incoming field names belong in exactly two places: EventMapper and
    // CalendarApp._buildResources. When that leaked, three renderers ended up reading
    // fields the mapper never wrote — the staff filter silently stopped filtering, and
    // two ListView columns were permanently blank. Nothing failed, because nothing threw.
    const RENDER_DIRS = ['src/views', 'src/rendering', 'src/grid', 'src/toolbar'];
    const RENDER_FILES = ['src/events/EventRenderer.js', 'src/events/EventContentBuilder.js'];

    const FORBIDDEN = [
        'therapist', 'patient', 'booking_color', 'set_menu_id', 'full_name',
        'is_system_staff', 'facilityUuid', 'staticCalendarData',
    ];

    function renderSources() {
        const files = [...RENDER_FILES];
        for (const dir of RENDER_DIRS) files.push(...collectSources(dir));
        return [...new Set(files.map(posix))];
    }

    it('should_not_reference_raw_domain_field_names_in_any_renderer', () => {
        const offenders = [];
        for (const file of renderSources()) {
            const source = readFileSync(file, 'utf8');
            for (const name of FORBIDDEN) {
                if (source.includes(name)) offenders.push(`${file}: ${name}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it('should_not_read_event_sourceData_in_any_renderer', () => {
        // sourceData is the escape hatch for host callbacks, not for rendering. Reading it
        // from a renderer is how raw-shape knowledge creeps back in.
        const offenders = renderSources().filter((file) => readFileSync(file, 'utf8').includes('sourceData'));
        expect(offenders).toEqual([]);
    });
});
