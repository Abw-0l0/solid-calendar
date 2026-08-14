/**
 * check-imports — resolve every module in src/, not just the ones index.js reaches.
 *
 * The normal build bundles a single entry point (src/index.js). Any module outside
 * that import graph is never resolved, so a broken import in it cannot fail the
 * build. That is exactly how four files came to import `getHoliday`/`getHolidayName`
 * from utils/temporal.js — which exports neither — while `npm run build` stayed green.
 *
 * This makes every source file an entry point, so every import is resolved.
 * Nothing is written to disk.
 */
import { readdirSync } from 'fs';
import { join, relative, sep } from 'path';
import * as esbuild from 'esbuild';

function collectSources(dir, acc = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) collectSources(path, acc);
        else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) acc.push(path);
    }
    return acc;
}

const entryPoints = collectSources('src');

try {
    await esbuild.build({
        entryPoints,
        bundle: true,
        write: false,
        outdir: 'virtual',
        format: 'esm',
        target: ['es2020'],
        logLevel: 'silent',
    });
    console.log('check-imports: ' + entryPoints.length + ' modules resolved, 0 errors');
} catch (err) {
    const errors = err.errors ?? [];
    // The same broken import is reported once per entry point that reaches it.
    const seen = new Set();
    for (const e of errors) {
        const loc = e.location
            ? relative(process.cwd(), e.location.file).split(sep).join('/') + ':' + e.location.line
            : '(unknown)';
        seen.add('  ' + loc + '  ' + e.text);
    }
    console.error('check-imports: FAILED — ' + seen.size + ' distinct problem(s) across ' + entryPoints.length + ' modules\n');
    for (const line of [...seen].sort()) console.error(line);
    process.exit(1);
}
