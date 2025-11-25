import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Chip,
  Box,
  CardActionArea,
} from '@mui/material';
import {
  MenuBook as BookIcon,
  CheckCircle as AvailableIcon,
  Schedule as LoanedIcon,
  SwapHoriz as BorrowedIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface Book {
  id: string;
  title: string;
  author: string;
  series?: string;
  series_number?: number;
  genre?: string;
  age_level?: string;
  cover_image_url?: string;
  status: 'available' | 'on_loan' | 'borrowed';
  year_published?: number;
}

interface BookCardProps {
  book: Book;
  onRefresh?: () => void;
}

export default function BookCard({ book }: BookCardProps) {
  const navigate = useNavigate();

  const getStatusConfig = () => {
    switch (book.status) {
      case 'available':
        return {
          label: 'זמין',
          color: 'success' as const,
          icon: <AvailableIcon sx={{ fontSize: 16 }} />,
        };
      case 'on_loan':
        return {
          label: 'מושאל',
          color: 'warning' as const,
          icon: <LoanedIcon sx={{ fontSize: 16 }} />,
        };
      case 'borrowed':
        return {
          label: 'שאלנו',
          color: 'info' as const,
          icon: <BorrowedIcon sx={{ fontSize: 16 }} />,
        };
      default:
        return {
          label: 'לא ידוע',
          color: 'default' as const,
          icon: <BookIcon sx={{ fontSize: 16 }} />,
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
    >
      <CardActionArea onClick={() => navigate(`/books/${book.id}`)}>
        {book.cover_image_url ? (
          <CardMedia
            component="img"
            height="200"
            image={book.cover_image_url}
            alt={book.title}
            sx={{ objectFit: 'cover' }}
          />
        ) : (
          <Box
            sx={{
              height: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'grey.200',
            }}
          >
            <BookIcon sx={{ fontSize: 80, color: 'grey.400' }} />
          </Box>
        )}
        <CardContent>
          <Typography
            variant="h6"
            component="h2"
            gutterBottom
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              minHeight: '3em',
            }}
          >
            {book.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {book.author}
          </Typography>
          {book.series && (
            <Typography variant="caption" color="text.secondary" display="block">
              {book.series}{book.series_number ? ` #${book.series_number}` : ''}
            </Typography>
          )}
          {book.year_published && (
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              {book.year_published}
            </Typography>
          )}
          <Box display="flex" gap={1} flexWrap="wrap" mt={2}>
            <Chip
              label={statusConfig.label}
              color={statusConfig.color}
              size="small"
              icon={statusConfig.icon}
            />
            {book.genre && (
              <Chip label={book.genre} size="small" variant="outlined" />
            )}
            {book.age_level && (
              <Chip label={book.age_level} size="small" variant="outlined" />
            )}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
