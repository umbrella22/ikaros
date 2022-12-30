import recommended from './recommended'
import tsRecommended from './ts-recommended'
import vueRecommended, { VueVersion } from './vue-recommended'
import vueTsRecommended from './vue-ts-recommended'

export const configs = {
  recommended,
  'ts-recommended': tsRecommended,

  'vue-recommended': vueRecommended(VueVersion.v2),
  'vue3-recommended': vueRecommended(VueVersion.v3),

  'vue-ts-recommended': vueTsRecommended(VueVersion.v2),
  'vue3-ts-recommended': vueTsRecommended(VueVersion.v3),
}
