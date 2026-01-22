import('./src/app.js').catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start app:', err)
  process.exit(1)
})
