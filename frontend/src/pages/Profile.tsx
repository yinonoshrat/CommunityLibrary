import { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Edit, Save, Cancel } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useUser, useUserFamily } from '../hooks/useUser';
import { apiCall } from '../utils/apiCall';
import { supabase } from '../lib/supabase';

export default function Profile() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [editedProfile, setEditedProfile] = useState({
    fullName: '',
    phone: '',
  });

  // Get current user ID
  useState(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate('/login');
      } else {
        setUserId(user.id);
      }
    });
  });

  // Reactive hooks - automatic caching
  const { data: userResponse, isLoading: userLoading } = useUser(userId || undefined);
  const { data: familyResponse, isLoading: familyLoading } = useUserFamily(userId || undefined);
  
  const loading = userLoading || familyLoading;
  const profile = userResponse?.user ? {
    id: userResponse.user.id,
    fullName: userResponse.user.full_name,
    phone: userResponse.user.phone || '',
    email: userResponse.user.email,
    familyId: userResponse.user.family_id,
    isFamilyAdmin: userResponse.user.is_family_admin,
  } : null;
  
  const family = familyResponse?.family ? {
    id: familyResponse.family.id,
    name: familyResponse.family.name,
    phone: familyResponse.family.phone || '',
    whatsapp: familyResponse.family.whatsapp || '',
  } : null;

  // Initialize edit form when profile loads
  if (profile && !editedProfile.fullName) {
    setEditedProfile({
      fullName: profile.fullName,
      phone: profile.phone,
    });
  }

  const handleSave = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await apiCall(`/api/users/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editedProfile.fullName,
          phone: editedProfile.phone,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'שגיאה בשמירת השינויים');
      }

      // TanStack Query will auto-invalidate and refetch user data
      setSuccess('השינויים נשמרו בהצלחה');
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת השינויים');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setEditedProfile({
        fullName: profile.fullName,
        phone: profile.phone,
      });
    }
    setEditing(false);
    setError('');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>טוען פרופיל...</Typography>
      </Container>
    );
  }

  if (!profile) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Alert severity="error">לא נמצא פרופיל משתמש</Alert>
        <Button onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          חזרה
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        הפרופיל שלי
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        {/* Personal Information */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">פרטים אישיים</Typography>
            {!editing && (
              <Button
                startIcon={<Edit />}
                onClick={() => setEditing(true)}
                size="small"
              >
                ערוך
              </Button>
            )}
          </Box>

          <TextField
            fullWidth
            label="שם מלא"
            value={editing ? editedProfile.fullName : profile.fullName}
            onChange={(e) => setEditedProfile({ ...editedProfile, fullName: e.target.value })}
            disabled={!editing}
            sx={{ mb: 2 }}
            required
          />

          <TextField
            fullWidth
            label="טלפון"
            value={editing ? editedProfile.phone : profile.phone}
            onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
            disabled={!editing}
            sx={{ mb: 2 }}
            placeholder="050-1234567"
          />

          <TextField
            fullWidth
            label="אימייל"
            value={profile.email}
            disabled
            sx={{ mb: 2 }}
            helperText="לא ניתן לשנות את כתובת האימייל"
          />

          {editing && (
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={saving || !editedProfile.fullName.trim()}
                fullWidth
              >
                {saving ? 'שומר...' : 'שמור שינויים'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<Cancel />}
                onClick={handleCancel}
                disabled={saving}
                fullWidth
              >
                ביטול
              </Button>
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Family Information */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            פרטי משפחה
          </Typography>

          {family ? (
            <>
              <TextField
                fullWidth
                label="שם המשפחה"
                value={family.name}
                disabled
                sx={{ mb: 2 }}
              />

              {family.phone && (
                <TextField
                  fullWidth
                  label="טלפון משפחתי"
                  value={family.phone}
                  disabled
                  sx={{ mb: 2 }}
                />
              )}

              {family.whatsapp && (
                <TextField
                  fullWidth
                  label="וואטסאפ משפחתי"
                  value={family.whatsapp}
                  disabled
                  sx={{ mb: 2 }}
                />
              )}

              <TextField
                fullWidth
                label="תפקיד במשפחה"
                value={profile.isFamilyAdmin ? 'מנהל משפחה' : 'חבר משפחה'}
                disabled
              />
            </>
          ) : (
            <Alert severity="info">לא משוייך למשפחה</Alert>
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Actions */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate('/change-password')}
            fullWidth
          >
            שנה סיסמה
          </Button>

          {profile.isFamilyAdmin && (
            <Button
              variant="outlined"
              color="primary"
              onClick={() => navigate('/family')}
              fullWidth
            >
              ניהול המשפחה
            </Button>
          )}

          <Button
            variant="outlined"
            color="error"
            onClick={handleLogout}
            fullWidth
          >
            התנתק
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
