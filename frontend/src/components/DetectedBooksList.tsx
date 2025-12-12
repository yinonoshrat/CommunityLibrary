import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Stack,
  Checkbox,
  TextField,
  Grid,
  MenuItem,
  IconButton,
  CircularProgress,
  Alert,
  AlertTitle,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';

export interface DetectedBook {
  title: string;
  author: string;
  publisher?: string;
  publish_year?: number;
  pages?: number;
  description?: string;
  cover_image_url?: string;
  isbn?: string;
  genre?: string;
  age_range?: string;
  language?: string;
  confidence?: 'high' | 'medium' | 'low';
  confidenceScore?: number;
  selected?: boolean;
  tempId?: string;
  expanded?: boolean;
  series?: string;
  series_number?: number;
  source?: 'ai' | 'manual';
  alreadyOwned?: boolean;
  jobId?: string;
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

interface DetectedBooksListProps {
  books: DetectedBook[];
  onToggleBook: (tempId: string) => void;
  onEditBook: (tempId: string, field: keyof DetectedBook, value: any) => void;
  onToggleExpanded: (tempId: string) => void;
  onRemoveBook: (tempId: string) => void;
  onRefreshBook: (tempId: string) => void;
  refreshingBooks: Set<string>;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkAdd: () => void;
  adding: boolean;
  onCancel: () => void;
  onAddManual: () => void;
  bulkErrors: { title: string; message: string }[];
}

export const DetectedBooksList: React.FC<DetectedBooksListProps> = ({
  books,
  onToggleBook,
  onEditBook,
  onToggleExpanded,
  onRemoveBook,
  onRefreshBook,
  refreshingBooks,
  onSelectAll,
  onDeselectAll,
  onBulkAdd,
  adding,
  onCancel,
  onAddManual,
  bulkErrors,
}) => {
  if (books.length === 0) return null;

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6">
            ספרים שזוהו ({books.filter(b => b.selected).length}/{books.length})
          </Typography>
          {books.some(b => b.alreadyOwned) && (
            <Typography variant="caption" color="text.secondary">
              {books.filter(b => b.alreadyOwned).length} ספרים כבר קיימים בספרייה (מוצגים בסוף הרשימה)
            </Typography>
          )}
        </Box>
        <Box>
          <Button size="small" onClick={onSelectAll} sx={{ mr: 1 }}>
            בחר הכל
          </Button>
          <Button size="small" onClick={onDeselectAll}>
            בטל הכל
          </Button>
        </Box>
      </Box>

      <Stack spacing={2} sx={{ mb: 3 }}>
        {books.map((book) => (
          <Paper
            key={book.tempId}
            variant="outlined"
            sx={{
              p: 2,
              opacity: book.alreadyOwned ? 0.6 : book.selected ? 1 : 0.5,
              border: book.selected ? 2 : 1,
              borderColor: book.selected ? 'primary.main' : 'divider',
              bgcolor: book.alreadyOwned 
                ? '#f5f5f5'
                : book.confidence === 'high' 
                  ? 'success.50' 
                  : book.confidence === 'medium' 
                    ? 'warning.50' 
                    : 'grey.50',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Checkbox
                checked={!!book.selected}
                onChange={() => onToggleBook(book.tempId!)}
                sx={{ mt: 0.5 }}
                disabled={book.alreadyOwned}
              />
              <Box sx={{ flexGrow: 1 }}>
                {/* Header with title, author, confidence badge, and owned status */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                  {book.alreadyOwned && (
                    <Box
                      sx={{
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        bgcolor: 'grey.600',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                      }}
                    >
                      כבר קיים
                    </Box>
                  )}
                  <Box
                    sx={{
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      bgcolor: book.confidence === 'high' ? 'success.main' : book.confidence === 'medium' ? 'warning.main' : 'grey.500',
                      color: 'white',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                    }}
                  >
                    {book.confidence === 'high' ? 'דיוק גבוה' : book.confidence === 'medium' ? 'דיוק בינוני' : 'דיוק נמוך'}
                  </Box>
                  {book.cover_image_url && (
                    <img
                      src={book.cover_image_url}
                      alt={book.title}
                      style={{ width: 30, height: 45, objectFit: 'cover', borderRadius: 4 }}
                    />
                  )}
                </Box>

                <TextField
                  fullWidth
                  value={book.title}
                  onChange={(e) => onEditBook(book.tempId!, 'title', e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{ mb: 1 }}
                  label="שם הספר"
                  dir="auto"
                  inputProps={{ dir: 'auto' }}
                />
                <TextField
                  fullWidth
                  value={book.author || ''}
                  onChange={(e) => onEditBook(book.tempId!, 'author', e.target.value)}
                  placeholder="מחבר (אופציונלי)"
                  variant="outlined"
                  size="small"
                  label="מחבר"
                  dir="auto"
                  inputProps={{ dir: 'auto' }}
                />

                {/* Expandable details section */}
                {book.expanded && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="סדרה"
                          value={book.series || ''}
                          onChange={(e) => onEditBook(book.tempId!, 'series', e.target.value)}
                          dir="auto"
                          inputProps={{ dir: 'auto' }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="מספר כרך"
                          value={book.series_number || ''}
                          onChange={(e) => onEditBook(book.tempId!, 'series_number', parseInt(e.target.value) || '')}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="ISBN"
                          value={book.isbn || ''}
                          onChange={(e) => onEditBook(book.tempId!, 'isbn', e.target.value)}
                          dir="auto"
                          inputProps={{ dir: 'auto' }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="שנת פרסום"
                          value={book.publish_year || ''}
                          onChange={(e) => onEditBook(book.tempId!, 'publish_year', parseInt(e.target.value) || '')}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="הוצאה לאור"
                          value={book.publisher || ''}
                          onChange={(e) => onEditBook(book.tempId!, 'publisher', e.target.value)}
                          dir="auto"
                          inputProps={{ dir: 'auto' }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="מספר עמודים"
                          value={book.pages || ''}
                          onChange={(e) => onEditBook(book.tempId!, 'pages', parseInt(e.target.value) || '')}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          size="small"
                          select
                          label="ז'אנר"
                          value={book.genre || ''}
                          onChange={(e) => onEditBook(book.tempId!, 'genre', e.target.value)}
                        >
                          {GENRES.map((genre) => (
                            <MenuItem key={genre} value={genre}>
                              {genre}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          size="small"
                          select
                          label="גיל מומלץ"
                          value={book.age_range || ''}
                          onChange={(e) => onEditBook(book.tempId!, 'age_range', e.target.value)}
                        >
                          {AGE_LEVELS.map((level) => (
                            <MenuItem key={level} value={level}>
                              {level}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="קישור לתמונת השער"
                          value={book.cover_image_url || ''}
                          onChange={(e) => onEditBook(book.tempId!, 'cover_image_url', e.target.value)}
                          dir="auto"
                          inputProps={{ dir: 'auto' }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          rows={3}
                          label="תקציר"
                          value={book.description || ''}
                          onChange={(e) => onEditBook(book.tempId!, 'description', e.target.value)}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Expand/Collapse button */}
                <Button
                  size="small"
                  onClick={() => onToggleExpanded(book.tempId!)}
                  sx={{ mt: 1 }}
                  startIcon={<EditIcon />}
                >
                  {book.expanded ? 'הסתר פרטים' : 'ערוך פרטים נוספים'}
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <IconButton
                  size="small"
                  onClick={() => onRefreshBook(book.tempId!)}
                  color="primary"
                  disabled={refreshingBooks.has(book.tempId!)}
                  title="עדכן נתונים מחיפוש מקוון"
                >
                  {refreshingBooks.has(book.tempId!) ? (
                    <CircularProgress size={20} />
                  ) : (
                    <RefreshIcon />
                  )}
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => onRemoveBook(book.tempId!)}
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            </Box>
          </Paper>
        ))}
      </Stack>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          fullWidth
          onClick={onBulkAdd}
          disabled={adding || books.filter(b => b.selected).length === 0}
          startIcon={adding ? <CircularProgress size={20} /> : <CheckIcon />}
          sx={{ py: 1.5 }}
        >
          {adding
            ? 'מוסיף...'
            : `הוסף ${books.filter(b => b.selected).length} ספרים`}
        </Button>
        <Button variant="outlined" onClick={onCancel} sx={{ py: 1.5 }}>
          נקה הכל
        </Button>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Button
          variant="text"
          startIcon={<AddIcon />}
          onClick={onAddManual}
        >
          הוסף ספר ידני לרשימה
        </Button>
      </Box>

      {bulkErrors.length > 0 && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          <AlertTitle>חלק מהספרים לא נוספו</AlertTitle>
          <Box component="ul" sx={{ pl: 3, mb: 0 }}>
            {bulkErrors.map((err, index) => (
              <Box component="li" key={`${err.title}-${index}`} sx={{ mb: 0.5 }}>
                <Typography variant="body2">
                  <strong>{err.title || `ספר ${index + 1}`}:</strong> {err.message}
                </Typography>
              </Box>
            ))}
          </Box>
        </Alert>
      )}
    </Paper>
  );
};
