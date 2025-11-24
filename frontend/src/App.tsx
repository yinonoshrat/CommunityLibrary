import { useState } from 'react'

function App() {
  const [apiResponse, setApiResponse] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const testApi = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/health')
      const data = await response.json()
      setApiResponse(JSON.stringify(data, null, 2))
    } catch (error) {
      setApiResponse(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>Community Library</h1>
      <p>Welcome to the Community Library management system</p>
      <div className="card">
        <button onClick={testApi} disabled={loading}>
          {loading ? 'Testing...' : 'Test API Connection'}
        </button>
        {apiResponse && (
          <pre style={{ 
            color: apiResponse.includes('Error') ? 'red' : 'green',
            marginTop: '1rem',
            textAlign: 'left'
          }}>
            {apiResponse}
          </pre>
        )}
      </div>
    </div>
  )
}

export default App
