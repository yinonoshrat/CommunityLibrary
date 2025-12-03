import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Box, CircularProgress, Alert, Typography } from '@mui/material'
import { supabase } from '../lib/supabase'
import { apiCall } from '../utils/apiCall'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase automatically processes the hash fragment and creates a session
        // We just need to wait a bit and then check for the session
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Get the current session
        const { data: { session }, error: authError } = await supabase.auth.getSession()
        
        if (authError) throw authError
        
        if (!session) {
          throw new Error('לא נמצא session. נסה להתחבר שוב.')
        }

        // Check if user exists in our database
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          try {
            // Try to get user profile from our database
            const response = await apiCall('/auth/me')
            
            if (response.user) {
              // User exists, navigate to home
              console.log('User found in database, navigating to home')
              navigate('/')
            } else {
              // User doesn't exist in database, need to complete registration
              console.log('User not found in database, redirecting to complete profile')
              navigate('/complete-profile')
            }
          } catch (err: any) {
            // 401 or 404 means user doesn't exist in our database yet
            if (err.message.includes('401') || err.message.includes('404') || err.message.includes('User not found')) {
              console.log('User not found in database, redirecting to complete profile')
              navigate('/complete-profile')
            } else {
              // Other error, show it
              throw err
            }
          }
        }
      } catch (err: any) {
        console.error('OAuth callback error:', err)
        setError(err.message || 'שגיאה בהתחברות')
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {error ? (
          <>
            <Alert severity="error">{error}</Alert>
            <Typography>
              <a href="/login">חזרה להתחברות</a>
            </Typography>
          </>
        ) : (
          <>
            <CircularProgress />
            <Typography>מתחבר...</Typography>
          </>
        )}
      </Box>
    </Container>
  )
}
