'use client'
import { useState } from 'react'

export default function ManualUpdatePage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  async function triggerUpdate() {
    setLoading(true)
    setResult('')

    const response = await fetch('/api/update-stats', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`
      }
    })

    const data = await response.json()
    setResult(JSON.stringify(data, null, 2))
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-dark-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">Manual Stats Update</h1>
        <button
          onClick={triggerUpdate}
          disabled={loading}
          className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Trigger Update'}
        </button>
        
        {result && (
          <pre className="mt-4 p-4 bg-dark-800 text-white rounded-lg overflow-auto">
            {result}
          </pre>
        )}
      </div>
    </div>
  )
}