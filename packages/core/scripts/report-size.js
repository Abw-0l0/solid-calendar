/**
 * report-size — print raw and gzip sizes for every built artifact.
 * Uses zlib rather than piping to `wc -c`, which does not exist on Windows.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { gzipSync } from 'zlib';

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

const files = readdirSync('dist')
    .filter((f) => !f.endsWith('.map'))
    .sort();

if (!files.length) {
    console.error('report-size: dist/ is empty — run `npm run build` first');
    process.exit(1);
}

console.log(`${'artifact'.padEnd(30)}${'raw'.padStart(10)}${'gzip'.padStart(10)}`);
for (const name of files) {
    const path = join('dist', name);
    const raw = statSync(path).size;
    const gzip = gzipSync(readFileSync(path), { level: 9 }).length;
    console.log(`${name.padEnd(30)}${kb(raw).padStart(10)}${kb(gzip).padStart(10)}`);
}
