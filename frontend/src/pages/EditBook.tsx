import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  MenuItem,
  Grid,
  Paper,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiCall } from '../utils/apiCall';

interface BookFormData {
  title: string;
  author: string;
  series: string;
  series_number: string;
  isbn: string;
  year_published: string;
  publisher: string;
  genre: string;
  age_level: string;
  pages: string;
  summary: string;
  cover_image_url: string;
}

const GENRES = [
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
  '0-3',
  '4-6',
  '7-9',
  '10-12',
  '13-15',
  '16-18',
  'מבוגרים',
  'כל הגילאים',
];

export default function EditBook() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [userFamilyId, setUserFamilyId] = useState<string | null>(null);
  const [bookFamilyId, setBookFamilyId] = useState<string | null>(null);

  const [formData, setFormData] = useState<BookFormData>({
    title: '',
    author: '',
    series: '',
    series_number: '',
    isbn: '',
    year_published: '',
    publisher: '',
    genre: '',
    age_level: '',
    pages: '',
    summary: '',
    cover_image_url: '',
  });

  const [errors, setErrors] = useState<Partial<BookFormData>>({});

  useEffect(() => {
    fetchUserFamily();
    if (id) {
      fetchBook();
    }
  }, [id, user]);

  const fetchUserFamily = async () => {
    if (!user?.id) return;

    try {
      const userResponse = await apiCall<{ user: any }>(`/api/users/${user.id}`);
      setUserFamilyId(userResponse.user?.family_id);
    } catch (err) {
      console.error('Failed to fetch user family:', err);
    }
  };

  const fetchBook = async () => {
    if (!id) return;

    try {
      setError(null);
      const response = await apiCall<{ book: any }>(`/api/books/${id}`);
      const book = response.book;
      
      setBookFamilyId(book.family_id);
      
      setFormData({
        title: book.title || '',
        author: book.author || '',
        series: book.series || '',
        series_number: book.series_number?.toString() || '',
        isbn: book.isbn || '',
        year_published: book.year_published?.toString() || '',
        publisher: book.publisher || '',
        genre: book.genre || '',
        age_level: book.age_level || '',
        pages: book.pages?.toString() || '',
        summary: book.summary || '',
        cover_image_url: book.cover_image_url || '',
      });
      
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch book:', err);
      setError(err.message || 'שגיאה בטעינת פרטי הספר');
      setLoading(false);
    }
  };

  const handleChange = (field: keyof BookFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [field]: event.target.value });
    // Clear error for this field
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<BookFormData> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'שם הספר הוא שדה חובה';
    }
    if (!formData.author.trim()) {
      newErrors.author = 'שם המחבר הוא שדה חובה';
    }
    if (!formData.genre) {
      newErrors.genre = 'ז\'אנר הוא שדה חובה';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Check if user is the owner
    if (userFamilyId !== bookFamilyId) {
      setError('אין לך הרשאה לערוך ספר זה');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const bookData = {
        title: formData.title.trim(),
        author: formData.author.trim(),
        series: formData.series.trim() || null,
        series_number: formData.series_number ? parseInt(formData.series_number) : null,
        isbn: formData.isbn.trim() || null,
        year_published: formData.year_published ? parseInt(formData.year_published) : null,
        publisher: formData.publisher.trim() || null,
        genre: formData.genre,
        age_level: formData.age_level || null,
        pages: formData.pages ? parseInt(formData.pages) : null,
        summary: formData.summary.trim() || null,
        cover_image_url: formData.cover_image_url.trim() || null,
      };

      await apiCall(`/api/books/${id}`, {
        method: 'PUT',
        body: JSON.stringify(bookData),
      });

      setSuccess(true);
      setTimeout(() => {
        navigate(`/books/${id}`);
      }, 1500);
    } catch (err: any) {
      console.error('Failed to update book:', err);
      setError(err.message || 'שגיאה בעדכון הספר');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (userFamilyId && bookFamilyId && userFamilyId !== bookFamilyId) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">אין לך הרשאה לערוך ספר זה</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/books')} sx={{ mt: 2 }}>
          חזרה לספרים
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box mb={4}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate(`/books/${id}`)}
          sx={{ mb: 2 }}
        >
          חזרה לפרטי הספר
        </Button>
        <Typography variant="h4" component="h1" gutterBottom>
          ערוך ספר
        </Typography>
        <Typography variant="body1" color="text.secondary">
          ערוך את פרטי הספר
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          הספר עודכן בהצלחה! מעביר לדף הספר...
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Title */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                required
                label="שם הספר"
                value={formData.title}
                onChange={handleChange('title')}
                error={!!errors.title}
                helperText={errors.title}
                disabled={saving || success}
                dir="auto"
                inputProps={{ dir: 'auto' }}
              />
            </Grid>

            {/* Author */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                required
                label="מחבר"
                value={formData.author}
                onChange={handleChange('author')}
                error={!!errors.author}
                helperText={errors.author}
                disabled={saving || success}
                dir="auto"
                inputProps={{ dir: 'auto' }}
              />
            </Grid>

            {/* Series */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="סדרה"
                value={formData.series}
                onChange={handleChange('series')}
                disabled={saving || success}
                placeholder="למשל: הארי פוטר"
                dir="auto"
                inputProps={{ dir: 'auto' }}
              />
            </Grid>

            {/* Series Number */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="מספר כרך בסדרה"
                type="number"
                value={formData.series_number}
                onChange={handleChange('series_number')}
                disabled={saving || success}
                inputProps={{ min: 1 }}
                placeholder="1, 2, 3..."
              />
            </Grid>

            {/* ISBN */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="ISBN"
                value={formData.isbn}
                onChange={handleChange('isbn')}
                disabled={saving || success}
              />
            </Grid>

            {/* Year Published */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="שנת פרסום"
                type="number"
                value={formData.year_published}
                onChange={handleChange('year_published')}
                disabled={saving || success}
                inputProps={{ min: 1000, max: new Date().getFullYear() }}
              />
            </Grid>

            {/* Publisher */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="הוצאה לאור"
                value={formData.publisher}
                onChange={handleChange('publisher')}
                disabled={saving || success}
                dir="auto"
                inputProps={{ dir: 'auto' }}
              />
            </Grid>

            {/* Pages */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="מספר עמודים"
                type="number"
                value={formData.pages}
                onChange={handleChange('pages')}
                disabled={saving || success}
                inputProps={{ min: 1 }}
              />
            </Grid>

            {/* Genre */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                required
                select
                label="ז'אנר"
                value={formData.genre}
                onChange={handleChange('genre')}
                error={!!errors.genre}
                helperText={errors.genre}
                disabled={saving || success}
              >
                {GENRES.map((genre) => (
                  <MenuItem key={genre} value={genre}>
                    {genre}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Age Level */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                select
                label="גיל מומלץ"
                value={formData.age_level}
                onChange={handleChange('age_level')}
                disabled={saving || success}
              >
                {AGE_LEVELS.map((level) => (
                  <MenuItem key={level} value={level}>
                    {level}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Cover Image URL */}
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="קישור לתמונת השער"
                value={formData.cover_image_url}
                onChange={handleChange('cover_image_url')}
                disabled={saving || success}
                placeholder="https://example.com/book-cover.jpg"
              />
            </Grid>

            {/* Summary */}
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="תקציר"
                value={formData.summary}
                onChange={handleChange('summary')}
                disabled={saving || success}
                placeholder="תקציר קצר של הספר..."
                dir="auto"
                inputProps={{ dir: 'auto' }}
              />
            </Grid>

            {/* Action Buttons */}
            <Grid size={{ xs: 12 }}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => navigate(`/books/${id}`)}
                  disabled={saving || success}
                >
                  ביטול
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                  disabled={saving || success}
                  sx={{ minWidth: 120 }}
                >
                  {saving ? 'שומר...' : 'שמור שינויים'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Container>
  );
}
