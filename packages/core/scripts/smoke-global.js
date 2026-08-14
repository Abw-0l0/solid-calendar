/**
 * smoke-global — prove the <script>-tag artifact actually loads in a browser.
 *
 * The artifact advertised to CDN users (package.json "unpkg") is loaded in a bare
 * vm context with NO `require`, NO `module`, NO `exports` — the only faithful
 * simulation of a <script> tag. jsdom is deliberately not used here: under Node it
 * can leave `require` reachable, which would make a broken artifact pass.
 *
 * The artifact must also *construct* something, not merely parse, so that a lazily
 * thrown dependency error is caught too.
 */
import { readFileSync } from 'fs';
import vm from 'vm';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const target = (pkg.unpkg ?? pkg.browser ?? '').replace(/^\.\//, '');
if (!target) {
    console.error('smoke-global: package.json declares no "unpkg" or "browser" entry');
    process.exit(1);
}

const REQUIRED = ['CalendarApp', 'EventBus', 'CalendarState', 'EventMapper', 'PluginManager', 'temporal'];

try {
    const code = readFileSync(target, 'utf8');
    const context = vm.createContext({ console });
    vm.runInContext(`${code}\n;globalThis.__api = typeof SteadyCalendar !== 'undefined' ? SteadyCalendar : undefined;`, context);

    const api = context.__api;
    if (!api) throw new Error('global "SteadyCalendar" was not defined after evaluation');

    const missing = REQUIRED.filter((k) => !(k in api));
    if (missing.length) throw new Error(`missing exports: ${missing.join(', ')}`);

    // Exercise the date path, which is where a missing dependency would surface.
    const state = new api.CalendarState({ emit() {}, on() {} });
    if (typeof state.currentDate !== 'string') throw new Error('CalendarState.currentDate is not a string');

    console.log(`smoke-global: ${target} loaded in a bare context; ${REQUIRED.length} exports present`);
} catch (err) {
    console.error(`smoke-global: FAILED loading ${target}`);
    console.error(`  ${err.constructor.name}: ${err.message}`);
    process.exit(1);
}
