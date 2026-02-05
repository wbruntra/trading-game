async function triggerSnapshot() {
  const port = process.env.PORT || 3001
  const secret = process.env.ADMIN_SECRET
  const url = `http://localhost:${port}/api/trading/admin/snapshot`

  console.log(`[Snapshot Script] Triggering snapshot at ${url}...`)

  if (!secret) {
    console.error('[Snapshot Script] Error: ADMIN_SECRET not found in env')
    process.exit(1)
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': secret,
      },
    })

    const data = await response.json()

    if (response.ok) {
      console.log('[Snapshot Script] Success:', data)
    } else {
      console.error('[Snapshot Script] Failed:', response.status, data)
    }
  } catch (error) {
    console.error('[Snapshot Script] Request failed:', error)
  }
}

triggerSnapshot()
