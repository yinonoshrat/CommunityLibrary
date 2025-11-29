import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function SearchBooks() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    params.set('view', params.get('view') || 'all')
    navigate({ pathname: '/books', search: params.toString() }, { replace: true })
  }, [location.search, navigate])

  return null
}
