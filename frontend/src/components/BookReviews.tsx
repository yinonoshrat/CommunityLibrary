import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Rating,
  Button,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { apiCall } from '../utils/apiCall';
import { useAuth } from '../contexts/AuthContext';
import AddReviewDialog from './AddReviewDialog';

interface Review {
  id: string;
  rating: number;
  review_text: string;
  user_id: string;
  created_at: string;
  users: {
    full_name: string;
  };
}

interface BookReviewsProps {
  bookId: string;
  bookTitle: string;
}

export default function BookReviews({ bookId, bookTitle }: BookReviewsProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    loadReviews();
  }, [bookId]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const data = await apiCall(`/api/books/${bookId}/reviews`);
      setReviews(data.reviews || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת ביקורות');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm('האם למחוק את הביקורת?')) return;

    try {
      await apiCall(`/api/reviews/${reviewId}`, {
        method: 'DELETE',
      });
      await loadReviews();
    } catch (err: any) {
      alert(err.message || 'שגיאה במחיקת הביקורת');
    }
  };

  const getSortedReviews = () => {
    const sorted = [...reviews];
    switch (sortBy) {
      case 'highest':
        return sorted.sort((a, b) => b.rating - a.rating);
      case 'lowest':
        return sorted.sort((a, b) => a.rating - b.rating);
      case 'newest':
      default:
        return sorted.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  };

  const getAverageRating = () => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / reviews.length;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffInDays === 0) return 'היום';
    if (diffInDays === 1) return 'אתמול';
    if (diffInDays < 7) return `לפני ${diffInDays} ימים`;
    if (diffInDays < 30) return `לפני ${Math.floor(diffInDays / 7)} שבועות`;
    return date.toLocaleDateString('he-IL');
  };

  const userHasReviewed = reviews.some((review) => review.user_id === user?.id);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h6" gutterBottom>
            ביקורות
          </Typography>
          {reviews.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Rating
                value={getAverageRating()}
                readOnly
                precision={0.1}
                sx={{ direction: 'ltr' }}
              />
              <Typography variant="body2" color="text.secondary">
                {getAverageRating().toFixed(1)} ({reviews.length} ביקורות)
              </Typography>
            </Box>
          )}
        </Box>

        {!userHasReviewed && (
          <Button
            variant="contained"
            onClick={() => setShowAddDialog(true)}
            size="small"
          >
            הוסף ביקורת
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {reviews.length > 0 && (
        <FormControl size="small" sx={{ mb: 2, minWidth: 150 }}>
          <InputLabel>מיון לפי</InputLabel>
          <Select
            value={sortBy}
            label="מיון לפי"
            onChange={(e) => setSortBy(e.target.value)}
          >
            <MenuItem value="newest">חדשות ביותר</MenuItem>
            <MenuItem value="highest">דירוג גבוה</MenuItem>
            <MenuItem value="lowest">דירוג נמוך</MenuItem>
          </Select>
        </FormControl>
      )}

      {reviews.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          אין ביקורות עדיין. היה הראשון לכתוב ביקורת!
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {getSortedReviews().map((review) => (
            <Card key={review.id} variant="outlined">
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 1,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2">
                      {review.users?.full_name || 'משתמש'}
                    </Typography>
                    <Rating
                      value={review.rating}
                      readOnly
                      size="small"
                      sx={{ direction: 'ltr' }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(review.created_at)}
                    </Typography>
                  </Box>

                  {review.user_id === user?.id && (
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(review.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </Box>

                <Typography variant="body2" sx={{ mt: 1 }}>
                  {review.review_text}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <AddReviewDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        bookId={bookId}
        bookTitle={bookTitle}
        userId={user?.id || ''}
        onReviewAdded={loadReviews}
      />
    </Box>
  );
}
