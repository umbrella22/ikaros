import { useEffect, useMemo, useRef, useState } from 'react'

const useScroll = (title) => {
  const PLACE = ' '.repeat(20)
  const positionRef = useRef(1)
  const timerRef = useRef(null)
  const [runing, setRuning] = useState(true)
  const [present, setPresent] = useState('')

  const source = useMemo(() => (PLACE + title).repeat(2), [title, PLACE])

  useEffect(() => {
    const updatePresent = () => {
      const nextPosition = (positionRef.current + 1) % (source.length / 2)
      positionRef.current = nextPosition
      setPresent(source.slice(nextPosition, nextPosition + PLACE.length))
    }

    if (!runing) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    updatePresent()
    timerRef.current = setInterval(updatePresent, 80)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [runing, source])

  return {
    present,
    runing,
    setRuning,
  }
}

export default useScroll
