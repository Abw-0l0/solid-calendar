/**
 * verify-pack — assert every path declared in each package's "files" array
 * actually lands in the published tarball.
 *
 * packages/pro currently declares `types` pointing at a directory that does not
 * exist and lists a README.md that was never written; both would ship broken.
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const WORKSPACES = ['packages/core', 'packages/pro'];
let failed = false;

for (const ws of WORKSPACES) {
    const pkg = JSON.parse(readFileSync(`${ws}/package.json`, 'utf8'));
    // A single command string rather than an args array: Node 24 refuses to spawn
    // npm.cmd without a shell, and passing an args array alongside shell:true is
    // deprecated. `ws` comes from the fixed list above, so there is nothing to escape.
    const raw = execSync(`npm pack --dry-run --json -w ${ws}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const entries = JSON.parse(raw)[0].files.map((f) => f.path);
    const has = (p) => entries.some((e) => e === p || e.startsWith(`${p}/`));

    const missing = [];
    for (const declared of pkg.files ?? []) if (!has(declared)) missing.push(`files[]: ${declared}`);

    // Entry points must resolve to something inside the tarball.
    for (const field of ['main', 'module', 'types', 'browser', 'unpkg', 'jsdelivr']) {
        const value = pkg[field];
        if (value && !has(value.replace(/^\.\//, ''))) missing.push(`${field}: ${value}`);
    }

    // Subpath exports ship real files too, and nothing else checked them — so
    // ./styles and ./headless could have pointed anywhere.
    for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
        const targets = typeof target === 'string' ? [target] : Object.values(target);
        for (const t of targets) {
            if (typeof t !== 'string' || t === './package.json') continue;
            if (!has(t.replace(/^\.\//, ''))) missing.push(`exports['${subpath}']: ${t}`);
        }
    }

    if (missing.length) {
        failed = true;
        console.error(`${pkg.name}: ${missing.length} declared path(s) missing from the tarball`);
        for (const m of missing) console.error(`  ${m}`);
    } else {
        console.log(`${pkg.name}: ${entries.length} files, all declared paths present`);
    }
}

if (failed) process.exit(1);
