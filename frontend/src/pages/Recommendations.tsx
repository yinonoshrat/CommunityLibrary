import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  CircularProgress,
  Alert,
  FormControlLabel,
  Switch,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import { apiCall } from '../utils/apiCall';
import { useAuth } from '../contexts/AuthContext';
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
  match_percentage?: number;
  reason?: string;
}

export default function Recommendations() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadRecommendations();
    }
  }, [user]);

  const loadRecommendations = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError('');
      const data = await apiCall(`/api/recommendations?userId=${user.id}`);
      setRecommendations(data.recommendations || []);
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת המלצות');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRecommendations = () => {
    if (!onlyAvailable) return recommendations;
    return recommendations.filter((book) => book.status === 'available');
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 4 } }}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          ספרים מומלצים עבורך
        </Typography>
        <Typography variant="body1" color="text.secondary">
          המלצות מותאמות אישית בהתבסס על הספרים שאהבת
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box mb={3}>
        <FormControlLabel
          control={
            <Switch
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
            />
          }
          label="הצג רק ספרים זמינים"
        />
      </Box>

      {recommendations.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" align="center">
              אין לנו עדיין מספיק מידע כדי להמליץ לך על ספרים.
              <br />
              נסה לתת לייק לספרים שאהבת או לכתוב ביקורות!
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {getFilteredRecommendations().length === 0 ? (
            <Alert severity="info">
              לא נמצאו ספרים זמינים בהמלצות. נסה להסיר את הסינון.
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {getFilteredRecommendations().map((book) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={book.id}>
                  <Box>
                    <BookCard book={book} />
                    {book.match_percentage && book.match_percentage > 0 && (
                      <Box sx={{ mt: 1, display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <Chip
                          label={`התאמה: ${book.match_percentage}%`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        {book.reason && (
                          <Chip
                            label={book.reason}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    )}
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}
    </Container>
  );
}
