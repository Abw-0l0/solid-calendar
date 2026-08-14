import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readFileSync, statSync } from 'fs';
import { gzipSync } from 'zlib';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const isWatch = process.argv.includes('--watch');

// Budget for the artifact CDN users load. The core has no runtime dependencies, so
// this number is the whole cost; if it moves, it should move deliberately.
const SIZE_BUDGET_GZIP = 40 * 1024;

const common = {
    entryPoints: ['src/index.js'],
    bundle: true,
    target: ['es2020'],
    logLevel: 'info',
    banner: { js: `/*! ${pkg.name} v${pkg.version} | ${pkg.license} | ${pkg.homepage} */` },
    // No `external`: the package has zero runtime dependencies, which is what lets the
    // iife artifact load from a <script> tag. Marking anything external here would
    // reintroduce a module-scope __require call that throws in a browser.
};

/**
 * esbuild has no `umd` format. Rather than hand-roll a wrapper around the iife output,
 * each consumer gets an artifact that does one job properly:
 *   .esm.js    bundlers and `import`
 *   .cjs       `require()` — the extension is required, since package.json is type:module
 *   .global.js a real <script> tag, self-contained, exposing window.SolidCalendar
 */
const targets = [
    // Headless: the pre-rendering surface, for hosts that draw the calendar themselves.
    { entryPoints: ['src/headless.js'], outfile: 'dist/calendar.headless.esm.js', format: 'esm', sourcemap: true },
    { entryPoints: ['src/headless.js'], outfile: 'dist/calendar.headless.min.js', format: 'esm', minify: true },
    { outfile: 'dist/calendar.esm.js', format: 'esm', sourcemap: true },
    { outfile: 'dist/calendar.esm.min.js', format: 'esm', minify: true },
    { outfile: 'dist/calendar.cjs', format: 'cjs', sourcemap: true },
    { outfile: 'dist/calendar.global.js', format: 'iife', globalName: 'SolidCalendar', sourcemap: true },
    { outfile: 'dist/calendar.global.min.js', format: 'iife', globalName: 'SolidCalendar', minify: true },
];

function report(file) {
    const raw = statSync(file).size;
    const gzip = gzipSync(readFileSync(file), { level: 9 }).length;
    const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
    console.log(`  ${file.padEnd(30)} ${kb(raw).padStart(10)} ${kb(gzip).padStart(10)} gzip`);
    return gzip;
}

async function build() {
    // recursive:true rather than an existsSync check: the builds below run in parallel
    // and would otherwise race each other to create the directory.
    mkdirSync('dist', { recursive: true });

    if (isWatch) {
        const contexts = await Promise.all(
            targets.filter((t) => !t.minify).map((t) => esbuild.context({ ...common, ...t })),
        );
        await Promise.all(contexts.map((c) => c.watch()));
        console.log('Watching...');
        return;
    }

    await Promise.all(targets.map((t) => esbuild.build({ ...common, ...t })));

    copyFileSync('src/styles/calendar.css', 'dist/calendar.css');

    console.log('');
    for (const { outfile } of targets) report(outfile);
    const cssGzip = report('dist/calendar.css');

    const browserGzip = gzipSync(readFileSync('dist/calendar.global.min.js'), { level: 9 }).length;
    if (browserGzip > SIZE_BUDGET_GZIP) {
        console.error(
            `\nBundle over budget: ${(browserGzip / 1024).toFixed(1)} kB gzip ` +
            `exceeds ${(SIZE_BUDGET_GZIP / 1024).toFixed(0)} kB. ` +
            'Reduce it, or raise SIZE_BUDGET_GZIP in build.js deliberately.',
        );
        process.exit(1);
    }
    console.log(
        `\n  browser bundle ${(browserGzip / 1024).toFixed(1)} kB gzip ` +
        `of ${(SIZE_BUDGET_GZIP / 1024).toFixed(0)} kB budget, plus ${(cssGzip / 1024).toFixed(1)} kB css`,
    );
}

build().catch((e) => { console.error(e); process.exit(1); });
