import { ref, computed, watchEffect, onUnmounted, readonly } from 'vue'

/**
 * hook 本身只关注内部实现细节
 * 并导出副作用变量供外部使用或扩展
 */
export default function useScroll(title) {
  const PLACE = ' '.repeat(20)
  let pos = 1
  let timeKey

  /** 是否滚动中 */
  const runing = ref(true)

  /** 现行文本 */
  const present = ref()

  // 完整字符串
  const str = computed(() => (PLACE + title).repeat(2))

  const change = () => {
    // 截取部分字符串
    present.value = str.value.slice(pos, pos + PLACE.length)
    pos = (pos + 1) % (str.value.length / 2)
  }

  /** 副作用监听:runing */
  watchEffect(() => {
    clearInterval(timeKey)
    if (!runing.value) return
    timeKey = setInterval(change, 80)
  })

  /** 卸载时清除定时器 */
  onUnmounted(() => {
    runing.value = false
  })

  return {
    present: readonly(present), // 只读
    runing,
  }
}
