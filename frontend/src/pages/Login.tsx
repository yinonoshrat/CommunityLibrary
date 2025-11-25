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
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { supabase, apiCall } from '../lib/supabase'

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
  const [error, setError] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')

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
            <Box component="form" onSubmit={handleEmailSubmit} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="אימייל"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                margin="normal"
                autoComplete="email"
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ mt: 3, mb: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : 'המשך'}
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Link href="/register" variant="body2">
                  אין לך חשבון? הירשם כאן
                </Link>
              </Box>
            </Box>
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
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                margin="normal"
                autoComplete="current-password"
                autoFocus
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
    </Container>
  )
}
