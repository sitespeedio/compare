import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/', 'public/js/dependencies/', 'src/vendor/']
  },
  js.configs.recommended,
  {
    rules: {
      'no-console': 'error',
      'no-unused-vars': ['error', { caughtErrors: 'none' }]
    }
  },
  {
    // Classic scripts share globals through window. Their /* global */
    // and /* exported */ comments declare what they use and provide.
    files: ['public/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser }
    }
  },
  {
    files: ['public/service-worker.js'],
    languageOptions: {
      globals: { ...globals.serviceworker }
    }
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser }
    }
  },
  {
    files: ['*.js', 'test/**/*.js'],
    languageOptions: {
      globals: { ...globals.node }
    }
  }
];
