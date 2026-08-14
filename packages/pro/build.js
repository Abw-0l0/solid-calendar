import * as esbuild from 'esbuild';
import { mkdirSync, readFileSync, statSync } from 'fs';
import { gzipSync } from 'zlib';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

const common = {
    entryPoints: ['src/index.js'],
    bundle: true,
    target: ['es2020'],
    logLevel: 'info',
    banner: { js: `/*! ${pkg.name} v${pkg.version} | MIT | ${pkg.homepage} */` },
};

// steadycalendar is a peer dependency and must stay external everywhere.
const PEER = ['steadycalendar'];

/**
 * @holiday-jp/holiday_jp is a real runtime dependency, so bundler-facing builds leave it
 * external and let the host resolve it. The <script> artifact has no resolver, so it must
 * be bundled in — leaving it external there produces exactly the module-scope __require
 * call that made the core's browser build unloadable.
 */
const DEPS = ['@holiday-jp/holiday_jp'];

const targets = [
    { outfile: 'dist/calendar-pro.esm.js', format: 'esm', sourcemap: true, external: [...PEER, ...DEPS] },
    { outfile: 'dist/calendar-pro.cjs', format: 'cjs', sourcemap: true, external: [...PEER, ...DEPS] },
    {
        outfile: 'dist/calendar-pro.global.js',
        format: 'iife',
        globalName: 'SteadyCalendarPro',
        sourcemap: true,
        external: PEER,
    },
    {
        outfile: 'dist/calendar-pro.global.min.js',
        format: 'iife',
        globalName: 'SteadyCalendarPro',
        minify: true,
        external: PEER,
    },
];

async function build() {
    mkdirSync('dist', { recursive: true });
    await Promise.all(targets.map((t) => esbuild.build({ ...common, ...t })));

    console.log('');
    const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
    for (const { outfile } of targets) {
        const raw = statSync(outfile).size;
        const gzip = gzipSync(readFileSync(outfile), { level: 9 }).length;
        console.log(`  ${outfile.padEnd(34)} ${kb(raw).padStart(10)} ${kb(gzip).padStart(10)} gzip`);
    }
}

build().catch((e) => { console.error(e); process.exit(1); });
