import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Button,
  Grid,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Book as BookIcon,
  SwapHoriz as SwapIcon,
  People as PeopleIcon,
  LibraryBooks,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiCall } from '../utils/apiCall';

interface CatalogStats {
  totalBooks: number;
  booksOnLoan: number;
  booksAvailable: number;
}

interface LoanStatus {
  booksLent: number;
  booksBorrowed: number;
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [catalogStats, setCatalogStats] = useState<CatalogStats>({
    totalBooks: 0,
    booksOnLoan: 0,
    booksAvailable: 0,
  });
  const [loanStatus, setLoanStatus] = useState<LoanStatus>({
    booksLent: 0,
    booksBorrowed: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        // Get user profile to get family_id
        const userResponse = await apiCall<{ user: any }>(`/api/users/${user.id}`);
        const familyId = userResponse.user?.family_id;

        if (familyId) {
          // Get catalog stats
          const [booksResponse, loansOutResponse, loansInResponse] = await Promise.all([
            apiCall<{ books: any[] }>(`/api/books?familyId=${familyId}`),
            apiCall<{ loans: any[] }>(`/api/loans?ownerFamilyId=${familyId}&status=active`),
            apiCall<{ loans: any[] }>(`/api/loans?borrowerFamilyId=${familyId}&status=active`),
          ]);

          const books = booksResponse.books || [];
          const loansOut = loansOutResponse.loans || [];
          const loansIn = loansInResponse.loans || [];

          setCatalogStats({
            totalBooks: books.length,
            booksOnLoan: loansOut.length,
            booksAvailable: books.length - loansOut.length,
          });

          setLoanStatus({
            booksLent: loansOut.length,
            booksBorrowed: loansIn.length,
          });
        }

        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Search Section - Main Focus */}
      <Box mb={6}>
        <Typography variant="h4" component="h1" gutterBottom textAlign="center">
          חיפוש ספרים בקהילה
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center" mb={3}>
          חפש ספרים מעניינים בכל הספריות הקהילתיות
        </Typography>
        
        <Box
          component="form"
          onSubmit={handleSearch}
          sx={{
            maxWidth: 800,
            mx: 'auto',
            display: 'flex',
            gap: 2,
          }}
        >
          <TextField
            fullWidth
            placeholder="חפש לפי שם ספר, מחבר, ז'אנר..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '1.1rem',
                py: 1,
              },
            }}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={<SearchIcon />}
            sx={{ minWidth: 120 }}
          >
            חפש
          </Button>
        </Box>
      </Box>

      {/* Catalog Summary */}
      <Box mb={4}>
        <Typography variant="h6" gutterBottom>
          הקטלוג שלי
        </Typography>
        {loading ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2}>
                    <LibraryBooks color="primary" fontSize="large" />
                    <Box>
                      <Typography variant="h4">{catalogStats.totalBooks}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        סה"כ ספרים
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2}>
                    <TrendingUp color="success" fontSize="large" />
                    <Box>
                      <Typography variant="h4">{catalogStats.booksAvailable}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        זמינים להשאלה
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2}>
                    <TrendingDown color="warning" fontSize="large" />
                    <Box>
                      <Typography variant="h4">{catalogStats.booksOnLoan}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        מושאלים כרגע
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>

      {/* Current Loan Status */}
      <Box mb={4}>
        <Typography variant="h6" gutterBottom>
          סטטוס השאלות
        </Typography>
        {loading ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress />
          </Box>
        ) : (
          <Card>
            <CardContent>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: 'info.light',
                        color: 'info.contrastText',
                      }}
                    >
                      <TrendingUp />
                    </Box>
                    <Box>
                      <Typography variant="h5">{loanStatus.booksLent}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        ספרים שהשאלתם לאחרים
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: 'secondary.light',
                        color: 'secondary.contrastText',
                      }}
                    >
                      <TrendingDown />
                    </Box>
                    <Box>
                      <Typography variant="h5">{loanStatus.booksBorrowed}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        ספרים ששאלתם מאחרים
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Management Actions */}
      <Box>
        <Typography variant="h6" gutterBottom>
          ניהול
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
              onClick={() => navigate('/books')}
            >
              <CardContent>
                <Box display="flex" flexDirection="column" alignItems="center" textAlign="center">
                  <BookIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    ניהול קטלוג ספרים
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    הוסף, ערוך ומחק ספרים מהקטלוג המשפחתי
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
              onClick={() => navigate('/loans')}
            >
              <CardContent>
                <Box display="flex" flexDirection="column" alignItems="center" textAlign="center">
                  <SwapIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    ניהול השאלות
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    נהל בקשות השאלה ועקוב אחרי ספרים מושאלים
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
              onClick={() => navigate('/family')}
            >
              <CardContent>
                <Box display="flex" flexDirection="column" alignItems="center" textAlign="center">
                  <PeopleIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    ניהול המשפחה
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    נהל את פרטי המשפחה וחברי הקהילה
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}
