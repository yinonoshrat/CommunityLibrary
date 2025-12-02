import { useState } from 'react';
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
  Autocomplete,
  ListItemText,
} from '@mui/material';
import {
  Search as SearchIcon,
  LibraryBooks,
  TrendingUp,
  TrendingDown,
  MenuBook as MenuBookIcon,
  Stars as StarsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../hooks/useUser';
import { useBooks, useBookSearch } from '../hooks/useBooks';
import { useLoansByOwner, useLoansByBorrower } from '../hooks/useLoans';

interface BookSuggestion {
  id: string;
  title: string;
  author: string;
  cover_image_url?: string;
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Use reactive hooks - data is cached and shared across components!
  // If Home.tsx is visited again, cached data shows instantly while fresh data loads in background
  const { data: userData, isLoading: userLoading } = useUser(user?.id);
  const familyId = userData?.user?.family_id;

  // These queries automatically run when familyId is available
  const { data: booksData, isLoading: booksLoading } = useBooks({ familyId, userId: user?.id }, { enabled: !!familyId });
  const { data: loansOutData, isLoading: loansOutLoading } = useLoansByOwner(familyId, 'active');
  const { data: loansInData, isLoading: loansInLoading } = useLoansByBorrower(familyId, 'active');

  // Search suggestions with debouncing
  const { data: searchData, isLoading: loadingSuggestions } = useBookSearch(searchQuery, {
    enabled: searchQuery.trim().length >= 2,
  });
  const suggestions = searchData?.books?.slice(0, 5) || [];

  // Compute stats from cached data
  const books = booksData?.books || [];
  const loansOut = loansOutData?.loans || [];
  const loansIn = loansInData?.loans || [];

  const catalogStats = {
    totalBooks: books.length,
    booksOnLoan: loansOut.length,
    booksAvailable: books.length - loansOut.length,
  };

  const loanStatus = {
    booksLent: loansOut.length,
    booksBorrowed: loansIn.length,
  };

  // Overall loading state - true only on initial load
  const loading = userLoading || (familyId && (booksLoading || loansOutLoading || loansInLoading));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set('view', 'all');
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    }
    navigate({ pathname: '/books', search: params.toString() });
  };

  const handleSelectBook = (book: BookSuggestion | null) => {
    if (book) {
      navigate(`/books/${book.id}`);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 4 } }}>
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
          <Autocomplete
            data-testid="search-autocomplete"
            fullWidth
            freeSolo
            options={suggestions}
            loading={loadingSuggestions}
            inputValue={searchQuery}
            onInputChange={(_, newValue) => setSearchQuery(newValue)}
            onChange={(_, value) => {
              if (typeof value === 'object' && value !== null) {
                handleSelectBook(value);
              }
            }}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return `${option.title} - ${option.author}`;
            }}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 60,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'action.hover',
                      borderRadius: 0.5,
                      overflow: 'hidden',
                    }}
                  >
                    {option.cover_image_url ? (
                      <img
                        src={option.cover_image_url}
                        alt={option.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        onError={(e) => {
                          // Fallback to icon if image fails to load
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent && !parent.querySelector('svg')) {
                            const icon = document.createElement('div');
                            icon.innerHTML = '<svg class="MuiSvgIcon-root" focusable="false" aria-hidden="true" viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: currentColor;"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"></path></svg>';
                            parent.appendChild(icon.firstChild as Node);
                          }
                        }}
                      />
                    ) : (
                      <MenuBookIcon sx={{ fontSize: 24, color: 'action.active' }} />
                    )}
                  </Box>
                  <ListItemText
                    primary={option.title}
                    secondary={option.author}
                    sx={{ flex: 1, minWidth: 0 }}
                  />
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="חפש לפי שם ספר, מחבר, ז'אנר..."
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <>
                      {loadingSuggestions ? <CircularProgress size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '1rem',
                    minHeight: '36px',
                    py: 0,
                    '& .MuiOutlinedInput-input': {
                      py: 1,
                    },
                  },
                }}
              />
            )}
          />
          <Button
            data-testid="search-submit-button"
            type="submit"
            variant="contained"
            size="medium"
            startIcon={<SearchIcon />}
            sx={{ minWidth: 140 }}
          >
            חיפוש מורחב
          </Button>
        </Box>
        
        <Box sx={{ maxWidth: 800, mx: 'auto', mt: 2, textAlign: 'center', display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            data-testid="add-books-button"
            variant="contained"
            size="medium"
            startIcon={<LibraryBooks />}
            onClick={() => navigate('/books/add')}
          >
            הוספת ספרים
          </Button>
          <Button
            data-testid="recommendations-button"
            variant="outlined"
            size="medium"
            startIcon={<StarsIcon />}
            onClick={() => navigate('/recommendations')}
          >
            המלצות
          </Button>
        </Box>
      </Box>

      {/* Current Loan Status */}
      <Box mb={4} data-testid="loan-status-section">
        <Typography variant="h6" gutterBottom>
          סטטוס השאלות
        </Typography>
        {loading ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card
                data-testid="books-lent-card"
                sx={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
                onClick={() => navigate('/books?view=my&status=on_loan')}
              >
                <CardContent>
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
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card
                data-testid="books-borrowed-card"
                sx={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
                onClick={() => navigate('/books?view=borrowed')}
              >
                <CardContent>
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
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>

       {/* Catalog Summary */}
      <Box>
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
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
                onClick={() => navigate('/books?status=all')}
              >
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
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
                onClick={() => navigate('/books?status=available')}
              >
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
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
                onClick={() => navigate('/books?status=on_loan')}
              >
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

      {/* How It Works Section */}
      <Box mt={8} mb={4}>
        <Typography variant="h5" component="h2" gutterBottom textAlign="center" sx={{ mb: 4 }}>
          איך זה עובד?
        </Typography>
        <Grid container spacing={4} direction="row-reverse">
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: '100%', textAlign: 'center' }}>
              <CardContent>
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    bgcolor: 'primary.light',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <Typography variant="h3" component="span" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                    1
                  </Typography>
                </Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                  הוסיפו את הספרים שלכם
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  צרו קטלוג דיגיטלי של ספריית הבית שלכם. הוסיפו פרטים על הספרים, תמונות ותיאורים. כל הספרים
                  יהיו נגישים לחיפוש במערכת הקהילתית.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: '100%', textAlign: 'center' }}>
              <CardContent>
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    bgcolor: 'success.light',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <Typography variant="h3" component="span" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                    2
                  </Typography>
                </Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                  גלו ספרים בקהילה
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  חפשו ספרים מעניינים בקרב משפחות אחרות בקהילה. ראו מי מחזיק בספר שאתם מחפשים, קבלו המלצות
                  ומצאו ספרים חדשים שלא הכרתם.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: '100%', textAlign: 'center' }}>
              <CardContent>
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    bgcolor: 'info.light',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <Typography variant="h3" component="span" sx={{ color: 'info.main', fontWeight: 'bold' }}>
                    3
                  </Typography>
                </Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                  שאלו והשאילו
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  פנו למשפחות אחרות לשאילת ספרים, נהלו את ההשאלות בצורה נוחה ומסודרת. השאילו גם את הספרים שלכם
                  לאחרים וחזקו את הקהילה הקוראת!
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}
