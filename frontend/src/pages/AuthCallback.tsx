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
            const response = await apiCall('/api/auth/me')
            
            if (response.user && response.user.family_id) {
              // User exists with a family, navigate to home
              console.log('User found in database with family, navigating to home')
              navigate('/')
            } else if (response.user && !response.user.family_id) {
              // User exists but has no family - needs to complete profile
              console.log('User found but has no family, redirecting to complete profile')
              navigate('/complete-profile')
            } else {
              // User doesn't exist in database, need to complete registration
              console.log('User not found in database, redirecting to complete profile')
              navigate('/complete-profile')
            }
          } catch (err: any) {
            // Any error means user likely doesn't exist in our database yet
            // This includes 401 (translated to Hebrew message), 404, or "User not found"
            console.log('Error checking user profile, redirecting to complete profile:', err.message)
            navigate('/complete-profile')
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
