import { useRef } from 'react'
import avatar from '@/assets/avatar.png'
import useScroll from '@/hooks/use-scroll'

function IndexPage() {
  const { present, runing, setRuning } = useScroll(
    'Hi, welcome to React 19 Template',
  )
  const containerRef = useRef(null)

  // 内联样式对象
  const styles = {
    app: {
      position: 'absolute',
      top: '43%',
      left: '50%',
      width: '300px',
      textAlign: 'center',
      transform: 'translate(-50%, -50%)',
    },
    img: {
      width: '170px',
      height: '170px',
      borderRadius: '50%',
      overflow: 'hidden',
    },
    button: {
      padding: '5px 10px',
      fontSize: '14px',
    },
    title: {
      height: '1.3em',
      margin: '30px 0',
      fontSize: '23px',
      fontWeight: 'bold',
      whiteSpace: 'pre',
    },
  }

  return (
    <div style={styles.app} ref={containerRef}>
      <img src={avatar} alt="Avatar" style={styles.img} />
      <div style={styles.title}>{present}</div>
      <button style={styles.button} onClick={() => setRuning(!runing)}>
        {runing ? '⏹ Stop' : '▶ Start'}
      </button>
    </div>
  )
}

export default IndexPage
