import { useState } from 'react'
import {
  Container,
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Link,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  RadioGroup,
  Radio,
  FormControl,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import { Google as GoogleIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { apiCall } from '../utils/apiCall'

interface Account {
  id: string
  full_name: string
  email: string
  families: { id: string; name: string } | null
}

export default function Login() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'account-select' | 'password'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [error, setError] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  
  // Password reset dialog
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  const handleGoogleSignIn = async () => {
    setOauthLoading(true)
    setError('')
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      
      if (error) throw error
    } catch (err: any) {
      setError(err.message || 'שגיאה בהתחברות עם Google')
      setOauthLoading(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      setError('נא להזין כתובת אימייל')
      return
    }
    
    setResetLoading(true)
    setError('')
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      
      if (error) throw error
      
      setResetSuccess(true)
    } catch (err: any) {
      setError(err.message || 'שגיאה בשליחת מייל לאיפוס סיסמה')
    } finally {
      setResetLoading(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await apiCall('/auth/accounts-by-email', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })

      if (response.accounts && response.accounts.length > 1) {
        // Multiple accounts with this email - show account selection
        setAccounts(response.accounts)
        setStep('account-select')
      } else if (response.accounts && response.accounts.length === 1) {
        // Single account - go straight to password
        setAccounts(response.accounts) // Store the account info
        setSelectedUserId(response.accounts[0].id)
        setStep('password')
      } else {
        // No accounts found
        setError('לא נמצא חשבון עם כתובת אימייל זו')
      }
    } catch (err: any) {
      setError(err.message || 'שגיאה בבדיקת האימייל')
    } finally {
      setLoading(false)
    }
  }

  const handleAccountSelect = () => {
    if (!selectedUserId) {
      setError('נא לבחור חשבון')
      return
    }
    setStep('password')
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          userId: selectedUserId,
          rememberMe,
        }),
      })

      if (response.session) {
        await supabase.auth.setSession(response.session)
        navigate('/')
      }
    } catch (err: any) {
      setError(err.message || 'שגיאה בהתחברות')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (step === 'password') {
      setStep(accounts.length > 1 ? 'account-select' : 'email')
      setPassword('')
    } else if (step === 'account-select') {
      setStep('email')
      setAccounts([])
      setSelectedUserId('')
    }
    setError('')
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            התחברות
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {step === 'email' && (
            <>
              {/* OAuth Buttons */}
              <Box sx={{ mt: 3, mb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  size="large"
                  startIcon={<GoogleIcon />}
                  onClick={handleGoogleSignIn}
                  disabled={oauthLoading || loading}
                  sx={{ 
                    borderColor: '#4285f4',
                    color: '#4285f4',
                    '&:hover': {
                      borderColor: '#357ae8',
                      bgcolor: 'rgba(66, 133, 244, 0.04)'
                    }
                  }}
                >
                  {oauthLoading ? <CircularProgress size={24} /> : 'התחבר עם Google'}
                </Button>

                <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
                  <Divider sx={{ flexGrow: 1 }} />
                  <Typography variant="body2" sx={{ px: 2, color: 'text.secondary' }}>
                    או
                  </Typography>
                  <Divider sx={{ flexGrow: 1 }} />
                </Box>
              </Box>

              <Box component="form" onSubmit={handleEmailSubmit} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="אימייל"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                margin="normal"
                autoComplete="email"
                inputProps={{ 'data-testid': 'email-input' }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading || oauthLoading}
                sx={{ mt: 3, mb: 2 }}
                data-testid="submit-button"
              >
                {loading ? <CircularProgress size={24} /> : 'המשך'}
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Link href="/register" variant="body2" data-testid="register-link">
                  אין לך חשבון? <span>הרשמה</span>
                </Link>
              </Box>
            </Box>
            </>
          )}

          {step === 'account-select' && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                נמצאו מספר חשבונות לאימייל זה. בחר את החשבון שלך:
              </Typography>

              <FormControl component="fieldset" fullWidth>
                <RadioGroup
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  {accounts.map((account) => (
                    <FormControlLabel
                      key={account.id}
                      value={account.id}
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body1">{account.full_name}</Typography>
                          {account.families && (
                            <Typography variant="caption" color="text.secondary">
                              {account.families.name}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  ))}
                </RadioGroup>
              </FormControl>

              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Button onClick={handleBack} disabled={loading}>
                  חזור
                </Button>
                <Button
                  variant="contained"
                  onClick={handleAccountSelect}
                  disabled={loading}
                  fullWidth
                >
                  {loading ? <CircularProgress size={24} /> : 'המשך'}
                </Button>
              </Box>
            </Box>
          )}

          {step === 'password' && (
            <Box component="form" onSubmit={handlePasswordSubmit} sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {accounts.find(a => a.id === selectedUserId)?.full_name || email}
              </Typography>

              <TextField
                fullWidth
                label="סיסמה"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                margin="normal"
                autoComplete="current-password"
                autoFocus
                inputProps={{ 'data-testid': 'password-input' }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                }
                label="זכור אותי"
              />

              <Box sx={{ textAlign: 'center', mt: 1 }}>
                <Link
                  component="button"
                  variant="body2"
                  onClick={(e) => {
                    e.preventDefault()
                    setResetEmail(email)
                    setResetDialogOpen(true)
                  }}
                  sx={{ cursor: 'pointer' }}
                >
                  שכחת סיסמה?
                </Link>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Button onClick={handleBack} disabled={loading}>
                  חזור
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  fullWidth
                  data-testid="submit-button"
                >
                  {loading ? <CircularProgress size={24} /> : 'התחבר'}
                </Button>
              </Box>

              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Link href="/register" variant="body2">
                  אין לך חשבון? הירשם כאן
                </Link>
              </Box>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Password Reset Dialog */}
      <Dialog open={resetDialogOpen} onClose={() => {
        setResetDialogOpen(false)
        setResetSuccess(false)
        setError('')
      }} maxWidth="sm" fullWidth>
        <DialogTitle>איפוס סיסמה</DialogTitle>
        <DialogContent>
          {resetSuccess ? (
            <Alert severity="success">
              נשלח מייל לאיפוס סיסמה לכתובת {resetEmail}. אנא בדוק את תיבת הדואר שלך.
            </Alert>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה.
              </Typography>
              <TextField
                fullWidth
                label="אימייל"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                margin="normal"
                autoFocus
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setResetDialogOpen(false)
              setResetSuccess(false)
              setError('')
            }}
          >
            {resetSuccess ? 'סגור' : 'ביטול'}
          </Button>
          {!resetSuccess && (
            <Button
              onClick={handlePasswordReset}
              variant="contained"
              disabled={resetLoading}
            >
              {resetLoading ? <CircularProgress size={24} /> : 'שלח קישור'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  )
}
