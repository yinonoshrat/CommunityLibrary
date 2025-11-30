import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  WhatsApp as WhatsAppIcon,
} from '@mui/icons-material';
import { apiCall } from '../utils/apiCall';

interface Family {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
}

interface FamilyAvailability {
  familyBookId: string;
  family: Family;
  status: string;
  isAvailable: boolean;
  currentLoan: any | null;
}

interface FamilyAvailabilityProps {
  bookId: string;
}

export default function FamilyAvailability({ bookId }: FamilyAvailabilityProps) {
  const [families, setFamilies] = useState<FamilyAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFamilies();
  }, [bookId]);

  const fetchFamilies = async () => {
    try {
      const response = await apiCall<{ families: FamilyAvailability[] }>(
        `/api/books/${bookId}/families`
      );
      setFamilies(response.families || []);
    } catch (err: any) {
      console.error('Failed to fetch families:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleContactClick = (phone: string, isWhatsApp: boolean) => {
    if (isWhatsApp) {
      window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`, '_blank');
    } else {
      window.location.href = `tel:${phone}`;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (families.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        לא נמצאו משפחות עם ספר זה
      </Typography>
    );
  }

  const availableFamilies = families.filter((f) => f.isAvailable);
  const unavailableFamilies = families.filter((f) => !f.isAvailable);

  return (
    <Box>
      {availableFamilies.length > 0 && (
        <Box mb={2}>
          <Typography variant="subtitle2" gutterBottom>
            זמין אצל ({availableFamilies.length}):
          </Typography>
          <List dense>
            {availableFamilies.map((item) => (
              <ListItem
                key={item.familyBookId}
                secondaryAction={
                  <Box>
                    {item.family.whatsapp && (
                      <IconButton
                        edge="end"
                        onClick={() => handleContactClick(item.family.whatsapp, true)}
                        title="שלח הודעה בוואטסאפ"
                      }}>
                        <WhatsAppIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    )}
                    {item.family.phone && (
                      <IconButton
                        edge="end"
                        onClick={() => handleContactClick(item.family.phone, false)}
                        title="התקשר"
                      >
                        <PhoneIcon />
                      </IconButton>
                    )}
                  </Box>
                }
              >
                <ListItemText
                  primary={item.family.name}
                  secondary={
                    <Chip
                      label="זמין"
                      color="success"
                      size="small"
                      sx={{ mt: 0.5 }}
                    />
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {unavailableFamilies.length > 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            כרגע מושאל אצל ({unavailableFamilies.length}):
          </Typography>
          <List dense>
            {unavailableFamilies.map((item) => (
              <ListItem key={item.familyBookId}>
                <ListItemText
                  primary={item.family.name}
                  secondary={
                    <Chip
                      label="מושאל"
                      color="error"
                      size="small"
                      sx={{ mt: 0.5 }}
                    />
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}
