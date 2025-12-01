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
import { Google as GoogleIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { apiCall } from '../utils/apiCall'

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

export default function Register() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [families, setFamilies] = useState<Family[]>([])
  const [loadingFamilies, setLoadingFamilies] = useState(true)
  const [oauthLoading, setOauthLoading] = useState(false)
  
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

  const validateForm = () => {
    if (!email || !password || !fullName) {
      setError('נא למלא את כל השדות החובה')
      return false
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('אימייל לא תקין')
      return false
    }
    
    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות')
      return false
    }
    
    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים')
      return false
    }
    
    // Validate family choice
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
    // Submit with the selected existing family
    handleSubmitWithFamily(family)
  }

  const handleCancelDuplicateDialog = () => {
    setDuplicateDialogOpen(false)
    setDuplicateFamilies([])
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
        // Use user's phone/whatsapp for the family
        payload.familyPhone = phone
        payload.familyWhatsapp = whatsapp || phone
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    // Check for duplicate family names if creating new family
    if (familyChoice === 'new') {
      checkForDuplicateFamilyName()
    } else {
      handleSubmit()
    }
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center" data-testid="register-title">
            הרשמה לספרייה הקהילתית
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

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
              {oauthLoading ? <CircularProgress size={24} /> : 'המשך עם Google'}
            </Button>

            <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
              <Divider sx={{ flexGrow: 1 }} />
              <Typography variant="body2" sx={{ px: 2, color: 'text.secondary' }}>
                או
              </Typography>
              <Divider sx={{ flexGrow: 1 }} />
            </Box>
          </Box>

          <Box component="form" onSubmit={handleFormSubmit}>
            {/* Personal Details */}
            <Typography variant="h6" sx={{ mb: 2 }}>
              פרטים אישיים
            </Typography>

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
                  helperText="לדוגמה: משפחת כהן. יצירת המשפחה תשתמש בטלפון והווטסאפ שלך"
                  inputProps={{ 'data-testid': 'familyName-input' }}
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
              disabled={loading || checkingFamilyName || oauthLoading}
              sx={{ mt: 3 }}
              data-testid="submit-button"
            >
              {loading || checkingFamilyName ? (
                <CircularProgress size={24} />
              ) : (
                'הירשם'
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
