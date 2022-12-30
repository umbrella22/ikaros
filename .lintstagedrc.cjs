module.exports = {
  '*.{json,yml,html,md}': 'prettier --write --ignore-unknown',
  '*.{css,scss,less}': 'prettier --write --ignore-unknown',
  '*.{js,jsx,ts,tsx,vue}': 'eslint --fix',
}
