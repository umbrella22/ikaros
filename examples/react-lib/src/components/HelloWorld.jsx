import React from 'react'

const styles = {
  container: {
    padding: '16px 24px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    textAlign: 'center',
    fontFamily: 'sans-serif',
  },
  title: {
    margin: '0 0 8px',
    color: '#61dafb',
  },
  message: {
    margin: 0,
    color: '#666',
    fontSize: '14px',
  },
}

export function HelloWorld({
  name = 'World',
  message = 'This component is from ikaros react library example.',
}) {
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Hello, {name}!</h2>
      <p style={styles.message}>{message}</p>
    </div>
  )
}
