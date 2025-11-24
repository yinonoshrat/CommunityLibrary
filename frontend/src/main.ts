import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Community Library</h1>
    <p>Welcome to the Community Library management system</p>
    <div class="card">
      <button id="testApi" type="button">Test API Connection</button>
      <div id="apiResponse"></div>
    </div>
  </div>
`

// Test API connection
document.querySelector<HTMLButtonElement>('#testApi')!.addEventListener('click', async () => {
  const responseDiv = document.querySelector<HTMLDivElement>('#apiResponse')!
  try {
    const response = await fetch('/api/health')
    const data = await response.json()
    responseDiv.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`
    responseDiv.style.color = 'green'
  } catch (error) {
    responseDiv.innerHTML = `<p>Error: ${error}</p>`
    responseDiv.style.color = 'red'
  }
})
