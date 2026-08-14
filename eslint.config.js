import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
    },

    {
        files: ['packages/*/src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.browser },
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'error',
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            eqeqeq: ['error', 'smart'],
            'no-var': 'error',
            'prefer-const': 'error',
            'no-implicit-globals': 'error',

            // Local-time Date construction is DST-unsafe: in zones that transition at
            // midnight, local midnight does not exist and Date silently yields 01:00.
            // utils/temporal.js does all arithmetic on a UTC epoch instead.
            'no-restricted-syntax': ['error', {
                selector: "NewExpression[callee.name='Date'][arguments.length>1]",
                message: 'Local-time Date construction is DST-unsafe. Use Date.UTC or setUTCFullYear.',
            }],

            // Zero runtime dependencies is a design constraint, not a preference.
            // The polyfill is kept as a devDependency purely as a test oracle.
            'no-restricted-imports': ['error', {
                paths: [{
                    name: '@js-temporal/polyfill',
                    message: 'The core has no runtime dependencies. Test files only.',
                }],
            }],
        },
    },

    {
        // parseLocalDateAsJSDate is the one documented local-time construction, retained
        // for callers that need a Date object. The hazard is noted at the call site.
        files: ['packages/core/src/utils/temporal.js'],
        rules: { 'no-restricted-syntax': 'off' },
    },

    {
        files: ['packages/*/src/**/*.test.js', 'packages/*/tests/**/*.js'],
        languageOptions: {
            globals: { ...globals.node, ...globals.browser },
        },
        rules: {
            'no-restricted-imports': 'off',
            'no-restricted-syntax': 'off',
            'no-console': 'off',
        },
    },

    {
        files: ['packages/*/build.js', 'packages/*/scripts/**/*.js', 'scripts/**/*.js', '**/vitest.config.js', 'eslint.config.js'],
        languageOptions: {
            globals: { ...globals.node },
        },
        rules: { 'no-console': 'off' },
    },
];
