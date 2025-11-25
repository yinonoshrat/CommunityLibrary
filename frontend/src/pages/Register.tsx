import { useState, useEffect } from 'react'
import {
  Container,
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormControl,
  FormLabel,
  Autocomplete,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { apiCall } from '../lib/supabase'

interface Family {
  id: string
  name: string
  members: { id: string; full_name: string }[]
}

const steps = ['פרטים אישיים', 'פרטי משפחה']

export default function Register() {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [families, setFamilies] = useState<Family[]>([])
  const [loadingFamilies, setLoadingFamilies] = useState(true)

  // User details
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  // Family details
  const [familyChoice, setFamilyChoice] = useState<'new' | 'existing'>('new')
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null)
  const [familyName, setFamilyName] = useState('')
  const [familyPhone, setFamilyPhone] = useState('')
  const [familyWhatsapp, setFamilyWhatsapp] = useState('')

  // Load families on mount
  useEffect(() => {
    loadFamilies()
  }, [])

  const loadFamilies = async () => {
    try {
      const response = await apiCall('/families')
      setFamilies(response.families || [])
    } catch (err) {
      console.error('Failed to load families:', err)
    } finally {
      setLoadingFamilies(false)
    }
  }

  // Helper to format family display name
  const getFamilyDisplayName = (family: Family) => {
    const duplicates = families.filter(f => f.name === family.name)
    if (duplicates.length > 1) {
      const memberNames = family.members.map(m => m.full_name).join(', ')
      return `${family.name} (${memberNames || 'ללא חברים'})`
    }
    return family.name
  }

  const handleNext = () => {
    if (activeStep === 0) {
      if (!email || !password || !fullName) {
        setError('נא למלא את כל השדות החובה')
        return
      }
      if (password !== confirmPassword) {
        setError('הסיסמאות אינן תואמות')
        return
      }
      if (password.length < 6) {
        setError('הסיסמה חייבת להכיל לפחות 6 תווים')
        return
      }
      setError('')
      setActiveStep(1)
    } else {
      // Validate family choice
      if (familyChoice === 'existing' && !selectedFamily) {
        setError('נא לבחור משפחה קיימת')
        return
      }
      if (familyChoice === 'new' && !familyName) {
        setError('נא למלא שם משפחה')
        return
      }
      handleSubmit()
    }
  }

  const handleBack = () => {
    setActiveStep(0)
    setError('')
  }

  const handleSubmit = async () => {
    setError('')
    setLoading(true)

    try {
      const payload: any = {
        email,
        password,
        fullName,
        phone,
        whatsapp: whatsapp || phone,
      }

      if (familyChoice === 'existing' && selectedFamily) {
        payload.existingFamilyId = selectedFamily.id
      } else if (familyChoice === 'new' && familyName) {
        payload.familyName = familyName
        payload.familyPhone = familyPhone || phone
        payload.familyWhatsapp = familyWhatsapp || whatsapp || phone
      }

      await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      navigate('/login')
    } catch (err: any) {
      setError(err.message || 'שגיאה בהרשמה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            הרשמה
          </Typography>

          <Stepper activeStep={activeStep} sx={{ my: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {activeStep === 0 && (
            <Box>
              <TextField
                fullWidth
                label="שם מלא"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                margin="normal"
              />

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

              <TextField
                fullWidth
                label="סיסמה"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                margin="normal"
                helperText="לפחות 6 תווים"
              />

              <TextField
                fullWidth
                label="אימות סיסמה"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                margin="normal"
              />

              <TextField
                fullWidth
                label="טלפון"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
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
            </Box>
          )}

          {activeStep === 1 && (
            <Box>
              <Typography variant="body1" sx={{ mb: 3 }}>
                בחר משפחה קיימת או צור משפחה חדשה
              </Typography>

              <FormControl component="fieldset" sx={{ mb: 3 }}>
                <FormLabel component="legend">אפשרות משפחה</FormLabel>
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
                      label="בחר משפחה"
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
                    label="שם משפחה"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    required
                    margin="normal"
                    helperText="לדוגמה: משפחת כהן"
                  />

                  <TextField
                    fullWidth
                    label="טלפון ליצירת קשר"
                    type="tel"
                    value={familyPhone}
                    onChange={(e) => setFamilyPhone(e.target.value)}
                    margin="normal"
                  />

                  <TextField
                    fullWidth
                    label="ווטסאפ למשפחה"
                    type="tel"
                    value={familyWhatsapp}
                    onChange={(e) => setFamilyWhatsapp(e.target.value)}
                    margin="normal"
                  />
                </>
              )}
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            {activeStep > 0 && (
              <Button onClick={handleBack} disabled={loading}>
                חזור
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={loading}
              sx={{ mr: 'auto' }}
            >
              {loading ? (
                <CircularProgress size={24} />
              ) : activeStep === steps.length - 1 ? (
                'הירשם'
              ) : (
                'המשך'
              )}
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Link href="/login" variant="body2">
              כבר יש לך חשבון? התחבר כאן
            </Link>
          </Box>
        </Paper>
      </Box>
    </Container>
  )
}
