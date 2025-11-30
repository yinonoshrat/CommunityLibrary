import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  IconButton,
  Chip
} from '@mui/material';
import { WhatsApp as WhatsAppIcon } from '@mui/icons-material';

interface Loan {
  id: string;
  status: string;
  request_date?: string;
  actual_return_date?: string;
  notes?: string;
  family_books?: {
    book_catalog: {
      title?: string;
      title_hebrew?: string;
      author?: string;
      author_hebrew?: string;
      cover_image_url?: string;
    };
  };
  books?: {
    title?: string;
    title_hebrew?: string;
    author?: string;
    author_hebrew?: string;
    cover_image_url?: string;
  };
  borrower_family?: {
    name: string;
    phone: string;
    whatsapp?: string;
  };
  owner_family?: {
    name: string;
    phone: string;
    whatsapp?: string;
  };
}

interface LoanCardProps {
  loan: Loan;
  type: 'lent' | 'borrowed' | 'history';
  onReturn?: (loan: Loan) => void;
}

export default function LoanCard({ loan, type, onReturn }: LoanCardProps) {
  // Get book info from either structure
  const bookInfo = loan.family_books?.book_catalog || loan.books;
  const bookTitle = bookInfo?.title_hebrew || bookInfo?.title || 'ספר';
  const bookAuthor = bookInfo?.author_hebrew || bookInfo?.author || '';
  const coverImage = bookInfo?.cover_image_url;

  // Get the other family (borrower for lent, owner for borrowed)
  const otherFamily = type === 'lent' || type === 'history' 
    ? loan.borrower_family 
    : loan.owner_family;

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL');
  };

  const handleWhatsApp = () => {
    if (!otherFamily) return;
    const phone = otherFamily.whatsapp || otherFamily.phone;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const internationalPhone = cleanPhone.startsWith('972') 
      ? cleanPhone 
      : `972${cleanPhone.replace(/^0/, '')}`;
    
    const message = encodeURIComponent(
      `שלום ${otherFamily.name}, לגבי הספר "${bookTitle}"`
    );
    window.open(`https://wa.me/${internationalPhone}?text=${message}`, '_blank');
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {/* Book Cover */}
          {coverImage ? (
            <Box
              component="img"
              src={coverImage}
              alt={bookTitle}
              sx={{
                width: 60,
                height: 90,
                objectFit: 'cover',
                borderRadius: 1
              }}
            />
          ) : (
            <Box
              sx={{
                width: 60,
                height: 90,
                backgroundColor: 'grey.200',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem'
              }}
            >
              📕
            </Box>
          )}

          {/* Loan Info */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom>
              {bookTitle}
            </Typography>
            {bookAuthor && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {bookAuthor}
              </Typography>
            )}

            {otherFamily && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {type === 'lent' || type === 'history' ? 'ל:' : 'מ:'} {otherFamily.name}
                </Typography>
                <IconButton
                  size="small"
                  onClick={handleWhatsApp}
                  sx={{ color: '#25D366' }}
                >
                  <WhatsAppIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Box>
            )}

            {loan.request_date && (
              <Typography variant="caption" color="text.secondary" display="block">
                תאריך השאלה: {formatDate(loan.request_date)}
              </Typography>
            )}

            {loan.actual_return_date && type === 'history' && (
              <Typography variant="caption" color="text.secondary" display="block">
                תאריך החזרה: {formatDate(loan.actual_return_date)}
              </Typography>
            )}

            {loan.notes && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                📝 {loan.notes}
              </Typography>
            )}

            {/* Action Button for Lent Books */}
            {type === 'lent' && onReturn && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => onReturn(loan)}
                sx={{ mt: 2 }}
              >
                ✓ סמן כהוחזר
              </Button>
            )}

            {/* Status Chip for History */}
            {type === 'history' && (
              <Chip
                label="הוחזר"
                size="small"
                color="success"
                sx={{ mt: 1 }}
              />
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
