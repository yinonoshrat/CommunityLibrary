import { useState, useMemo } from 'react';
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
import { useFamilies } from '../hooks/useFamilies';
import { useCreateLoan } from '../hooks/useLoanMutations';

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

export default function CreateLoanDialog({
  open,
  onClose,
  book,
  userFamilyId,
  userId,
  onSuccess
}: CreateLoanDialogProps) {
  const [selectedFamilyId, setSelectedFamilyId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Use cached families data with stale-while-revalidate
  const { data: familiesData, isLoading: loadingFamilies } = useFamilies();
  
  // Filter out current user's family
  const families = useMemo(() => {
    if (!familiesData) return [];
    return familiesData.filter((f) => String(f.family_id) !== userFamilyId);
  }, [familiesData, userFamilyId]);

  // Use mutation hook for creating loan
  const createLoan = useCreateLoan({
    onSuccess: (data) => {
      onSuccess(data);
      handleClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'שגיאה ביצירת ההשאלה');
    },
  });

  const handleSubmit = async () => {
    if (!selectedFamilyId) {
      setError('יש לבחור משפחה');
      return;
    }

    setError('');
    createLoan.mutate({
      family_book_id: book.id,
      borrower_family_id: selectedFamilyId,
      owner_family_id: userFamilyId,
      requester_user_id: userId,
      notes: notes || null,
    });
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
              disabled={createLoan.isPending || loadingFamilies}
            >
              <MenuItem value="">
                <em>בחר משפחה</em>
              </MenuItem>
              {families.map((family) => (
                <MenuItem key={family.family_id} value={String(family.family_id)}>
                  {family.family_name}
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
            disabled={createLoan.isPending}
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
        <Button onClick={handleClose} disabled={createLoan.isPending}>
          ביטול
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={createLoan.isPending || !selectedFamilyId}
          startIcon={createLoan.isPending ? <CircularProgress size={20} /> : null}
        >
          השאל
        </Button>
      </DialogActions>
    </Dialog>
  );
}
