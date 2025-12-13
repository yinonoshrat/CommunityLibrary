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
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  InputAdornment,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Save as SaveIcon,
  Search as SearchIcon,
  CameraAlt as CameraIcon,
  CheckCircle as CheckIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiCall } from '../utils/apiCall';
import { searchBooks, type BookSearchResult } from '../utils/bookSearch';
import { useCreateBook } from '../hooks/useBookMutations';
import ImageUploadManager from '../components/ImageUploadManager';
import { DetectedBooksList, type DetectedBook } from '../components/DetectedBooksList';
import { JobImagePreview } from '../components/JobImagePreview';

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

const normalizeConfidence = (conf: any): 'high' | 'medium' | 'low' => {
  if (typeof conf === 'string') {
    const lower = conf.toLowerCase();
    if (lower === 'high' || lower === 'medium' || lower === 'low') {
      return lower;
    }
  }
  if (typeof conf === 'number') {
    // Handle 0-1 range
    if (conf <= 1) {
      if (conf >= 0.8) return 'high';
      if (conf >= 0.5) return 'medium';
      return 'low';
    }
    // Handle 0-100 range
    if (conf >= 80) return 'high';
    if (conf >= 50) return 'medium';
    return 'low';
  }
  return 'low';
};

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
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('bulk');
  
  // Bulk upload state
  const [detectedBooks, setDetectedBooks] = useState<DetectedBook[]>([]);
  const [initialJobs, setInitialJobs] = useState<any[]>([]);
  const [userBooks, setUserBooks] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [refreshingBooks, setRefreshingBooks] = useState<Set<string>>(new Set());
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Helper to check if book is already owned
  const checkIfOwned = (book: any, currentBooks: any[]) => {
    // Check by ISBN if available
    if (book.isbn && currentBooks.some(ub => ub.isbn === book.isbn)) {
      return true;
    }
    
    // Check by Title + Author (fuzzy match)
    const normalize = (str: string) => str?.toLowerCase().replace(/[^\w\u0590-\u05FF]/g, '') || '';
    const bookTitle = normalize(book.title);
    const bookAuthor = normalize(book.author);
    
    if (!bookTitle) return false;

    return currentBooks.some(ub => {
      const ubTitle = normalize(ub.title);
      const ubAuthor = normalize(ub.author);
      // Match title AND (author matches OR author is missing in one of them)
      return ubTitle === bookTitle && (ubAuthor === bookAuthor || !bookAuthor || !ubAuthor);
    });
  };

  // Fetch existing jobs when switching to bulk mode
  useEffect(() => {
    if (uploadMode === 'bulk') {
      const fetchData = async () => {
        setLoadingJobs(true);
        try {
          // 1. Fetch user's existing books for ownership check
          let currentUserBooks: any[] = [];
          try {
            const booksResponse = await apiCall<{ books: any[] }>('/api/books?view=my&limit=1000');
            if (booksResponse && booksResponse.books) {
              currentUserBooks = booksResponse.books;
              setUserBooks(currentUserBooks);
            }
          } catch (err) {
            console.error('Failed to fetch user books:', err);
          }

          // 2. Fetch detection jobs
          const jobs = await apiCall<any[]>('/api/books/detect-jobs');
          
          // Separate completed jobs from active ones
          const completedJobs = jobs.filter(job => job.status === 'completed');
          
          // Set ALL jobs for ImageUploadManager so user sees history
          setInitialJobs(jobs);
          
          // Auto-select the most recent completed job if none selected
          if (!selectedJobId && completedJobs.length > 0) {
            // Sort by created_at desc
            const sortedJobs = [...completedJobs].sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            setSelectedJobId(sortedJobs[0].id);
          }
          
          // Process completed jobs to extract books
          const allDetectedBooks: DetectedBook[] = [];
          completedJobs.forEach(job => {
            if (job.result && job.result.books) {
              job.result.books.forEach((book: any, index: number) => {
                const confidence = normalizeConfidence(book.confidence);
                const isOwned = checkIfOwned(book, currentUserBooks);
                
                allDetectedBooks.push({
                  ...book,
                  confidence,
                  confidenceScore: typeof book.confidence === 'number' ? book.confidence : book.confidenceScore,
                  source: 'ai',
                  jobId: job.id,
                  tempId: `temp-${job.id}-${index}-${Date.now()}`,
                  alreadyOwned: isOwned,
                  selected: confidence !== 'low' && !isOwned,
                });
              });
            }
          });
          
          if (allDetectedBooks.length > 0) {
             setDetectedBooks(allDetectedBooks);
          }
        } catch (err) {
          console.error('Failed to fetch data:', err);
        } finally {
          setLoadingJobs(false);
        }
      };
      
      fetchData();
    }
  }, [uploadMode]);
  
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
  const handleUploadComplete = (jobId: string, result: any) => {
    console.log('Upload complete:', jobId, result);
    
    if (result.result && result.result.books && result.result.books.length > 0) {
      // Normalize books first
      const normalizedBooks = result.result.books.map((book: any) => {
        const isOwned = checkIfOwned(book, userBooks);
        return {
          ...book,
          confidence: normalizeConfidence(book.confidence),
          confidenceScore: typeof book.confidence === 'number' ? book.confidence : book.confidenceScore,
          alreadyOwned: isOwned
        };
      });

      // Sort books: not owned first, then by confidence, owned books at the end
      const sortedBooks = normalizedBooks.sort((a: DetectedBook, b: DetectedBook) => {
        // Already owned books go to the end
        if (a.alreadyOwned && !b.alreadyOwned) return 1;
        if (!a.alreadyOwned && b.alreadyOwned) return -1;
        
        // Within same ownership status, sort by confidence
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        return (confidenceOrder[b.confidence || 'low'] || 0) - (confidenceOrder[a.confidence || 'low'] || 0);
      });

      const booksWithSelection = sortedBooks.map((book: DetectedBook, index: number) => ({
        ...book,
        // Auto-select high and medium confidence books that are NOT already owned
        selected: book.confidence !== 'low' && !book.alreadyOwned,
        tempId: `temp-${jobId}-${index}-${Date.now()}`,
        expanded: false,
        source: 'ai' as const,
        jobId: jobId,
      }));
      
      setDetectedBooks(prev => [...prev, ...booksWithSelection]);
      
      // Auto-select this new job
      setSelectedJobId(jobId);

      const highCount = booksWithSelection.filter((b: DetectedBook) => b.confidence === 'high' && !b.alreadyOwned).length;
      const mediumCount = booksWithSelection.filter((b: DetectedBook) => b.confidence === 'medium' && !b.alreadyOwned).length;
      const lowCount = booksWithSelection.filter((b: DetectedBook) => b.confidence === 'low' && !b.alreadyOwned).length;
      const ownedCount = booksWithSelection.filter((b: DetectedBook) => b.alreadyOwned).length;

      let message = `נוספו ${result.result.count} ספרים לרשימה! `;
      if (highCount || mediumCount || lowCount) {
        message += `${highCount} בדיוק גבוה, ${mediumCount} בדיוק בינוני, ${lowCount} בדיוק נמוך`;
      }
      if (ownedCount) {
        message += ownedCount > 0 ? `. ${ownedCount} כבר קיימים בספריה` : '';
      }

      setSuccessMessage(message);
      setSuccess(true);
    }
  };

  const handleUploadError = (jobId: string, errorMsg: string) => {
    console.error('Upload error:', jobId, errorMsg);
    setError(`שגיאה בזיהוי ספרים (משימה ${jobId}): ${errorMsg}`);
  };

  const handleJobDelete = async (jobId: string) => {
    try {
      // Call API to delete job
      await apiCall(`/api/books/detect-job/${jobId}`, { method: 'DELETE' });
      
      // Remove books associated with this job
      setDetectedBooks(prev => prev.filter(book => book.jobId !== jobId));
      
      // Remove job from initialJobs if present
      setInitialJobs(prev => prev.filter(job => job.id !== jobId));
      
      // Clear selection if this job was selected
      if (selectedJobId === jobId) {
        setSelectedJobId(null);
      }
      
      console.log(`Job ${jobId} deleted successfully`);
    } catch (err) {
      console.error('Failed to delete job:', err);
      // Even if API fails, we might want to remove from UI? 
      // Better to show error
      setError('שגיאה במחיקת המשימה');
    }
  };

  const handleClearAll = () => {
    if (selectedJobId) {
      setSelectedJobId(null);
    } else {
      setDetectedBooks([]);
    }
    setError(null);
    setSuccess(false);
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
    setDetectedBooks(prevBooks => prevBooks.map(book => {
      // If filtering is active, only affect books in the current job
      if (selectedJobId) {
        // Use String comparison to be safe against type mismatches
        if (String(book.jobId) !== String(selectedJobId)) {
          return book;
        }
      }
      
      // Don't select if already owned
      if (book.alreadyOwned) {
        return book;
      }

      return { 
        ...book, 
        selected: true 
      };
    }));
  };

  const handleDeselectAll = () => {
    setDetectedBooks(prevBooks => prevBooks.map(book => {
      if (selectedJobId) {
        if (String(book.jobId) !== String(selectedJobId)) {
          return book;
        }
      }
      return { ...book, selected: false };
    }));
  };

  const handleBulkAdd = async () => {
    const booksToConsider = selectedJobId 
      ? detectedBooks.filter(b => b.jobId === selectedJobId)
      : detectedBooks;

    const selectedBooks = booksToConsider.filter(book => book.selected);

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

      // Build comprehensive result summary
      const added = data.added || 0;
      const skipped = data.skipped || 0;
      const failed = data.failed || 0;

      // Prepare error details
      const errorDetails: { title: string; message: string }[] = [];
      
      // Add skipped books (not errors, just info)
      if (data.skippedBooks && data.skippedBooks.length > 0) {
        data.skippedBooks.forEach((item: any) => {
          errorDetails.push({
            title: `${item.title} (${item.author || 'לא ידוע'})`,
            message: item.message || 'הספר כבר קיים בספרייה'
          });
        });
      }

      // Add actual errors
      if (data.errors && data.errors.length > 0) {
        data.errors.forEach((item: any, index: number) => {
          errorDetails.push({
            title: item.book?.title || `ספר ${index + 1}`,
            message: item.error
          });
        });
      }

      setBulkErrors(errorDetails);

      // Build success message
      let resultMessage = '';
      if (added > 0) {
        resultMessage += `✓ נוספו ${added} ספרים בהצלחה`;
      }
      if (skipped > 0) {
        if (resultMessage) resultMessage += '\n';
        resultMessage += `⊘ ${skipped} ספרים דולגו (כבר קיימים)`;
      }
      if (failed > 0) {
        if (resultMessage) resultMessage += '\n';
        resultMessage += `✗ ${failed} ספרים נכשלו`;
      }

      // Determine success state
      if (added > 0 && failed === 0) {
        // Complete or partial success (with skips only)
        setSuccessMessage(resultMessage);
        setSuccess(true);
        
        // If we are in a specific job context, delete the job
        if (selectedJobId) {
          try {
            await apiCall(`/api/books/detect-job/${selectedJobId}`, { method: 'DELETE' });
            
            // Remove job from UI
            setInitialJobs(prev => prev.filter(job => job.id !== selectedJobId));
            setDetectedBooks(prev => prev.filter(book => book.jobId !== selectedJobId));
            setSelectedJobId(null);
            
          } catch (err) {
            console.error('Failed to delete job:', err);
          }
        } else if (skipped === 0) {
          // Perfect success - navigate away
          setDetectedBooks([]);
          setTimeout(() => {
            navigate('/books');
          }, 2000);
        }
        // If there were skips, stay on page to show details
      } else if (added === 0 && failed > 0) {
        // All failed
        setError(`נכשלו כל ${failed} הספרים. בדוק את השגיאות למטה.`);
      } else if (added > 0 && failed > 0) {
        // Mixed results
        setSuccessMessage(resultMessage);
        setSuccess(true);
        setError(`יש ${failed} שגיאות. בדוק את הפרטים למטה.`);
      } else {
        // No books processed
        setError('לא נוספו ספרים');
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

  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(prev => prev === jobId ? null : jobId);
  };

  const visibleBooks = selectedJobId 
    ? detectedBooks.filter(b => b.jobId === selectedJobId)
    : detectedBooks.filter(b => b.source === 'manual'); // Show manual books if no job selected

  const selectedJob = selectedJobId ? initialJobs.find(job => job.id === selectedJobId) : null;

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
              צלם או העלה תמונות של מדף הספרים שלך, ואנחנו נזהה את הספרים באמצעות בינה מלאכותית.
              ניתן להעלות מספר תמונות במקביל.
            </Typography>
          </Box>

          <Paper sx={{ p: 3, mb: 3 }}>
            <ImageUploadManager
              initialJobs={initialJobs}
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
              maxFileSize={10 * 1024 * 1024}
              acceptedFormats={['image/jpeg', 'image/png', 'image/webp', 'image/heic']}
              selectedJobId={selectedJobId}
              onJobSelect={handleJobSelect}
              onJobDelete={handleJobDelete}
              loading={loadingJobs}
            />
          </Paper>

          <JobImagePreview 
            visible={!!selectedJobId}
            imageUrl={selectedJob?.image_storage_url || selectedJob?.image?.url || (selectedJob?.image_data ? `data:${selectedJob.image_mime_type || 'image/jpeg'};base64,${selectedJob.image_data}` : undefined)}
            altText={selectedJob?.image_original_filename || 'Detection Image'}
          />

          <DetectedBooksList
            books={visibleBooks}
            onToggleBook={handleToggleBook}
            onEditBook={handleEditBook}
            onToggleExpanded={handleToggleExpanded}
            onRemoveBook={handleRemoveBook}
            onRefreshBook={handleRefreshBook}
            refreshingBooks={refreshingBooks}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onBulkAdd={handleBulkAdd}
            adding={adding}
            onCancel={handleClearAll}
            onAddManual={handleAddManualDetectedBook}
            bulkErrors={bulkErrors}
          />
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
            dir="auto"
            InputProps={{
              dir: 'auto',
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
                disabled={loading || success}
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
                disabled={loading || success}
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
                onChange={handleChange('isbn')}                disabled={loading || success}
                dir="auto"
                inputProps={{ dir: 'auto' }}
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
                dir="auto"
                inputProps={{ dir: 'auto' }}
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
                dir="auto"
                inputProps={{ dir: 'auto' }}
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

    </Container>
  );
}
