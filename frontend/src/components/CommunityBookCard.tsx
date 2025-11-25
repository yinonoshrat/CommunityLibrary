import {
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  Typography,
  Box,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  WhatsApp as WhatsAppIcon,
} from '@mui/icons-material';

interface Family {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
}

interface Book {
  id: string;
  title: string;
  author: string;
  series?: string;
  genre?: string;
  age_level?: string;
  cover_image_url?: string;
  year_published?: number;
  families: Family[];
  availableCount: number;
  totalCount: number;
}

interface CommunityBookCardProps {
  book: Book;
  onClick: () => void;
}

export default function CommunityBookCard({ book, onClick }: CommunityBookCardProps) {
  const handleContactClick = (e: React.MouseEvent, phone: string, isWhatsApp: boolean) => {
    e.stopPropagation();
    if (isWhatsApp) {
      window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`, '_blank');
    } else {
      window.location.href = `tel:${phone}`;
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea onClick={onClick}>
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
          <Typography variant="h6" gutterBottom noWrap title={book.title}>
            {book.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom noWrap>
            {book.author}
          </Typography>

          {book.series && (
            <Typography variant="caption" display="block" color="text.secondary" noWrap>
              {book.series}
            </Typography>
          )}

          <Box mt={2} mb={1}>
            {book.availableCount > 0 ? (
              <Chip
                label={`זמין אצל ${book.availableCount} ${book.availableCount === 1 ? 'משפחה' : 'משפחות'}`}
                color="success"
                size="small"
                sx={{ mr: 1 }}
              />
            ) : (
              <Chip
                label="כרגע מושאל"
                color="error"
                size="small"
                sx={{ mr: 1 }}
              />
            )}

            <Chip
              label={`סה"כ ${book.totalCount} ${book.totalCount === 1 ? 'עותק' : 'עותקים'}`}
              variant="outlined"
              size="small"
            />
          </Box>

          {book.genre && (
            <Typography variant="caption" display="block" color="text.secondary">
              {book.genre}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>

      {/* Contact buttons outside CardActionArea to avoid nested buttons */}
      {book.availableCount > 0 && book.families.length > 0 && (
        <CardContent sx={{ pt: 0 }}>
          <Typography variant="caption" display="block" color="text.secondary" mb={0.5}>
            זמין אצל:
          </Typography>
          {book.families.slice(0, 3).map((family) => (
            <Box key={family.id} display="flex" alignItems="center" gap={0.5} mb={0.5}>
              <Typography variant="caption" sx={{ flexGrow: 1 }}>
                • {family.name}
              </Typography>
              {family.whatsapp && (
                <IconButton
                  size="small"
                  onClick={(e) => handleContactClick(e, family.whatsapp, true)}
                  title="שלח הודעה בוואטסאפ"
                >
                  <WhatsAppIcon fontSize="small" />
                </IconButton>
              )}
              {family.phone && (
                <IconButton
                  size="small"
                  onClick={(e) => handleContactClick(e, family.phone, false)}
                  title="התקשר"
                >
                  <PhoneIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}
          {book.families.length > 3 && (
            <Typography variant="caption" color="text.secondary">
              + עוד {book.families.length - 3}
            </Typography>
          )}
        </CardContent>
      )}
    </Card>
  );
}
