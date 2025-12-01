import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  CircularProgress,
  Box,
  Typography
} from '@mui/material';

interface CreateLoanDialogProps {
  open: boolean;
  onClose: () => void;
  book: {
    id: string;
    title: string;
    author: string;
  };
  userFamilyId: string;
  userId: string;
  onSuccess: (loan?: any) => void;
}

interface Family {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
}

export default function CreateLoanDialog({
  open,
  onClose,
  book,
  userFamilyId,
  userId,
  onSuccess
}: CreateLoanDialogProps) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      fetchFamilies();
    }
  }, [open]);

  const fetchFamilies = async () => {
    try {
      const response = await fetch('/api/families');
      const data = await response.json();
      
      if (response.ok) {
        // Filter out the current user's family
        const otherFamilies = data.families.filter(
          (f: Family) => f.id !== userFamilyId
        );
        setFamilies(otherFamilies);
      } else {
        setError('שגיאה בטעינת רשימת המשפחות');
      }
    } catch (err) {
      console.error('Error fetching families:', err);
      setError('שגיאה בטעינת רשימת המשפחות');
    }
  };

  const handleSubmit = async () => {
    if (!selectedFamilyId) {
      setError('יש לבחור משפחה');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/loans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          family_book_id: book.id,
          borrower_family_id: selectedFamilyId,
          owner_family_id: userFamilyId,
          requester_user_id: userId,
          notes: notes || null
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onSuccess(data.loan);
        handleClose();
      } else {
        let errorMessage = 'שגיאה ביצירת ההשאלה';
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // Failed to parse error response as JSON
        }
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Error creating loan:', err);
      setError('שגיאה ביצירת ההשאלה');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFamilyId('');
    setNotes('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>השאל ספר</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            ספר: {book.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            מחבר: {book.author}
          </Typography>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>משפחה שואלת</InputLabel>
            <Select
              value={selectedFamilyId}
              onChange={(e) => setSelectedFamilyId(e.target.value)}
              label="משפחה שואלת"
              disabled={loading}
            >
              <MenuItem value="">
                <em>בחר משפחה</em>
              </MenuItem>
              {families.map((family) => (
                <MenuItem key={family.id} value={family.id}>
                  {family.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="הערות (אופציונלי)"
            multiline
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
            placeholder="הערות על מצב הספר, תאריך החזרה מצופה וכו'"
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
          disabled={loading || !selectedFamilyId}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          השאל
        </Button>
      </DialogActions>
    </Dialog>
  );
}
