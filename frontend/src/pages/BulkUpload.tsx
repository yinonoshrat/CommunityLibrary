import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Paper,
  Alert,
  CircularProgress,
  LinearProgress,
  Stack,
  IconButton,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CameraAlt as CameraIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../utils/apiCall';
import { useAuth } from '../contexts/AuthContext';

interface DetectedBook {
  title: string;
  author: string;
  selected?: boolean;
  tempId?: string;
}

export default function BulkUpload() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [detecting, setDetecting] = useState(false);
  const [detectedBooks, setDetectedBooks] = useState<DetectedBook[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [progress, setProgress] = useState(0);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('נא לבחור קובץ תמונה בלבד');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('גודל הקובץ חורג מ-10MB');
      return;
    }

    setSelectedImage(file);
    setError('');
    setSuccess('');
    setDetectedBooks([]);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview('');
    setDetectedBooks([]);
    setError('');
    setSuccess('');
  };

  const handleDetectBooks = async () => {
    if (!selectedImage) return;

    try {
      setDetecting(true);
      setError('');
      setProgress(20);

      const formData = new FormData();
      formData.append('image', selectedImage);

      setProgress(40);

      const data = await apiCall('/api/books/detect-from-image', {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set Content-Type for FormData
      });

      setProgress(100);

      if (data.books && data.books.length > 0) {
        const booksWithSelection = data.books.map((book: DetectedBook, index: number) => ({
          ...book,
          selected: true,
          tempId: `temp-${Date.now()}-${index}`,
        }));
        setDetectedBooks(booksWithSelection);
        setSuccess(`זוהו ${data.count} ספרים בתמונה!`);
      } else {
        setError('לא זוהו ספרים בתמונה. נסה תמונה אחרת או הוסף ספרים ידנית.');
      }
    } catch (err: any) {
      console.error('Detection error:', err);
      setError(err.message || 'שגיאה בזיהוי ספרים מהתמונה');
    } finally {
      setDetecting(false);
      setProgress(0);
    }
  };

  const handleToggleBook = (tempId: string) => {
    setDetectedBooks(prevBooks =>
      prevBooks.map(book =>
        book.tempId === tempId ? { ...book, selected: !book.selected } : book
      )
    );
  };

  const handleEditBook = (tempId: string, field: 'title' | 'author', value: string) => {
    setDetectedBooks(prevBooks =>
      prevBooks.map(book =>
        book.tempId === tempId ? { ...book, [field]: value } : book
      )
    );
  };

  const handleRemoveBook = (tempId: string) => {
    setDetectedBooks(prevBooks => prevBooks.filter(book => book.tempId !== tempId));
  };

  const handleSelectAll = () => {
    setDetectedBooks(prevBooks => prevBooks.map(book => ({ ...book, selected: true })));
  };

  const handleDeselectAll = () => {
    setDetectedBooks(prevBooks => prevBooks.map(book => ({ ...book, selected: false })));
  };

  const handleBulkAdd = async () => {
    const selectedBooks = detectedBooks.filter(book => book.selected);

    if (selectedBooks.length === 0) {
      setError('נא לבחור לפחות ספר אחד להוספה');
      return;
    }

    try {
      setAdding(true);
      setError('');

      const data = await apiCall('/api/books/bulk-add', {
        method: 'POST',
        body: JSON.stringify({ books: selectedBooks }),
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
        },
      });

      if (data.added > 0) {
        setSuccess(`נוספו בהצלחה ${data.added} ספרים לקטלוג!`);
        setTimeout(() => {
          navigate('/books');
        }, 2000);
      } else {
        setError('לא נוספו ספרים. בדוק את השגיאות.');
      }

      if (data.errors && data.errors.length > 0) {
        console.error('Bulk add errors:', data.errors);
      }
    } catch (err: any) {
      console.error('Bulk add error:', err);
      setError(err.message || 'שגיאה בהוספת ספרים');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 4 } }}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          הוספת ספרים מתמונה
        </Typography>
        <Typography variant="body1" color="text.secondary">
          צלם או העלה תמונה של מדף הספרים שלך, ואנחנו נזהה את הספרים באמצעות בינה מלאכותית
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Image Upload Section */}
      {!selectedImage && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Stack spacing={2} alignItems="center">
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="upload-image"
              type="file"
              onChange={handleImageSelect}
            />
            <label htmlFor="upload-image">
              <Button
                variant="contained"
                component="span"
                startIcon={<UploadIcon />}
                size="large"
              >
                בחר תמונה
              </Button>
            </label>

            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="capture-image"
              type="file"
              capture="environment"
              onChange={handleImageSelect}
            />
            <label htmlFor="capture-image">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CameraIcon />}
                size="large"
              >
                צלם תמונה
              </Button>
            </label>

            <Typography variant="body2" color="text.secondary">
              גודל מקסימלי: 10MB
            </Typography>
          </Stack>
        </Paper>
      )}

      {/* Image Preview and Detection */}
      {selectedImage && !detectedBooks.length && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ position: 'relative', mb: 2 }}>
            <img
              src={imagePreview}
              alt="Preview"
              style={{
                width: '100%',
                maxHeight: '400px',
                objectFit: 'contain',
                borderRadius: '8px',
              }}
            />
            <IconButton
              sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'background.paper' }}
              onClick={handleRemoveImage}
            >
              <DeleteIcon />
            </IconButton>
          </Box>

          {detecting && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                מזהה ספרים...
              </Typography>
              <LinearProgress variant="determinate" value={progress} />
            </Box>
          )}

          <Button
            variant="contained"
            fullWidth
            onClick={handleDetectBooks}
            disabled={detecting}
            startIcon={detecting ? <CircularProgress size={20} /> : <CheckIcon />}
            sx={{ py: 1.5 }}
          >
            {detecting ? 'מזהה...' : 'זהה ספרים'}
          </Button>
        </Paper>
      )}

      {/* Detected Books List */}
      {detectedBooks.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              ספרים שזוהו ({detectedBooks.filter(b => b.selected).length}/{detectedBooks.length})
            </Typography>
            <Box>
              <Button size="small" onClick={handleSelectAll} sx={{ mr: 1 }}>
                בחר הכל
              </Button>
              <Button size="small" onClick={handleDeselectAll}>
                בטל הכל
              </Button>
            </Box>
          </Box>

          <Stack spacing={2} sx={{ mb: 3 }}>
            {detectedBooks.map((book) => (
              <Paper
                key={book.tempId}
                variant="outlined"
                sx={{
                  p: 2,
                  opacity: book.selected ? 1 : 0.5,
                  border: book.selected ? 2 : 1,
                  borderColor: book.selected ? 'primary.main' : 'divider',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <input
                    type="checkbox"
                    checked={book.selected}
                    onChange={() => handleToggleBook(book.tempId!)}
                    style={{ marginTop: '8px', cursor: 'pointer' }}
                  />
                  <Box sx={{ flexGrow: 1 }}>
                    <input
                      type="text"
                      value={book.title}
                      onChange={(e) => handleEditBook(book.tempId!, 'title', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        marginBottom: '8px',
                      }}
                    />
                    <input
                      type="text"
                      value={book.author}
                      onChange={(e) => handleEditBook(book.tempId!, 'author', e.target.value)}
                      placeholder="מחבר (אופציונלי)"
                      style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '14px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                      }}
                    />
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveBook(book.tempId!)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Paper>
            ))}
          </Stack>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              fullWidth
              onClick={handleBulkAdd}
              disabled={adding || detectedBooks.filter(b => b.selected).length === 0}
              startIcon={adding ? <CircularProgress size={20} /> : <CheckIcon />}
              sx={{ py: 1.5 }}
            >
              {adding
                ? 'מוסיף...'
                : `הוסף ${detectedBooks.filter(b => b.selected).length} ספרים`}
            </Button>
            <Button variant="outlined" onClick={handleRemoveImage} sx={{ py: 1.5 }}>
              ביטול
            </Button>
          </Box>
        </Paper>
      )}
    </Container>
  );
}
