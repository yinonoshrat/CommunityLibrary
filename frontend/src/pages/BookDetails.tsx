import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as AvailableIcon,
  Schedule as LoanedIcon,
  SwapHoriz as BorrowedIcon,
  MenuBook as BookIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBook } from '../hooks/useBooks';
import { useUser } from '../hooks/useUser';
import { useLoansByBook } from '../hooks/useLoans';
import { apiCall } from '../utils/apiCall';
import CreateLoanDialog from '../components/CreateLoanDialog';
import ReturnBookDialog from '../components/ReturnBookDialog';
import BookReviews from '../components/BookReviews';
import LikeButton from '../components/LikeButton';

export default function BookDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Reactive hooks - automatic caching and refetching
  const { data: userData } = useUser(user?.id);
  const { data: bookResponse, isLoading: loading, error: bookError } = useBook(id ? parseInt(id) : null, user?.id);
  const { data: activeLoansResponse } = useLoansByBook(id ? String(id) : undefined, 'active');
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);

  const book = bookResponse?.book;
  const userFamilyId = userData?.user?.family_id;
  const activeLoans = activeLoansResponse?.loans || [];
  const activeLoan = activeLoans.length > 0 ? activeLoans[0] : null;
  const error = bookError ? (bookError as Error).message : null;

  const handleDelete = async () => {
    if (!book) return;

    setDeleting(true);
    try {
      await apiCall(`/api/books/${book.id}`, {
        method: 'DELETE',
      });
      navigate('/books');
    } catch (err: any) {
      console.error('Failed to delete book:', err);
      // Could add error toast notification here
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleLoanSuccess = () => {
    // TanStack Query will auto-invalidate and refetch book/loan data
  };

  const handleReturnSuccess = () => {
    // TanStack Query will auto-invalidate and refetch book/loan data
  };

  const getStatusConfig = () => {
    if (!book) return null;

    switch (book.status) {
      case 'available':
        return {
          label: 'זמין',
          color: 'success' as const,
          icon: <AvailableIcon />,
        };
      case 'on_loan':
        return {
          label: 'מושאל',
          color: 'warning' as const,
          icon: <LoanedIcon />,
        };
      case 'borrowed':
        return {
          label: 'שאלנו',
          color: 'info' as const,
          icon: <BorrowedIcon />,
        };
      default:
        return {
          label: 'לא ידוע',
          color: 'default' as const,
          icon: <BookIcon />,
        };
    }
  };

  const isOwner = book && userFamilyId && book.family_id === userFamilyId;
  const statusConfig = getStatusConfig();

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !book) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">{error || 'ספר לא נמצא'}</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          חזרה לספרים
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mb: 3 }}>
        חזרה לספרים
      </Button>

      <Paper sx={{ p: 4 }}>
        <Grid container spacing={4}>
          {/* Book Cover */}
          <Grid size={{ xs: 12, md: 4 }}>
            {book.cover_image_url ? (
              <Box
                component="img"
                src={book.cover_image_url}
                alt={book.title}
                sx={{
                  width: '100%',
                  maxHeight: 400,
                  objectFit: 'cover',
                  borderRadius: 1,
                }}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'grey.200',
                  borderRadius: 1,
                }}
              >
                <BookIcon sx={{ fontSize: 120, color: 'grey.400' }} />
              </Box>
            )}
          </Grid>

          {/* Book Details */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              {book.title}
            </Typography>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {book.author}
            </Typography>

            {statusConfig && (
              <Box mb={3}>
                <Chip
                  label={statusConfig.label}
                  color={statusConfig.color}
                  icon={statusConfig.icon}
                  sx={{ fontSize: '1rem', py: 2.5, px: 1 }}
                />
              </Box>
            )}

            <Grid container spacing={2} mb={3}>
              {book.series && (
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    סדרה
                  </Typography>
                  <Typography variant="body1">
                    {book.series}{book.series_number ? ` #${book.series_number}` : ''}
                  </Typography>
                </Grid>
              )}
              {book.genre && (
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    ז'אנר
                  </Typography>
                  <Typography variant="body1">{book.genre}</Typography>
                </Grid>
              )}
              {book.age_range && (
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    גיל מומלץ
                  </Typography>
                  <Typography variant="body1">{book.age_range}</Typography>
                </Grid>
              )}
              {book.year_published && (
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    שנת פרסום
                  </Typography>
                  <Typography variant="body1">{book.year_published}</Typography>
                </Grid>
              )}
              {book.publisher && (
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    הוצאה לאור
                  </Typography>
                  <Typography variant="body1">{book.publisher}</Typography>
                </Grid>
              )}
              {book.pages && (
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    עמודים
                  </Typography>
                  <Typography variant="body1">{book.pages}</Typography>
                </Grid>
              )}
              {book.isbn && (
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    ISBN
                  </Typography>
                  <Typography variant="body1">{book.isbn}</Typography>
                </Grid>
              )}
            </Grid>

            {book.description && (
              <Box mb={3}>
                <Typography variant="h6" gutterBottom>
                  תקציר
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                  {book.description}
                </Typography>
              </Box>
            )}

            {/* Like Button */}
            <Box mb={3}>
              <LikeButton 
                bookId={book.id} 
                initialLiked={book.stats?.userLiked || false}
                initialCount={book.stats?.totalLikes || 0}
                size="medium" 
                showCount={true} 
              />
            </Box>

            {isOwner && (
              <Box display="flex" gap={2}>
                {book.status === 'available' && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => setLoanDialogOpen(true)}
                  >
                    השאל ספר
                  </Button>
                )}
                {book.status === 'on_loan' && activeLoan && (
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => setReturnDialogOpen(true)}
                  >
                    סמן כהוחזר
                  </Button>
                )}
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={() => navigate(`/books/${book.id}/edit`)}
                >
                  ערוך ספר
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  מחק ספר
                </Button>
              </Box>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Reviews Section */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <BookReviews bookId={book.id} bookTitle={book.title} />
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)}>
        <DialogTitle>אישור מחיקה</DialogTitle>
        <DialogContent>
          <DialogContentText>
            האם אתה בטוח שברצונך למחוק את הספר "{book.title}"? פעולה זו אינה ניתנת לביטול.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            ביטול
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleting ? 'מוחק...' : 'מחק'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Loan Dialog */}
      {userFamilyId && user?.id && (
        <CreateLoanDialog
          open={loanDialogOpen}
          onClose={() => setLoanDialogOpen(false)}
          book={book}
          userFamilyId={userFamilyId}
          userId={user.id}
          onSuccess={handleLoanSuccess}
        />
      )}

      {/* Return Book Dialog */}
      {activeLoan && (
        <ReturnBookDialog
          open={returnDialogOpen}
          onClose={() => setReturnDialogOpen(false)}
          loan={activeLoan}
          onSuccess={handleReturnSuccess}
        />
      )}         
    </Container>
  );
}
