export const env = {
  node: true,
  browser: true,
  es2022: true,
}

export const parserOptions = {
  ecmaVersion: 'latest',
  sourceType: 'module',
}

export const settings = {
  'import-x/ignore': ['node_modules'],
}

export const ignorePatterns = ['!.*', '**/dist', '**/node_modules']

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

export const esRules = {
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

export const tsRules = {
  'import/named': 'off',
  'import/namespace': 'off',
  'import/default': 'off',
  'import/no-named-as-default-member': 'off',

  '@typescript-eslint/explicit-function-return-type': 'off',
}

export const dtsRules = {
  'no-var': 'off',
  '@typescript-eslint/no-empty-interface': 'off',
}
