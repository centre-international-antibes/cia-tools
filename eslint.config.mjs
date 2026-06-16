// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs';
import eslintConfigPrettier from 'eslint-config-prettier';

export default withNuxt(
  {
    ignores: ['**/.nuxt', '**/node_modules', '**/dist', ],
  },
  eslintConfigPrettier,
  {
    rules: {
      'no-console': 'off',
      'vue/no-multiple-template-root': 'off',
      'vue/no-v-html': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'max-len': ['error', { code: 120, ignoreStrings: true, ignoreUrls: true }],
    },
  },
);
