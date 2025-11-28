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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { apiCall } from '../lib/supabase'

interface Family {
  id: string
  name: string
  phone?: string
  email?: string
  whatsapp?: string
  members: { id: string; full_name: string }[]
}

interface DuplicateFamilyDialogProps {
  open: boolean
  families: Family[]
  newFamilyName: string
  onConfirmNew: () => void
  onSelectExisting: (family: Family) => void
  onCancel: () => void
}

function DuplicateFamilyDialog({ 
  open, 
  families, 
  newFamilyName,
  onConfirmNew, 
  onSelectExisting, 
  onCancel 
}: DuplicateFamilyDialogProps) {
  return (
    <Dialog 
      open={open} 
      onClose={onCancel} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { direction: 'rtl' }
      }}
    >
      <DialogTitle sx={{ textAlign: 'right', pr: 3 }}>משפחה עם שם דומה כבר קיימת</DialogTitle>
      <DialogContent sx={{ pr: 3 }}>
        <Typography variant="body1" sx={{ mb: 2, textAlign: 'right' }}><bdi>
        נמצאו משפחות עם השם "{newFamilyName}". האם אתה רוצה להצטרף לאחת מהן:
        </bdi></Typography>

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', textAlign: 'right' }}><bdi>
    משפחות קיימות:
        </bdi></Typography>
        
        <Paper variant="outlined" sx={{ mb: 2, maxHeight: 300, overflow: 'auto', direction: 'rtl' }}>
          <List sx={{ direction: 'rtl' }}>
            {families.map((family, index) => (
              <div key={family.id}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    direction: 'rtl'
                  }}
                  onClick={() => onSelectExisting(family)}
                >
                  <ListItemText
                    sx={{ textAlign: 'right', mr: 0, ml: 2 }}
                    primary={<Box sx={{ textAlign: 'right' }}>{family.name}</Box>}
                    secondary={
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography component="span" variant="body2" color="text.primary">
                          חברים: {family.members.length > 0 
                            ? family.members.map(m => m.full_name).join(', ')
                            : 'אין חברים'}
                        </Typography>
                        {family.phone && (
                          <>
                            <br />
                            <Typography component="span" variant="body2">
                              טלפון: {family.phone}
                            </Typography>
                          </>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              </div>
            ))}
          </List>
        </Paper>

        <Alert severity="info" sx={{ mb: 2, '& .MuiAlert-message': { width: '100%', textAlign: 'right' } }}>
          לחץ על משפחה כדי להצטרף אליה, או המשך ליצור משפחה חדשה
        </Alert>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'flex-start', px: 3, pb: 2 }}>
        <Button onClick={onConfirmNew} variant="contained" color="primary">
          צור משפחה חדשה בכל זאת
        </Button>
        <Button onClick={onCancel} color="inherit">
          ביטול
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const steps = ['פרטים אישיים', 'פרטי משפחה']

export default function Register() {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [families, setFamilies] = useState<Family[]>([])
  const [loadingFamilies, setLoadingFamilies] = useState(true)
  
  // Duplicate family dialog state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicateFamilies, setDuplicateFamilies] = useState<Family[]>([])
  const [checkingFamilyName, setCheckingFamilyName] = useState(false)

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
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        setError('אימייל לא תקין')
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
      
      // Check for duplicate family names before submitting
      if (familyChoice === 'new') {
        checkForDuplicateFamilyName()
      } else {
        handleSubmit()
      }
    }
  }

  const checkForDuplicateFamilyName = async () => {
    setCheckingFamilyName(true)
    setError('')
    
    try {
      const response = await apiCall('/families/check-name', {
        method: 'POST',
        body: JSON.stringify({ name: familyName }),
      })

      if (response.exists && response.families.length > 0) {
        // Show duplicate dialog
        setDuplicateFamilies(response.families)
        setDuplicateDialogOpen(true)
      } else {
        // No duplicates, proceed with registration
        handleSubmit()
      }
    } catch (err: any) {
      console.error('Error checking family name:', err)
      // If check fails, still allow registration
      handleSubmit()
    } finally {
      setCheckingFamilyName(false)
    }
  }

  const handleConfirmNewFamily = () => {
    setDuplicateDialogOpen(false)
    setDuplicateFamilies([])
    handleSubmit()
  }

  const handleSelectExistingFamily = (family: Family) => {
    setDuplicateDialogOpen(false)
    setDuplicateFamilies([])
    setSelectedFamily(family)
    setFamilyChoice('existing')
    // Submit with the selected existing family - use direct submission
    handleSubmitWithFamily(family)
  }

  const handleCancelDuplicateDialog = () => {
    setDuplicateDialogOpen(false)
    setDuplicateFamilies([])
  }

  const handleBack = () => {
    setActiveStep(0)
    setError('')
  }

  const handleSubmitWithFamily = async (family: Family) => {
    setError('')
    setLoading(true)

    try {
      const payload: any = {
        email,
        password,
        fullName,
        phone,
        whatsapp: whatsapp || phone,
        existingFamilyId: family.id
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
          <Typography variant="h4" component="h1" gutterBottom align="center" data-testid="register-title">
            הרשמה לספרייה הקהילתית
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
                name="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                margin="normal"
                inputProps={{ 'data-testid': 'name-input' }}
              />

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

              <TextField
                fullWidth
                label="סיסמה"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                margin="normal"
                helperText="לפחות 6 תווים"
                inputProps={{ 'data-testid': 'password-input' }}
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
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                margin="normal"
                helperText="לתקשורת עם משפחות אחרות"
                inputProps={{ 'data-testid': 'phone-input' }}
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
                    name="familyName"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    required
                    margin="normal"
                    helperText="לדוגמה: משפחת כהן"
                    inputProps={{ 'data-testid': 'familyName-input' }}
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
              disabled={loading || checkingFamilyName}
              sx={{ mr: 'auto' }}
              data-testid="submit-button"
              type={activeStep === 0 ? 'button' : 'submit'}
            >
              {loading || checkingFamilyName ? (
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

      {/* Duplicate Family Name Dialog */}
      <DuplicateFamilyDialog
        open={duplicateDialogOpen}
        families={duplicateFamilies}
        newFamilyName={familyName}
        onConfirmNew={handleConfirmNewFamily}
        onSelectExisting={handleSelectExistingFamily}
        onCancel={handleCancelDuplicateDialog}
      />
    </Container>
  )
}
