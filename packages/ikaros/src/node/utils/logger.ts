const eventArray: string[] = []
export const LoggerQueue = () => {
  const emitEvent = (event: string) => {
    const timestamp = new Date()
      .toLocaleTimeString('en-US', { hour12: false }) // 生成hh:mm:ss格式
      .split(' ')[0] // 移除时区信息
    eventArray.push(`[${timestamp}] ${event}`)
  }
  const clearEventArray = () => {
    eventArray.length = 0
  }
  return {
    emitEvent,
    clearEventArray,
    eventArray,
  }
}
