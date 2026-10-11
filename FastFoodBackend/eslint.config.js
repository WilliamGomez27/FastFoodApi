import js from '@eslint/js';
import pluginSecurity from 'eslint-plugin-security';

export default [
  js.configs.recommended,
  pluginSecurity.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'security/detect-object-injection': 'off' // Muchas lecturas dinámicas legítimas en schemas/queries
    }
  },
  {
    files: ['src/scripts/**/*.js'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off'
    }
  },
  {
    ignores: ['node_modules/', 'coverage/']
  }
];
