import { useState, useRef, useMemo, useEffect } from 'react'

/**
 * React 19 自定义滚动 Hook
 */
const useScroll = (title) => {
  const PLACE = ' '.repeat(20)

  // 使用 useRef 保持持久化引用
  const pos = useRef(1)
  const timeKey = useRef(null)

  // 状态管理
  const [runing, setRuning] = useState(true)
  const [present, setPresent] = useState('')

  // 计算属性等效实现
  const str = useMemo(() => (PLACE + title).repeat(2), [title, PLACE])

  // 滚动逻辑
  const change = () => {
    const newPos = (pos.current + 1) % (str.length / 2)
    pos.current = newPos
    setPresent(str.slice(newPos, newPos + PLACE.length))
  }

  // 副作用管理
  useEffect(() => {
    if (!runing) {
      if (timeKey.current) clearInterval(timeKey.current)
      return
    }

    timeKey.current = setInterval(change, 80)

    // 清理函数
    return () => {
      if (timeKey.current) {
        clearInterval(timeKey.current)
        timeKey.current = null
      }
    }
  }, [runing]) // 依赖项数组确保仅在 runing 变化时触发

  return {
    present, // React 默认不可变，无需额外处理只读
    runing,
    setRuning, // 暴露控制方法
  }
}

export default useScroll
