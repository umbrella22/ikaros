import { VueVersion } from './common'
import { recommended } from './recommended'
import { tsRecommended } from './ts-recommended'
import { getVueEsLint } from './vue-recommended'
import { getVueTsEslint } from './vue-ts-recommended'

const { name, version } = require('../package.json') as {
  name: string
  version: string
}
export default {
  meta: {
    name,
    version,
  },
  configs: {
    recommended,
    tsRecommended,
    'vue-recommended': getVueEsLint(VueVersion.v2),
    'vue3-recommended': getVueEsLint(VueVersion.v3),
    'vue-ts-recommended': getVueTsEslint(VueVersion.v2),
    'vue3-ts-recommended': getVueTsEslint(VueVersion.v3),
  },
}
