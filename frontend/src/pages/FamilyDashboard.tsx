import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Book,
  Repeat,
  HourglassEmpty,
  People,
  Add,
  LibraryBooks,
  Settings,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiCall } from '../utils/apiCall';

interface FamilyStats {
  totalBooks: number;
  booksOnLoan: number;
  booksBorrowed: number;
  membersCount: number;
}

interface Family {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
}

export default function FamilyDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [stats, setStats] = useState<FamilyStats>({
    totalBooks: 0,
    booksOnLoan: 0,
    booksBorrowed: 0,
    membersCount: 0,
  });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchFamilyData = async () => {
      try {
        if (!user?.id) {
          setError('אין משתמש מחובר');
          setLoading(false);
          return;
        }

        // Get current user's profile to find family_id
        const userResponse = await apiCall<{ user: any }>(`/api/users/${user.id}`);
        const userProfile = userResponse.user;
        
        if (!userProfile) {
          setError('לא נמצא פרופיל משתמש');
          setLoading(false);
          return;
        }

        const familyId = userProfile.family_id;
        
        if (!familyId) {
          setError('המשתמש לא משויך למשפחה');
          setLoading(false);
          return;
        }

        setIsAdmin(userProfile.is_family_admin);

        // Get family details
        const familyResponse = await apiCall<{ family: Family }>(`/api/families/${familyId}`);
        setFamily(familyResponse.family);

        // Get family stats
        const [booksResponse, membersResponse, loansOutResponse, loansInResponse] = await Promise.all([
          apiCall<{ books: any[] }>(`/api/books?familyId=${familyId}`),
          apiCall<{ users: any[] }>(`/api/users?familyId=${familyId}`),
          apiCall<{ loans: any[] }>(`/api/loans?ownerFamilyId=${familyId}&status=active`),
          apiCall<{ loans: any[] }>(`/api/loans?borrowerFamilyId=${familyId}&status=active`),
        ]);

        setStats({
          totalBooks: booksResponse.books?.length || 0,
          booksOnLoan: loansOutResponse.loans?.length || 0,
          booksBorrowed: loansInResponse.loans?.length || 0,
          membersCount: membersResponse.users?.length || 0,
        });

        setLoading(false);
      } catch (err: any) {
        console.error('Failed to fetch family data:', err);
        setError(err.message || 'שגיאה בטעינת נתוני המשפחה');
        setLoading(false);
      }
    };

    fetchFamilyData();
  }, [user]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const statsData = [
    {
      icon: <Book fontSize="large" />,
      value: stats.totalBooks,
      label: 'ספרים בקטלוג',
      color: 'primary.main',
    },
    {
      icon: <Repeat fontSize="large" />,
      value: stats.booksOnLoan,
      label: 'ספרים מושאלים',
      color: 'warning.main',
    },
    {
      icon: <HourglassEmpty fontSize="large" />,
      value: stats.booksBorrowed,
      label: 'ספרים ששאלנו',
      color: 'info.main',
    },
    {
      icon: <People fontSize="large" />,
      value: stats.membersCount,
      label: 'חברי משפחה',
      color: 'success.main',
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          {family?.name || 'המשפחה שלי'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {family?.phone && `טלפון: ${family.phone}`}
          {family?.whatsapp && ` | WhatsApp: ${family.whatsapp}`}
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} mb={4}>
        {statsData.map((stat, index) => (
          <Grid size={{ xs: 6, sm: 3 }} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" flexDirection="column" alignItems="center">
                  <Box color={stat.color} mb={1}>
                    {stat.icon}
                  </Box>
                  <Typography variant="h4" component="div">
                    {stat.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    {stat.label}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Actions */}
      <Box mb={4}>
        <Typography variant="h6" gutterBottom>
          פעולות מהירות
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate('/books/add')}
              sx={{ py: 1.5 }}
            >
              הוסף ספר
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<LibraryBooks />}
              onClick={() => navigate('/books')}
              sx={{ py: 1.5 }}
            >
              הצג כל הספרים
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Repeat />}
              onClick={() => navigate('/loans')}
              sx={{ py: 1.5 }}
            >
              ניהול השאלות
            </Button>
          </Grid>
          {isAdmin && (
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Settings />}
                onClick={() => navigate('/family/members')}
                sx={{ py: 1.5 }}
              >
                ניהול חברי משפחה
              </Button>
            </Grid>
          )}
        </Grid>
      </Box>

      {/* Recent Activity or Empty State */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            פעילות אחרונה
          </Typography>
          <Box py={3} textAlign="center">
            <Typography variant="body2" color="text.secondary">
              בקרוב - מעקב אחר פעילות המשפחה
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
