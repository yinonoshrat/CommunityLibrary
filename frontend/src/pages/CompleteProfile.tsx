import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormControl,
  FormLabel,
  Autocomplete,
} from '@mui/material'
import { supabase } from '../lib/supabase'
import { apiCall } from '../utils/apiCall'
import { useFamilies, type Family } from '../hooks/useFamilies'

export default function CompleteProfile() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Use React Query hook for families
  const { data: families = [], isLoading: loadingFamilies } = useFamilies()

  // User details (pre-filled from OAuth)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  // Family details
  const [familyChoice, setFamilyChoice] = useState<'new' | 'existing'>('new')
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null)
  const [familyName, setFamilyName] = useState('')

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        navigate('/login')
        return
      }

      setUserId(user.id)
      setEmail(user.email || '')
      setFullName(user.user_metadata?.full_name || user.user_metadata?.name || '')
    } catch (err) {
      console.error('Failed to load user data:', err)
      navigate('/login')
    }
  }

  const getFamilyDisplayName = (family: Family) => {
    const duplicates = families.filter(f => f.name === family.name)
    if (duplicates.length > 1 && family.members) {
      const memberNames = family.members.map(m => m.full_name).join(', ')
      return `${family.name} (${memberNames || 'ללא חברים'})`
    }
    return family.name
  }

  const validateForm = () => {
    if (!phone) {
      setError('נא למלא מספר טלפון')
      return false
    }

    if (familyChoice === 'existing' && !selectedFamily) {
      setError('נא לבחור משפחה קיימת')
      return false
    }

    if (familyChoice === 'new' && !familyName) {
      setError('נא למלא שם משפחה')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const payload: any = {
        id: userId,
        email,
        fullName,
        phone,
        whatsapp: whatsapp || phone,
        provider: 'google',
      }

      if (familyChoice === 'existing' && selectedFamily) {
        payload.existingFamilyId = selectedFamily.id
      } else if (familyChoice === 'new' && familyName) {
        payload.familyName = familyName
        payload.familyPhone = phone
        payload.familyWhatsapp = whatsapp || phone
      }

      await apiCall('/api/auth/oauth-complete', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      // Profile completed, navigate to home
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'שגיאה בהשלמת הפרופיל')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            השלמת פרטים
          </Typography>

          <Typography variant="body1" sx={{ mb: 3, textAlign: 'center', color: 'text.secondary' }}>
            התחברת בהצלחה עם Google. אנא השלם את הפרטים הבאים כדי להמשיך.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            {/* Display pre-filled info */}
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>שם מלא:</strong> {fullName}
              </Typography>
              <Typography variant="body2">
                <strong>אימייל:</strong> {email}
              </Typography>
            </Alert>

            {/* Contact Details */}
            <Typography variant="h6" sx={{ mb: 2 }}>
              פרטי יצירת קשר
            </Typography>

            <TextField
              fullWidth
              label="טלפון *"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              margin="normal"
              helperText="לתקשורת עם משפחות אחרות"
            />

            <TextField
              fullWidth
              label="ווטסאפ"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              margin="normal"
              helperText="אם שונה ממספר הטלפון"
            />

            {/* Family Details */}
            <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
              פרטי משפחה
            </Typography>

            <FormControl component="fieldset" sx={{ mb: 3 }}>
              <FormLabel component="legend">בחר אפשרות משפחה</FormLabel>
              <RadioGroup
                value={familyChoice}
                onChange={(e) => setFamilyChoice(e.target.value as 'new' | 'existing')}
              >
                <FormControlLabel value="new" control={<Radio />} label="צור משפחה חדשה" />
                <FormControlLabel value="existing" control={<Radio />} label="הצטרף למשפחה קיימת" />
              </RadioGroup>
            </FormControl>

            {familyChoice === 'existing' && (
              <Autocomplete
                options={families}
                getOptionLabel={(option) => getFamilyDisplayName(option)}
                value={selectedFamily}
                onChange={(_, newValue) => setSelectedFamily(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="בחר משפחה *"
                    required
                    helperText="חפש לפי שם משפחה"
                  />
                )}
                loading={loadingFamilies}
                loadingText="טוען משפחות..."
                noOptionsText="לא נמצאו משפחות"
                sx={{ mb: 2 }}
              />
            )}

            {familyChoice === 'new' && (
              <>
                <TextField
                  fullWidth
                  label="שם משפחה *"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  required
                  margin="normal"
                  helperText="לדוגמה: משפחת כהן. יצירת המשפחה תשתמש בטלפון והווטסאפ שלך"
                />

                <Alert severity="info" sx={{ mt: 2 }}>
                  המשפחה תיווצר עם מספר הטלפון והווטסאפ שלך לצורך יצירת קשר
                </Alert>
              </>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 3 }}
            >
              {loading ? (
                <CircularProgress size={24} />
              ) : (
                'סיים והמשך'
              )}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  )
}
