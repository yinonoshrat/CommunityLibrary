import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Stack,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  AdminPanelSettings,
  ArrowBack,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiCall } from '../utils/apiCall';

interface FamilyMember {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  is_family_admin: boolean;
}

export default function FamilyMembers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        if (!user?.id) {
          setError('אין משתמש מחובר');
          setLoading(false);
          return;
        }

        // Get current user's profile
        const userResponse = await apiCall<{ user: any }>(`/api/users/${user.id}`);
        const userProfile = userResponse.user;
        
        if (!userProfile) {
          setError('לא נמצא פרופיל משתמש');
          setLoading(false);
          return;
        }

        setIsAdmin(userProfile.is_family_admin);

        if (!userProfile.is_family_admin) {
          setError('רק מנהל משפחה יכול לצפות בדף זה');
          setLoading(false);
          return;
        }

        // Get family members
        const membersResponse = await apiCall<{ users: FamilyMember[] }>(
          `/api/users?familyId=${userProfile.family_id}`
        );
        setMembers(membersResponse.users || []);
        setLoading(false);
      } catch (err: any) {
        console.error('Failed to fetch members:', err);
        setError(err.message || 'שגיאה בטעינת חברי המשפחה');
        setLoading(false);
      }
    };

    fetchMembers();
  }, [user]);

  const handleEdit = (member: FamilyMember) => {
    setEditingMember(member);
    setFormData({
      full_name: member.full_name,
      email: member.email,
      phone: member.phone,
    });
    setOpenDialog(true);
  };

  const handleDelete = async (memberId: string) => {
    if (memberId === user?.id) {
      alert('לא ניתן למחוק את עצמך');
      return;
    }

    if (!confirm('האם אתה בטוח שברצונך למחוק חבר משפחה זה?')) {
      return;
    }

    try {
      await apiCall(`/api/users/${memberId}`, {
        method: 'DELETE',
      });
      setMembers(members.filter((m) => m.id !== memberId));
    } catch (err: any) {
      alert(err.message || 'שגיאה במחיקת חבר המשפחה');
    }
  };

  const handleSave = async () => {
    if (!editingMember) return;

    try {
      const response = await apiCall<{ user: FamilyMember }>(
        `/api/users/${editingMember.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(formData),
        }
      );
      setMembers(members.map((m) => (m.id === response.user.id ? response.user : m)));
      setOpenDialog(false);
      setEditingMember(null);
    } catch (err: any) {
      alert(err.message || 'שגיאה בעדכון הפרטים');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/family')}>
          חזרה
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box mb={4} display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/family')}
            sx={{ mb: 1 }}
          >
            חזרה
          </Button>
          <Typography variant="h4" component="h1">
            חברי המשפחה
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => alert('הוספת חבר משפחה תתאפשר בקרוב')}
        >
          הוסף חבר משפחה
        </Button>
      </Box>

      <Stack spacing={2}>
        {members.map((member) => (
          <Card key={member.id}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box flex={1}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Typography variant="h6">{member.full_name}</Typography>
                    {member.is_family_admin && (
                      <Chip
                        icon={<AdminPanelSettings />}
                        label="מנהל משפחה"
                        size="small"
                        color="primary"
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    טלפון: {member.phone}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    אימייל: {member.email}
                  </Typography>
                </Box>
                <Box>
                  <IconButton
                    size="small"
                    onClick={() => handleEdit(member)}
                    disabled={!isAdmin}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(member.id)}
                    disabled={!isAdmin || member.id === user?.id}
                    color="error"
                  >
                    <Delete />
                  </IconButton>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>עריכת פרטי חבר משפחה</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="שם מלא"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="טלפון"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="אימייל"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            margin="normal"
            disabled
            helperText="לא ניתן לשנות את כתובת האימייל"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>ביטול</Button>
          <Button onClick={handleSave} variant="contained">
            שמור
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
