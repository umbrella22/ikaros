import type { FlatConfig } from '@typescript-eslint/utils/ts-eslint'

export enum VueVersion {
  v2 = 2,
  v3,
}

export const parserOptions: FlatConfig.ParserOptions = {
  ecmaVersion: 'latest',
  sourceType: 'module',
}

export const settings = {
  'import-x/ignore': ['node_modules'],
}

export const ignores = ['!.*', '**/dist', '**/node_modules']

export const tsFileExtensions = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts']
export const jsFileExtensions = ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs']

export const assetExtends = [
  '.svg',
  '.css',
  '.less',
  '.scss',
  '.vue',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.otf',
  '.ttf',
  '.eot',
  '.woff',
  '.woff2',
]

export const esRules: FlatConfig.Config['rules'] = {
  'no-console': 'warn',

  'import/no-extraneous-dependencies': 'off',

  'unicorn/prevent-abbreviations': 'off',
  'unicorn/no-null': 'off',
  'unicorn/prefer-spread': 'off',
  'unicorn/prefer-export-from': 'off',
  'unicorn/consistent-function-scoping': 'off',
  'unicorn/no-useless-undefined': 'off',
  'unicorn/prefer-dom-node-append': 'off',
  'unicorn/numeric-separators-style': 'off',
  'unicorn/import-style': 'off',
}

export const tsRules: FlatConfig.Config['rules'] = {
  'import/named': 'off',
  'import/namespace': 'off',
  'import/default': 'off',
  'import/no-named-as-default-member': 'off',
  '@typescript-eslint/no-explicit-any': 'warn',

  '@typescript-eslint/explicit-function-return-type': 'off',
}

export const dtsRules: FlatConfig.Config['rules'] = {
  'no-var': 'off',
  '@typescript-eslint/no-empty-interface': 'off',
}
