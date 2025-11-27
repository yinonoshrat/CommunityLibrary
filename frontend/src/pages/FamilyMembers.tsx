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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<FamilyMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userFamilyId, setUserFamilyId] = useState<string | null>(null);
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
        setUserFamilyId(userProfile.family_id);

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

  const loadAvailableUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await apiCall<{ users: FamilyMember[] }>('/api/users?noFamily=true');
      setAvailableUsers(response.users || []);
    } catch (err: any) {
      console.error('Failed to load available users:', err);
      alert('שגיאה בטעינת רשימת המשתמשים');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleOpenAddDialog = () => {
    loadAvailableUsers();
    setOpenAddDialog(true);
  };

  const handleAddMember = async () => {
    if (!selectedUserId || !userFamilyId) return;

    try {
      const response = await apiCall<{ user: FamilyMember }>(
        `/api/users/${selectedUserId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ family_id: userFamilyId }),
        }
      );
      setMembers([...members, response.user]);
      setOpenAddDialog(false);
      setSelectedUserId('');
    } catch (err: any) {
      alert(err.message || 'שגיאה בהוספת חבר למשפחה');
    }
  };

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
      alert('לא ניתן להסיר את עצמך מהמשפחה');
      return;
    }

    if (!confirm('האם אתה בטוח שברצונך להסיר חבר משפחה זה? הוא יוכל להצטרף למשפחה אחרת.')) {
      return;
    }

    try {
      // Remove user from family by setting family_id to null
      await apiCall(`/api/users/${memberId}`, {
        method: 'PUT',
        body: JSON.stringify({ family_id: null }),
      });
      setMembers(members.filter((m) => m.id !== memberId));
    } catch (err: any) {
      alert(err.message || 'שגיאה בהסרת חבר המשפחה');
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
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)}>
          חזרה
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box mb={4} display="flex" alignItems="center" justifyContent="space-between">
        <Box>          
          <Typography variant="h4" component="h1">
            חברי המשפחה
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenAddDialog}
        >
          הוסף חבר משפחה
        </Button>
      </Box>

      <Stack spacing={2}>
        {members.map((member) => (
          <Card key={member.id} data-testid="member-card">
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

      {/* Add Member Dialog */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>הוסף חבר משפחה</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {loadingUsers ? (
              <Box display="flex" justifyContent="center" py={3}>
                <CircularProgress />
              </Box>
            ) : availableUsers.length === 0 ? (
              <Alert severity="info">אין משתמשים זמינים להוספה למשפחה</Alert>
            ) : (
              <FormControl fullWidth>
                <InputLabel>בחר משתמש</InputLabel>
                <Select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  label="בחר משתמש"
                >
                  {availableUsers.map((availableUser) => (
                    <MenuItem key={availableUser.id} value={availableUser.id}>
                      {availableUser.full_name} ({availableUser.email})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenAddDialog(false); setSelectedUserId(''); }}>
            ביטול
          </Button>
          <Button 
            onClick={handleAddMember} 
            variant="contained"
            disabled={!selectedUserId || loadingUsers}
          >
            הוסף
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
