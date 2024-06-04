import recommended from './recommended'
import tsRecommended from './ts-recommended'
import { getVueEsLint, VueVersion } from './vue-recommended'
import { getVueTsEslint } from './vue-ts-recommended'

export const configs = {
  recommended,
  'ts-recommended': tsRecommended,

  'vue-recommended': getVueEsLint(VueVersion.v2),
  'vue3-recommended': getVueEsLint(VueVersion.v3),

  'vue-ts-recommended': getVueTsEslint(VueVersion.v2),
  'vue3-ts-recommended': getVueTsEslint(VueVersion.v3),
}
