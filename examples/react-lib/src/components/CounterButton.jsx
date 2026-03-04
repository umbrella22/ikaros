import React, { useState } from 'react'

const styles = {
  button: {
    padding: '8px 16px',
    fontSize: '14px',
    color: '#fff',
    backgroundColor: '#61dafb',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
}

export function CounterButton({ label = 'Count:' }) {
  const [count, setCount] = useState(0)

  return (
    <button style={styles.button} onClick={() => setCount((c) => c + 1)}>
      {label} {count}
    </button>
  )
}
