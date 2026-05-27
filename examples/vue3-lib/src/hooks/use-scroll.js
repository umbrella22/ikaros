import { computed, onUnmounted, readonly, ref, watchEffect } from 'vue'

export default function useScroll(title) {
  const PLACE = ' '.repeat(20)
  let pos = 1
  let timer

  const runing = ref(true)
  const present = ref('')
  const source = computed(() => (PLACE + title).repeat(2))

  const updatePresent = () => {
    present.value = source.value.slice(pos, pos + PLACE.length)
    pos = (pos + 1) % (source.value.length / 2)
  }

  watchEffect(() => {
    clearInterval(timer)

    if (!runing.value) {
      return
    }

    updatePresent()
    timer = setInterval(updatePresent, 80)
  })

  onUnmounted(() => {
    runing.value = false
    clearInterval(timer)
  })

  return {
    present: readonly(present),
    runing,
  }
}
