import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Rating,
  Box,
  Typography,
  Alert,
} from '@mui/material';
import { apiCall } from '../utils/apiCall';

interface AddReviewDialogProps {
  open: boolean;
  onClose: () => void;
  bookId: string;
  bookTitle: string;
  userId: string;
  onReviewAdded?: () => void;
}

export default function AddReviewDialog({
  open,
  onClose,
  bookId,
  bookTitle,
  userId,
  onReviewAdded,
}: AddReviewDialogProps) {
  const [rating, setRating] = useState<number | null>(5);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!rating) {
      setError('נא לבחור דירוג');
      return;
    }

    if (!reviewText.trim()) {
      setError('נא להזין טקסט ביקורת');
      return;
    }

    try {
      setLoading(true);
      setError('');

      await apiCall(`/api/books/${bookId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          rating,
          review_text: reviewText,
        }),
      });

      setReviewText('');
      setRating(5);
      onReviewAdded?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'שגיאה בשמירת הביקורת');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setReviewText('');
      setRating(5);
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>הוסף ביקורת</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            ספר: {bookTitle}
          </Typography>

          <Box sx={{ mt: 3, mb: 2 }}>
            <Typography component="legend" gutterBottom>
              דירוג:
            </Typography>
            <Rating
              value={rating}
              onChange={(_, newValue) => setRating(newValue)}
              size="large"
              sx={{ direction: 'ltr' }}
            />
          </Box>

          <TextField
            label="הביקורת שלך"
            multiline
            rows={4}
            fullWidth
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="שתף את דעתך על הספר..."
            sx={{ mt: 2 }}
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          ביטול
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
        >
          {loading ? 'שומר...' : 'שמור'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
