import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Box,
  Typography
} from '@mui/material';

interface Loan {
  id: string;
  family_books?: {
    book_catalog: {
      title?: string;
      title_hebrew?: string;
      author?: string;
    };
  };
  books?: {
    title?: string;
    title_hebrew?: string;
    author?: string;
  };
  borrower_family?: {
    name: string;
  };
}

interface ReturnBookDialogProps {
  open: boolean;
  onClose: () => void;
  loan: Loan;
  onSuccess: () => void;
}

export default function ReturnBookDialog({
  open,
  onClose,
  loan,
  onSuccess
}: ReturnBookDialogProps) {
  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get book info from either structure
  const bookInfo = loan.family_books?.book_catalog || loan.books;
  const bookTitle = bookInfo?.title_hebrew || bookInfo?.title || 'ספר';
  const bookAuthor = bookInfo?.author || '';
  const borrowerName = loan.borrower_family?.name || 'משפחה';

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/loans/${loan.id}/return`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actualReturnDate: returnDate,
          notes: notes || null
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
        handleClose();
      } else {
        setError(data.error || 'שגיאה בסימון ההחזרה');
      }
    } catch (err) {
      console.error('Error returning book:', err);
      setError('שגיאה בסימון ההחזרה');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReturnDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>סמן כהוחזר</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            ספר: {bookTitle}
          </Typography>
          {bookAuthor && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              מחבר: {bookAuthor}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            שאל: {borrowerName}
          </Typography>

          <TextField
            fullWidth
            label="תאריך החזרה"
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            disabled={loading}
            sx={{ mb: 3 }}
            InputLabelProps={{
              shrink: true,
            }}
            helperText="ברירת מחדל: היום"
          />

          <TextField
            fullWidth
            label="הערות (אופציונלי)"
            multiline
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
            placeholder="הערות על מצב הספר בעת החזרה"
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} disabled={loading}>
          ביטול
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          אשר החזרה
        </Button>
      </DialogActions>
    </Dialog>
  );
}
