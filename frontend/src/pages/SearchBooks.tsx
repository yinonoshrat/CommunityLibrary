import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  MenuItem,
  InputAdornment,
  CircularProgress,
  Alert,
  FormControlLabel,
  Checkbox,
  Grid,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiCall } from '../utils/apiCall';
import CommunityBookCard from '../components/CommunityBookCard';

interface Family {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
}

interface Book {
  id: string;
  title: string;
  author: string;
  series?: string;
  genre?: string;
  age_level?: string;
  cover_image_url?: string;
  year_published?: number;
  families: Family[];
  availableCount: number;
  totalCount: number;
}

const GENRES = [
  'הכל',
  'רומן',
  'מתח',
  'מדע בדיוני',
  'פנטזיה',
  'ביוגרפיה',
  'היסטוריה',
  'מדע',
  'ילדים',
  'נוער',
  'עיון',
  'שירה',
  'אחר',
];

const AGE_LEVELS = [
  'הכל',
  '0-3',
  '4-6',
  '7-9',
  '10-12',
  '13-15',
  '16-18',
  'מבוגרים',
  'כל הגילאים',
];

export default function SearchBooks() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [genre, setGenre] = useState('הכל');
  const [ageLevel, setAgeLevel] = useState('הכל');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const query = searchParams.get('q');
    if (query) {
      setSearchQuery(query);
      performSearch(query);
    }
  }, [searchParams]);

  const performSearch = async (query?: string) => {
    const q = query || searchQuery;
    if (!q.trim()) {
      setError('נא להזין מילת חיפוש');
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({ q });
      
      if (genre !== 'הכל') {
        params.append('genre', genre);
      }
      
      if (ageLevel !== 'הכל') {
        params.append('ageLevel', ageLevel);
      }
      
      if (onlyAvailable) {
        params.append('available', 'true');
      }

      const response = await apiCall<{ books: Book[] }>(`/api/books/search?${params.toString()}`);
      setBooks(response.books || []);
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'שגיאה בחיפוש');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchParams({ q: searchQuery });
      performSearch();
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          חיפוש ספרים בקהילה
        </Typography>
        <Typography variant="body1" color="text.secondary">
          חפש ספרים זמינים אצל כל המשפחות בקהילה
        </Typography>
      </Box>

      {/* Search Form */}
      <Box component="form" onSubmit={handleSearch} mb={4}>
        <TextField
          fullWidth
          placeholder="חפש לפי שם ספר, מחבר או סדרה..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: loading ? (
              <InputAdornment position="end">
                <CircularProgress size={20} />
              </InputAdornment>
            ) : null,
          }}
          sx={{ mb: 2 }}
        />

        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              select
              fullWidth
              label="ז'אנר"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            >
              {GENRES.map((g) => (
                <MenuItem key={g} value={g}>
                  {g}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              select
              fullWidth
              label="גיל מומלץ"
              value={ageLevel}
              onChange={(e) => setAgeLevel(e.target.value)}
            >
              {AGE_LEVELS.map((level) => (
                <MenuItem key={level} value={level}>
                  {level}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={onlyAvailable}
                  onChange={(e) => setOnlyAvailable(e.target.checked)}
                />
              }
              label="רק זמינים"
            />
          </Grid>
        </Grid>

        <Box mt={2}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading || !searchQuery.trim()}
            startIcon={<SearchIcon />}
          >
            חפש
          </Button>
        </Box>
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Results */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      ) : hasSearched ? (
        books.length > 0 ? (
          <>
            <Typography variant="h6" gutterBottom>
              נמצאו {books.length} ספרים
            </Typography>
            <Grid container spacing={3}>
              {books.map((book) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={book.id}>
                  <CommunityBookCard
                    book={book}
                    onClick={() => navigate(`/books/${book.id}`)}
                  />
                </Grid>
              ))}
            </Grid>
          </>
        ) : (
          <Box textAlign="center" py={8}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              לא נמצאו ספרים
            </Typography>
            <Typography variant="body2" color="text.secondary">
              נסה לשנות את מילות החיפוש או את הסינון
            </Typography>
          </Box>
        )
      ) : (
        <Box textAlign="center" py={8}>
          <SearchIcon sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            הזן מילת חיפוש למציאת ספרים
          </Typography>
        </Box>
      )}
    </Container>
  );
}
