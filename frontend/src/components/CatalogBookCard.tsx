import { useMemo } from 'react'
import {
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Chip,
  Button,
  IconButton,
  Divider,
  Stack,
} from '@mui/material'
import {
  Phone as PhoneIcon,
  WhatsApp as WhatsAppIcon,
  AssignmentReturned as ReturnIcon,
  Favorite as FavoriteIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import LikeButton from './LikeButton'
import type { CatalogBook, BookLoanSummary } from '../types'

interface CatalogBookCardProps {
  book: CatalogBook
  onMarkReturned?: (args: { book: CatalogBook; loan: BookLoanSummary }) => void
}

const FORMATTER = new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium' })

const formatDate = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return FORMATTER.format(date)
}

const getPrimaryFamilyBookId = (book: CatalogBook) => {
  if (book.viewerContext.ownedCopies.length > 0) {
    return book.viewerContext.ownedCopies[0].familyBookId
  }
  return book.owners[0]?.familyBookId
}

export default function CatalogBookCard({ book, onMarkReturned }: CatalogBookCardProps) {
  const navigate = useNavigate()
  const primaryFamilyBookId = useMemo(() => getPrimaryFamilyBookId(book), [book])
  const viewerLoan = book.viewerContext.borrowedLoan
  const viewerOwnedCopy = book.viewerContext.ownedCopies[0]

  const handleNavigate = () => {
    if (primaryFamilyBookId) {
      navigate(`/books/${primaryFamilyBookId}`)
    }
  }

  const handleMarkReturned = () => {
    if (!viewerOwnedCopy?.loan || !onMarkReturned) return
    onMarkReturned({ book, loan: viewerOwnedCopy.loan })
  }

  return (
    <Card data-testid="catalog-book-card" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CardActionArea onClick={handleNavigate}>
        {book.coverImageUrl && (
          <CardMedia 
            component="img" 
            height="140" 
            image={book.coverImageUrl} 
            alt={book.title || 'ספר'} 
            sx={{ 
              objectFit: 'contain',
              bgcolor: 'grey.50',
              p: 1
            }} 
          />
        )}
        <CardContent sx={{ pb: 1 }}>
          <Typography
            variant="body1"
            fontWeight={600}
            gutterBottom
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              minHeight: '2.5em',
            }}
          >
            {book.title || book.titleHebrew || 'ספר ללא שם'}
          </Typography>
          {book.author && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {book.author}
            </Typography>
          )}
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
            <Chip label={`${book.stats.availableCopies}/${book.stats.totalCopies}`} size="small" color={book.stats.availableCopies > 0 ? 'success' : 'default'} />
            {book.likesCount > 0 && (
              <Chip 
                icon={<FavoriteIcon sx={{ fontSize: 14 }} />} 
                label={book.likesCount} 
                size="small" 
                color="error" 
                variant="outlined"
              />
            )}
            {book.viewerContext.owns && (
              <Chip label="שלי" size="small" color="primary" />
            )}
            {viewerLoan && (
              <Chip label="שאלתי" size="small" color="info" />
            )}
          </Stack>
        </CardContent>
      </CardActionArea>

      <CardContent sx={{ pt: 0, pb: 1, flexGrow: 1 }}>
        {book.viewerContext.owns && viewerOwnedCopy && (
          <Box sx={{ mb: 1 }}>
            {viewerOwnedCopy.loan ? (
              <Stack spacing={0.5}>
                <Typography variant="caption" color="warning.main" fontWeight={600}>
                  מושאל ל: {viewerOwnedCopy.loan.borrowerFamily?.name}
                  {viewerOwnedCopy.loan.dueDate && ` (עד ${formatDate(viewerOwnedCopy.loan.dueDate)})`}
                </Typography>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<ReturnIcon />}
                  onClick={handleMarkReturned}
                  fullWidth
                  size="small"
                >
                  סמן כהוחזר
                </Button>
              </Stack>
            ) : (
              <Button
                variant="contained"
                color="success"
                onClick={() => navigate(`/loans/new?bookId=${viewerOwnedCopy.familyBookId}`)}
                fullWidth
                size="small"
              >
                השאל ספר
              </Button>
            )}
          </Box>
        )}

        {viewerLoan && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="info.main" display="block" gutterBottom>
              שאלתי מ: {viewerLoan.ownerFamily?.name}
              {viewerLoan.dueDate && ` (עד ${formatDate(viewerLoan.dueDate)})`}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              {viewerLoan.ownerFamily?.whatsapp && (
                <IconButton
                  size="small"
                  color="success"
                  onClick={(e) => {
                    e.stopPropagation()
                    const phone = viewerLoan.ownerFamily?.whatsapp?.replace(/[^0-9]/g, '')
                    if (phone) window.open(`https://wa.me/${phone}`, '_blank')
                  }}
                >
                  <WhatsAppIcon fontSize="small" />
                </IconButton>
              )}
              {viewerLoan.ownerFamily?.phone && (
                <IconButton
                  size="small"
                  color="primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.location.href = `tel:${viewerLoan.ownerFamily?.phone}`
                  }}
                >
                  <PhoneIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          </Box>
        )}

        {!book.viewerContext.owns && book.owners.length > 0 && (
          <Box sx={{ direction: 'rtl' }}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" color="text.secondary" display="block" gutterBottom fontWeight={500}>
              משפחות בעלות ({book.stats.totalCopies})
            </Typography>
            {book.owners.slice(0, 2).map((owner) => (
              <Box
                key={owner.familyBookId}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 0.75,
                  flexDirection: 'row-reverse',
                }}
              >
                <Typography variant="body2" fontWeight={owner.isViewerOwner ? 600 : 400}>
                  {owner.family?.name || 'משפחה'}
                  {owner.loan?.borrowerFamily && ` (מושאל)`}
                </Typography>
                <Stack direction="row-reverse" spacing={1} alignItems="center">
                  {owner.family?.whatsapp && (
                    <IconButton
                      size="medium"
                      onClick={(e) => {
                        e.stopPropagation()
                        const phone = owner.family?.whatsapp?.replace(/[^0-9]/g, '')
                        if (phone) window.open(`https://wa.me/${phone}`, '_blank')
                      }}
                      sx={{ 
                        p: 0.5,
                        bgcolor: 'success.light',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'success.main',
                        }
                      }}
                    >
                      <WhatsAppIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  )}
                  <Chip 
                    label={owner.status === 'available' ? 'זמין' : 'מושאל'} 
                    size="small" 
                    color={owner.status === 'available' ? 'success' : 'default'}
                    sx={{ height: 22, fontSize: '0.7rem' }}
                  />
                </Stack>
              </Box>
            ))}
            {book.owners.length > 2 && (
              <Typography variant="body2" color="text.secondary">
                + עוד {book.owners.length - 2}
              </Typography>
            )}
          </Box>
        )}
      </CardContent>

      <Box
        sx={{
          px: 2,
          pb: 1,
          pt: 0.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Button variant="text" size="small" onClick={handleNavigate}>
          פרטים
        </Button>
        {primaryFamilyBookId && (
          <LikeButton bookId={primaryFamilyBookId} size="small" showCount />
        )}
      </Box>
    </Card>
  )
}
