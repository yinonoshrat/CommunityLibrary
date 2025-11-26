import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  TextField,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
  CircularProgress,
  Alert,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiCall } from '../utils/apiCall';
import BookCard from '../components/BookCard';

interface Book {
  id: string;
  title: string;
  author: string;
  series?: string;
  series_number?: number;
  genre?: string;
  age_level?: string;
  cover_image_url?: string;
  status: 'available' | 'on_loan' | 'borrowed';
  year_published?: number;
}

export default function MyBooks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [books, setBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [genreFilter, setGenreFilter] = useState('all');
  const [sortBy, setSortBy] = useState('title');

  useEffect(() => {
    fetchBooks();
  }, [user]);

  useEffect(() => {
    filterAndSortBooks();
  }, [books, searchQuery, statusFilter, genreFilter, sortBy]);

  const fetchBooks = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Get user profile to get family_id
      const userResponse = await apiCall<{ user: any }>(`/api/users/${user.id}`);
      const familyId = userResponse.user?.family_id;

      if (familyId) {
        const booksResponse = await apiCall<{ books: Book[] }>(`/api/books?familyId=${familyId}`);
        setBooks(booksResponse.books || []);
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch books:', err);
      setError(err.message || 'שגיאה בטעינת הספרים');
      setLoading(false);
    }
  };

  const filterAndSortBooks = () => {
    let filtered = [...books];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (book) =>
          book.title.toLowerCase().includes(query) ||
          book.author.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((book) => book.status === statusFilter);
    }

    // Apply genre filter
    if (genreFilter !== 'all') {
      filtered = filtered.filter((book) => book.genre === genreFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title, 'he');
        case 'author':
          return a.author.localeCompare(b.author, 'he');
        case 'year':
          return (b.year_published || 0) - (a.year_published || 0);
        default:
          return 0;
      }
    });

    setFilteredBooks(filtered);
  };

  const handleStatusFilterChange = (event: SelectChangeEvent) => {
    setStatusFilter(event.target.value);
  };

  const handleGenreFilterChange = (event: SelectChangeEvent) => {
    setGenreFilter(event.target.value);
  };

  const handleSortChange = (event: SelectChangeEvent) => {
    setSortBy(event.target.value);
  };

  const uniqueGenres = Array.from(new Set(books.map((book) => book.genre).filter(Boolean)));

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box mb={4} display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            הספרים שלי
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {filteredBooks.length} ספרים בקטלוג
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/books/add')}
          sx={{ py: 1.5 }}
        >
          הוסף ספר
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Search and Filters */}
      <Box mb={4}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              placeholder="חפש לפי שם ספר או מחבר..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>סטטוס</InputLabel>
              <Select value={statusFilter} onChange={handleStatusFilterChange} label="סטטוס">
                <MenuItem value="all">הכל</MenuItem>
                <MenuItem value="available">זמין</MenuItem>
                <MenuItem value="on_loan">מושאל</MenuItem>
                <MenuItem value="borrowed">שאלנו</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>ז'אנר</InputLabel>
              <Select value={genreFilter} onChange={handleGenreFilterChange} label="ז'אנר">
                <MenuItem value="all">הכל</MenuItem>
                {uniqueGenres.map((genre) => (
                  <MenuItem key={genre} value={genre}>
                    {genre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>מיון</InputLabel>
              <Select value={sortBy} onChange={handleSortChange} label="מיון">
                <MenuItem value="title">שם הספר</MenuItem>
                <MenuItem value="author">מחבר</MenuItem>
                <MenuItem value="year">שנת פרסום</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>

      {/* Books Grid */}
      {filteredBooks.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {books.length === 0 ? 'אין ספרים בקטלוג' : 'לא נמצאו ספרים'}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {books.length === 0
              ? 'הוסף את הספר הראשון שלך לקטלוג'
              : 'נסה לשנות את הסינון או החיפוש'}
          </Typography>
          {books.length === 0 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/books/add')}
            >
              הוסף ספר
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredBooks.map((book) => (
            <Grid key={book.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <BookCard book={book} onRefresh={fetchBooks} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
