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
  AlertTitle,
  CircularProgress,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  InputAdornment,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  LinearProgress,
  Stack,
  IconButton,
  Checkbox,
  Dialog,
  DialogContent,
} from '@mui/material';
import {
  Save as SaveIcon,
  Search as SearchIcon,
  Add as AddIcon,
  CloudUpload as UploadIcon,
  CameraAlt as CameraIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  Edit as EditIcon,
  ZoomIn as ZoomInIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiCall } from '../utils/apiCall';
import { searchBooks, type BookSearchResult } from '../utils/bookSearch';
import { useCreateBook } from '../hooks/useBookMutations';

interface BookFormData {
  title: string;
  author: string;
  series: string;
  series_number: string;
  isbn: string;
  publish_year: string;
  publisher: string;
  genre: string;
  age_range: string;
  pages: string;
  description: string;
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

interface DetectedBook {
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
}

export default function AddBook() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('הספר נוסף בהצלחה! מעביר לדף הספרים...');
  const [familyId, setFamilyId] = useState<string | null>(null);
  
  // Create book mutation
  const createBookMutation = useCreateBook({
    onSuccess: (data) => {
      console.log('[AddBook] Book created successfully:', data);
      const wasMerged = (data as any)._merged;
      setSuccess(true);
      setLoading(false);
      
      if (wasMerged) {
        setSuccessMessage('הספר כבר קיים בקטלוג המשותף! נוסף לספריית המשפחה שלך.');
      } else {
        setSuccessMessage('הספר נוסף בהצלחה! מעביר לדף הספרים...');
      }
      
      setTimeout(() => {
        navigate('/books');
      }, 1500);
    },
    onError: (err: Error) => {
      console.error('[AddBook] Failed to add book:', err);
      setError(err.message || 'שגיאה בהוספת הספר');
      setLoading(false);
    }
  });
  
  // Toggle between single and bulk upload
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');
  
  // Bulk upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [detecting, setDetecting] = useState(false);
  const [detectedBooks, setDetectedBooks] = useState<DetectedBook[]>([]);
  const [adding, setAdding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [zoomDialogOpen, setZoomDialogOpen] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [refreshingBooks, setRefreshingBooks] = useState<Set<string>>(new Set());
  
  // Book search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [bulkErrors, setBulkErrors] = useState<{ title: string; message: string }[]>([]);

  const [formData, setFormData] = useState<BookFormData>({
    title: '',
    author: '',
    series: '',
    series_number: '',
    isbn: '',
    publish_year: '',
    publisher: '',
    genre: '',
    age_range: '',
    pages: '',
    description: '',
    cover_image_url: '',
  });

  const [errors, setErrors] = useState<Partial<BookFormData>>({});

  useEffect(() => {
    fetchUserFamily();
  }, [user]);

  const fetchUserFamily = async () => {
    if (!user?.id) return;

    try {
      const userResponse = await apiCall<{ user: any }>(`/api/users/${user.id}`);
      setFamilyId(userResponse.user?.family_id);
    } catch (err) {
      console.error('Failed to fetch user family:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    
    try {
      // Use the searchBooks utility with userId to check ownership
      const results = await searchBooks(searchQuery, {
        maxResults: 10,
        userId: user?.id,
      });
      
      if (results.length === 0) {
        setSearchError('לא נמצאו תוצאות. נסה חיפוש אחר או מלא את הפרטים ידנית.');
      } else {
        setSearchResults(results);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('שגיאה בחיפוש. נסה שוב או מלא את הפרטים ידנית.');
    } finally {
      setSearching(false);
    }
  };

  // Auto-search when user stops typing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      handleSearch();
    }, 800); // Wait 800ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectBook = (book: BookSearchResult) => {
    // Use genre from search result if available
    const genreToUse = book.genre || formData.genre;
    
    setFormData({
      ...formData,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      publish_year: book.publish_year ? book.publish_year.toString() : '',
      publisher: book.publisher,
      pages: book.pages ? book.pages.toString() : '',
      description: book.description,
      cover_image_url: book.cover_image_url,
      genre: genreToUse, // Use genre from search or keep current
      series: book.series || formData.series,
      series_number: typeof book.series_number === 'number' && Number.isFinite(book.series_number)
        ? String(book.series_number)
        : formData.series_number,
    });
    
    // Clear search results after selection
    setSearchResults([]);
    setSearchQuery('');
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

    if (!familyId) {
      setError('לא נמצאה משפחה משויכת');
      return;
    }

    setLoading(true);
    setError(null);

    const bookData = {
      title: formData.title?.trim() || '',
      author: formData.author?.trim() || '',
      series: formData.series?.trim() || null,
      series_number: formData.series_number ? parseInt(formData.series_number) : null,
      isbn: formData.isbn?.trim() || null,
      publish_year: formData.publish_year ? parseInt(formData.publish_year) : null,
      publisher: formData.publisher?.trim() || null,
      genre: formData.genre,
      age_range: formData.age_range || null,
      pages: formData.pages ? parseInt(formData.pages) : null,
      description: formData.description?.trim() || null,
      cover_image_url: formData.cover_image_url?.trim() || null,
      family_id: familyId,
      status: 'available',
    };

    createBookMutation.mutate(bookData as any);
  };

  // Bulk upload handlers
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('נא לבחור קובץ תמונה בלבד');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('גודל הקובץ חורג מ-10MB');
      return;
    }

    setSelectedImage(file);
    setError(null);
    setSuccess(false);
    setDetectedBooks([]);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    // Cancel any in-flight detection request
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    
    setSelectedImage(null);
    setImagePreview('');
    setDetectedBooks([]);
    setError(null);
    setSuccess(false);
    setDetecting(false);
    setProgress(0);
  };

  const handleDetectBooks = async () => {
    if (!selectedImage) return;

    let pollInterval: NodeJS.Timeout | null = null;

    try {
      setDetecting(true);
      setError(null);
      setProgress(10);
      setStatusMessage('מעלה תמונה...');

      const formData = new FormData();
      formData.append('image', selectedImage);

      // Start detection job (returns immediately with jobId)
      const data = await apiCall('/api/books/detect-from-image', {
        method: 'POST',
        body: formData,
      });

      const jobId = data.jobId;
      setProgress(20);
      setStatusMessage('מזהה ספרים עם בינה מלאכותית...');

      // Poll for job completion
      pollInterval = setInterval(async () => {
        try {
          const job = await apiCall(`/api/books/detect-job/${jobId}`, {
            method: 'GET',
          });

          setProgress(job.progress || 20);

          if (job.status === 'completed' && job.result) {
            if (pollInterval) clearInterval(pollInterval);
            setProgress(100);

            if (job.result.books && job.result.books.length > 0) {
              const booksWithSelection = job.result.books.map((book: DetectedBook, index: number) => ({
                ...book,
                selected: book.confidence !== 'low', // Auto-select high and medium confidence books
                tempId: `temp-${Date.now()}-${index}`,
                expanded: false,
                source: 'ai',
              }));
              setDetectedBooks(booksWithSelection);

              const highCount = booksWithSelection.filter((b: DetectedBook) => b.confidence === 'high').length;
              const mediumCount = booksWithSelection.filter((b: DetectedBook) => b.confidence === 'medium').length;
              const lowCount = booksWithSelection.filter((b: DetectedBook) => b.confidence === 'low').length;

              setSuccessMessage(
                `זוהו ${job.result.count} ספרים בתמונה! ` +
                `${highCount} בדיוק גבוה, ${mediumCount} בדיוק בינוני, ${lowCount} בדיוק נמוך`
              );
              setSuccess(true);
              setStatusMessage('');
            } else {
              setError('לא זוהו ספרים בתמונה. נסה תמונה אחרת או הוסף ספרים ידנית.');
              setStatusMessage('');
            }
            setDetecting(false);
          } else if (job.status === 'failed') {
            if (pollInterval) clearInterval(pollInterval);
            setError(job.error || 'שגיאה בזיהוי ספרים מהתמונה');
            setDetecting(false);
            setProgress(0);
            setStatusMessage('');
          } else {
            // Still processing - update status message
            if (job.progress < 50) {
              setStatusMessage('מזהה ספרים עם בינה מלאכותית...');
            } else if (job.progress < 90) {
              setStatusMessage('מחפש פרטים נוספים באינטרנט...');
            } else {
              setStatusMessage('כמעט סיימנו...');
            }
          }
        } catch (pollError: any) {
          console.error('Polling error:', pollError);
          if (pollInterval) clearInterval(pollInterval);
          setError('שגיאה בבדיקת סטטוס. נסה שוב.');
          setDetecting(false);
          setProgress(0);
          setStatusMessage('');
        }
      }, 2000); // Poll every 2 seconds

    } catch (err: any) {
      console.error('Detection error:', err);
      if (pollInterval) clearInterval(pollInterval);
      setError(err.message || 'שגיאה בזיהוי ספרים מהתמונה');
      setDetecting(false);
      setProgress(0);
      setStatusMessage('');
    }
  };

  const handleAddManualDetectedBook = () => {
    const tempId = `manual-${Date.now()}`;
    setDetectedBooks((prevBooks) => [
      ...prevBooks,
      {
        tempId,
        title: '',
        author: '',
        publisher: '',
        publish_year: undefined,
        pages: undefined,
        description: '',
        cover_image_url: '',
        isbn: '',
        genre: '',
        age_range: '',
        confidence: 'low',
        selected: true,
        expanded: true,
        series: '',
        series_number: undefined,
        source: 'manual',
      },
    ]);
    setSuccess(false);
    setError(null);
  };

  const handleToggleBook = (tempId: string) => {
    setDetectedBooks(prevBooks =>
      prevBooks.map(book =>
        book.tempId === tempId ? { ...book, selected: !book.selected } : book
      )
    );
  };

  const handleToggleExpanded = (tempId: string) => {
    setDetectedBooks(prevBooks =>
      prevBooks.map(book =>
        book.tempId === tempId ? { ...book, expanded: !book.expanded } : book
      )
    );
  };

  const handleEditBook = (tempId: string, field: keyof DetectedBook, value: any) => {
    setDetectedBooks(prevBooks =>
      prevBooks.map(book =>
        book.tempId === tempId ? { ...book, [field]: value } : book
      )
    );
  };

  const handleRemoveBook = (tempId: string) => {
    setDetectedBooks(prevBooks => prevBooks.filter(book => book.tempId !== tempId));
  };

  const handleRefreshBook = async (tempId: string) => {
    const book = detectedBooks.find(b => b.tempId === tempId);
    if (!book || !book.title) return;

    setRefreshingBooks(prev => new Set(prev).add(tempId));

    try {
      // Search for updated book details
      const results = await searchBooks(`${book.title} ${book.author || ''}`, {
        provider: 'auto',
        maxResults: 1,
        userId: user?.id,
      });

      if (results && results.length > 0) {
        const newData = results[0];
        
        // Merge new data with existing data, keeping user edits for empty fields
        setDetectedBooks(prev => prev.map(b => {
          if (b.tempId !== tempId) return b;
          
          return {
            ...b,
            // Only update fields that have new data
            author: newData.author || b.author,
            publisher: newData.publisher || b.publisher,
            publish_year: newData.publish_year || b.publish_year,
            pages: newData.pages || b.pages,
            description: newData.description || b.description,
            cover_image_url: newData.cover_image_url || b.cover_image_url,
            isbn: newData.isbn || b.isbn,
            genre: newData.genre || b.genre,
            age_range: b.age_range, // Keep existing age_range, not available from search
            series: newData.series || b.series,
            series_number: newData.series_number ?? b.series_number,
            // Update confidence if we got good results
            confidence: 'high' as const,
            confidenceScore: newData.confidence || 90,
          };
        }));
        
        setSuccessMessage(`נתונים עודכנו עבור "${book.title}"`);
        setSuccess(true);
      } else {
        setError(`לא נמצאו תוצאות עבור "${book.title}"`);
      }
    } catch (err: any) {
      console.error('Refresh book error:', err);
      setError(err.message || 'שגיאה בעדכון נתוני הספר');
    } finally {
      setRefreshingBooks(prev => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
    }
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

    const invalidBooks = selectedBooks.filter((book) => !book.title || !book.title.trim());
    if (invalidBooks.length > 0) {
      setError('כל ספר חייב לכלול שם לפני ההוספה');
      return;
    }

    try {
      setAdding(true);
      setError(null);
      setSuccess(false);
      setBulkErrors([]);

      // Check if user is authenticated
      if (!user || !user.id) {
        setError('אנא התחבר כדי להוסיף ספרים');
        setAdding(false);
        return;
      }

      const data = await apiCall('/api/books/bulk-add', {
        method: 'POST',
        body: JSON.stringify({ books: selectedBooks }),
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
      });

      if (data.errors && data.errors.length > 0) {
        setBulkErrors(
          data.errors.map((item: any, index: number) => ({
            title: item.book?.title || `ספר ${index + 1}`,
            message: item.error,
          }))
        );
      }

      // Only navigate if completely successful with no errors
      const hasErrors = data.errors && data.errors.length > 0;
      const hasSuccess = data.added > 0;

      if (hasSuccess && !hasErrors) {
        // Complete success - navigate away
        setSuccessMessage(`נוספו בהצלחה ${data.added} ספרים לקטלוג!`);
        setSuccess(true);
        setDetectedBooks([]);
        setSelectedImage(null);
        setTimeout(() => {
          navigate('/books');
        }, 2000);
      } else if (hasSuccess && hasErrors) {
        // Partial success - show message but stay on page
        setSuccessMessage(`נוספו ${data.added} ספרים, אך היו ${data.errors.length} שגיאות. תקן והוסף שוב.`);
        setSuccess(true);
      } else {
        // No success - show error
        const firstError = data.errors?.[0]?.error;
        setError(firstError ? firstError : 'לא נוספו ספרים. בדוק את השגיאות.');
      }
    } catch (err: any) {
      console.error('Bulk add error:', err);
      const friendly = err.message || err?.toString();
      setBulkErrors([{ title: 'בקשת ההוספה נכשלה', message: friendly }]);
      setError(friendly);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          הוסף ספר חדש
        </Typography>
        <Typography variant="body1" color="text.secondary">
          בחר את שיטת ההוספה המועדפת עליך
        </Typography>
      </Box>

      {/* Upload Mode Toggle */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
        <ToggleButtonGroup
          value={uploadMode}
          exclusive
          onChange={(_, newMode) => {
            if (newMode !== null) {
              setUploadMode(newMode);
              setError(null);
              setSuccess(false);
              setBulkErrors([]);
            }
          }}
          aria-label="upload mode"
        >
          <ToggleButton value="single" aria-label="single book">
            <EditIcon sx={{ mr: 1 }} />
            ספר בודד
          </ToggleButton>
          <ToggleButton value="bulk" aria-label="bulk upload">
            <CameraIcon sx={{ mr: 1 }} />
            הוספה מרובה (AI)
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMessage}
        </Alert>
      )}

      {/* Bulk Upload Mode */}
      {uploadMode === 'bulk' && (
        <>
          <Box mb={2}>
            <Typography variant="body2" color="text.secondary">
              צלם או העלה תמונה של מדף הספרים שלך, ואנחנו נזהה את הספרים באמצעות בינה מלאכותית
            </Typography>
          </Box>

          {/* Image Upload Section */}
          {!selectedImage && (
            <Paper sx={{ p: 4, textAlign: 'center', mb: 3 }}>
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
          {selectedImage && (
            <Paper sx={{ p: 3, mb: 3 }}>
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
                  sx={{ 
                    position: 'absolute', 
                    top: 8, 
                    right: 8, 
                    bgcolor: 'error.light',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'error.main',
                    }
                  }}
                  onClick={handleRemoveImage}
                  title="בטל הוספה"
                >
                  <CloseIcon />
                </IconButton>
                <IconButton
                  sx={{ position: 'absolute', top: 8, left: 8, bgcolor: 'background.paper' }}
                  onClick={() => setZoomDialogOpen(true)}
                >
                  <ZoomInIcon />
                </IconButton>
              </Box>

              {detecting && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {statusMessage || 'מזהה ספרים...'}
                  </Typography>
                  <LinearProgress variant="determinate" value={progress} />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {progress}% הושלם
                  </Typography>
                </Box>
              )}

              {!detectedBooks.length && (
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
              )}
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
                      bgcolor: book.confidence === 'high' ? 'success.50' : book.confidence === 'medium' ? 'warning.50' : 'grey.50',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Checkbox
                        checked={book.selected}
                        onChange={() => handleToggleBook(book.tempId!)}
                        sx={{ mt: 0.5 }}
                      />
                      <Box sx={{ flexGrow: 1 }}>
                        {/* Header with title, author, and confidence badge */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
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
                          onChange={(e) => handleEditBook(book.tempId!, 'title', e.target.value)}
                          variant="outlined"
                          size="small"
                          sx={{ mb: 1 }}
                          label="שם הספר"
                        />
                        <TextField
                          fullWidth
                          value={book.author || ''}
                          onChange={(e) => handleEditBook(book.tempId!, 'author', e.target.value)}
                          placeholder="מחבר (אופציונלי)"
                          variant="outlined"
                          size="small"
                          label="מחבר"
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
                                  onChange={(e) => handleEditBook(book.tempId!, 'series', e.target.value)}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="number"
                                  label="מספר כרך"
                                  value={book.series_number || ''}
                                  onChange={(e) => handleEditBook(book.tempId!, 'series_number', parseInt(e.target.value) || '')}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="ISBN"
                                  value={book.isbn || ''}
                                  onChange={(e) => handleEditBook(book.tempId!, 'isbn', e.target.value)}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="number"
                                  label="שנת פרסום"
                                  value={book.publish_year || ''}
                                  onChange={(e) => handleEditBook(book.tempId!, 'publish_year', parseInt(e.target.value) || '')}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="הוצאה לאור"
                                  value={book.publisher || ''}
                                  onChange={(e) => handleEditBook(book.tempId!, 'publisher', e.target.value)}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  type="number"
                                  label="מספר עמודים"
                                  value={book.pages || ''}
                                  onChange={(e) => handleEditBook(book.tempId!, 'pages', parseInt(e.target.value) || '')}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  select
                                  label="ז'אנר"
                                  value={book.genre || ''}
                                  onChange={(e) => handleEditBook(book.tempId!, 'genre', e.target.value)}
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
                                  onChange={(e) => handleEditBook(book.tempId!, 'age_range', e.target.value)}
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
                                  onChange={(e) => handleEditBook(book.tempId!, 'cover_image_url', e.target.value)}
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
                                  onChange={(e) => handleEditBook(book.tempId!, 'description', e.target.value)}
                                />
                              </Grid>
                            </Grid>
                          </Box>
                        )}

                        {/* Expand/Collapse button */}
                        <Button
                          size="small"
                          onClick={() => handleToggleExpanded(book.tempId!)}
                          sx={{ mt: 1 }}
                          startIcon={<EditIcon />}
                        >
                          {book.expanded ? 'הסתר פרטים' : 'ערוך פרטים נוספים'}
                        </Button>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleRefreshBook(book.tempId!)}
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
                          onClick={() => handleRemoveBook(book.tempId!)}
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

              <Box sx={{ mt: 3 }}>
                <Button
                  variant="text"
                  startIcon={<AddIcon />}
                  onClick={handleAddManualDetectedBook}
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
          )}
        </>
      )}

      {/* Single Book Mode */}
      {uploadMode === 'single' && (
        <>
          {/* Book Search Section */}
          <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          חפש ספר במאגרים
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          חפש ספר ומלא את הפרטים אוטומטית
        </Typography>
        
        <Box display="flex" gap={2}>
          <TextField
            fullWidth
            placeholder="חפש לפי שם ספר, מחבר או ISBN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={searching || success}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searching ? (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              ) : null,
            }}
          />
        </Box>

        {searchError && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {searchError}
          </Alert>
        )}

        {searchResults.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              תוצאות חיפוש ({searchResults.length}):
            </Typography>
            <Grid container spacing={2}>
              {searchResults.map((book, index) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                  <Card sx={{ position: 'relative', opacity: book.alreadyOwned ? 0.6 : 1 }}>
                    {book.alreadyOwned && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          zIndex: 1,
                          bgcolor: 'info.main',
                          color: 'white',
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                        }}
                      >
                        <CheckIcon sx={{ fontSize: 16 }} />
                        כבר בספריה
                      </Box>
                    )}
                    {book.source === 'catalog' && !book.alreadyOwned && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          zIndex: 1,
                          bgcolor: 'success.main',
                          color: 'white',
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        בקטלוג
                      </Box>
                    )}
                    <CardActionArea 
                      onClick={() => handleSelectBook(book)}
                      disabled={book.alreadyOwned}
                    >
                      {book.cover_image_url && (
                        <CardMedia
                          component="img"
                          height="200"
                          image={book.cover_image_url}
                          alt={book.title}
                          sx={{ objectFit: 'contain', bgcolor: 'grey.100' }}
                        />
                      )}
                      <CardContent>
                        <Typography variant="subtitle2" noWrap>
                          {book.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {book.author}
                        </Typography>
                        {book.publish_year && book.publish_year > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            {book.publish_year}
                          </Typography>
                        )}
                        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                          מקור: {book.source === 'catalog' ? 'קטלוג משותף' : book.source}
                        </Typography>
                        {book.alreadyOwned && (
                          <Typography variant="caption" display="block" color="info.main" fontWeight={600}>
                            הספר כבר נמצא בספריה שלך
                          </Typography>
                        )}
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Paper>

      <Divider sx={{ my: 3 }}>
        <Typography variant="body2" color="text.secondary">
          או מלא פרטים ידנית
        </Typography>
      </Divider>

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
                disabled={loading || success}
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
                disabled={loading || success}
              />
            </Grid>

            {/* Series */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="סדרה"
                value={formData.series}
                onChange={handleChange('series')}
                disabled={loading || success}
                placeholder="למשל: הארי פוטר"
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
                disabled={loading || success}
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
                disabled={loading || success}
              />
            </Grid>

            {/* Year Published */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="שנת פרסום"
                type="number"
                value={formData.publish_year}
                onChange={handleChange('publish_year')}
                disabled={loading || success}
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
                disabled={loading || success}
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
                disabled={loading || success}
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
                disabled={loading || success}
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
                value={formData.age_range}
                onChange={handleChange('age_range')}
                disabled={loading || success}
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
                disabled={loading || success}
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
                value={formData.description}
                onChange={handleChange('description')}
                disabled={loading || success}
                placeholder="תקציר קצר של הספר..."
              />
            </Grid>

            {/* Action Buttons */}
            <Grid size={{ xs: 12 }}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => navigate('/books')}
                  disabled={loading || success}
                >
                  ביטול
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                  disabled={loading || success}
                  sx={{ minWidth: 120 }}
                >
                  {loading ? 'שומר...' : 'שמור ספר'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>
        </>
      )}

      {/* Zoom Dialog */}
      <Dialog
        open={zoomDialogOpen}
        onClose={() => setZoomDialogOpen(false)}
        maxWidth={false}
        PaperProps={{
          sx: {
            maxWidth: '95vw',
            maxHeight: '95vh',
            m: 0,
          }
        }}
      >
        <DialogContent sx={{ 
          p: 0, 
          position: 'relative', 
          overflow: 'auto',
          cursor: 'move',
          '&::-webkit-scrollbar': {
            width: '12px',
            height: '12px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#888',
            borderRadius: '6px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#555',
          },
        }}>
          <IconButton
            sx={{
              position: 'sticky',
              top: 8,
              right: 8,
              float: 'right',
              bgcolor: 'background.paper',
              zIndex: 1,
              boxShadow: 2,
            }}
            onClick={() => setZoomDialogOpen(false)}
          >
            <CloseIcon />
          </IconButton>
          <img
            src={imagePreview}
            alt="Zoomed"
            draggable={false}
            style={{
              width: '200%',
              height: 'auto',
              display: 'block',
              cursor: 'grab',
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              const img = e.currentTarget;
              const container = img.parentElement;
              if (!container) return;
              
              img.style.cursor = 'grabbing';
              const startX = e.clientX;
              const startY = e.clientY;
              const scrollLeft = container.scrollLeft;
              const scrollTop = container.scrollTop;
              
              const handleMouseMove = (moveEvent: MouseEvent) => {
                const dx = startX - moveEvent.clientX;
                const dy = startY - moveEvent.clientY;
                container.scrollLeft = scrollLeft + dx;
                container.scrollTop = scrollTop + dy;
              };
              
              const handleMouseUp = () => {
                img.style.cursor = 'grab';
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
              };
              
              window.addEventListener('mousemove', handleMouseMove);
              window.addEventListener('mouseup', handleMouseUp);
            }}
          />
        </DialogContent>
      </Dialog>
    </Container>
  );
}
