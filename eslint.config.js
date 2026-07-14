// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const eslintConfigPrettier = require('eslint-config-prettier');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
      eslintPluginPrettierRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'rxjs',
              importNames: ['interval', 'timer', 'animationFrames'],
              message:
                'sim/ must stay deterministic and framework-agnostic: no live timers inside the simulation core. Real time enters once, at the app/ boundary.',
            },
            { name: 'pixi.js', message: 'sim/ must not depend on the rendering layer.' },
          ],
          patterns: [
            { group: ['**/render/*'], message: 'sim/ must not depend on the rendering layer.' },
            { group: ['**/app/*'], message: 'sim/ must not depend on the Angular app layer.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/render/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@angular/*'], message: 'render/ must not depend on Angular.' },
            { group: ['**/app/*'], message: 'render/ must not depend on the Angular app layer.' },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
      eslintConfigPrettier,
    ],
    rules: {},
  },
]);
