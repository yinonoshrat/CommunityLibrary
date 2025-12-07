import { useMemo } from 'react'
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material'
import { useAuth } from '../contexts/AuthContext'
import { useUser } from '../hooks/useUser'
import { useLoansByOwner, useLoansByBorrower } from '../hooks/useLoans'
import CatalogBookCard from '../components/CatalogBookCard'
import type { CatalogBook } from '../types'

interface LoanRecord {
  id: string
  status: string
  family_book_id: string
  borrower_family_id: string
  owner_family_id: string
  request_date?: string
  actual_return_date?: string
  family_books?: {
    book_catalog: {
      title?: string
      title_hebrew?: string
      author?: string
      author_hebrew?: string
      cover_image_url?: string
      genre?: string
      age_range?: string
    }
  }
  borrower_family?: {
    id: string
    name: string
    phone?: string
    whatsapp?: string
  }
  owner_family?: {
    id: string
    name: string
    phone?: string
    whatsapp?: string
  }
}

const dateFormatter = new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium' })

const formatDate = (value?: string) => {
  if (!value) return 'תאריך לא זמין'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'תאריך לא ידוע'
  return dateFormatter.format(date)
}

const toCatalogBook = (loan: LoanRecord, viewerFamilyId: string | null): CatalogBook => {
  const bookInfo = loan.family_books?.book_catalog || {}
  const viewerIsOwner = viewerFamilyId === loan.owner_family_id
  const viewerIsBorrower = viewerFamilyId === loan.borrower_family_id

  return {
    catalogId: loan.family_book_id || loan.id,
    title: bookInfo.title || bookInfo.title_hebrew,
    titleHebrew: bookInfo.title_hebrew,
    author: bookInfo.author || bookInfo.author_hebrew,
    authorHebrew: bookInfo.author_hebrew,
    genre: bookInfo.genre,
    ageRange: bookInfo.age_range,
    coverImageUrl: bookInfo.cover_image_url,
    stats: {
      totalCopies: 1,
      availableCopies: 1,
      onLoanCopies: 0,
      totalLikes: 0,
      userLiked: false,
    },
    owners: [
      {
        familyBookId: loan.family_book_id,
        status: 'returned',
        condition: null,
        notes: null,
        familyId: loan.owner_family_id,
        family: loan.owner_family || null,
        loan: null,
        isViewerOwner: viewerIsOwner,
      },
    ],
    viewerContext: {
      owns: viewerIsOwner,
      borrowed: viewerIsBorrower,
      ownedCopies: viewerIsOwner
        ? [
            {
              familyBookId: loan.family_book_id,
              status: 'returned',
              loan: null,
            },
          ]
        : [],
      borrowedLoan: undefined,
    },
  }
}

const getHistoryLabel = (loan: LoanRecord, viewerFamilyId: string | null) => {
  const actedAsOwner = viewerFamilyId === loan.owner_family_id
  const counterparty = actedAsOwner ? loan.borrower_family?.name : loan.owner_family?.name
  const prefix = actedAsOwner ? 'השאלתם ל' : 'שאלתם מ'
  const base = `${prefix}${counterparty || 'משפחה'} · הושאל ב-${formatDate(loan.request_date)}`
  return loan.actual_return_date ? `${base} · הוחזר ב-${formatDate(loan.actual_return_date)}` : base
}

export default function LoansDashboard() {
  const { user } = useAuth()

  // Reactive hooks - automatic caching
  const { data: userData } = useUser(user?.id)
  const { data: lentLoans, isLoading: lentLoading } = useLoansByOwner(userData?.user?.family_id, 'returned')
  const { data: borrowedLoans, isLoading: borrowedLoading } = useLoansByBorrower(userData?.user?.family_id, 'returned')
  
  const loading = lentLoading || borrowedLoading;
  const viewerFamilyId = userData?.user?.family_id || null;

  // Combine and sort loans
  const historyLoans = useMemo(() => {
    return [
      ...(lentLoans?.loans || []),
      ...(borrowedLoans?.loans || []),
    ].sort((a: any, b: any) => {
      const aDate = new Date(a.actual_return_date || a.request_date || 0).getTime()
      const bDate = new Date(b.actual_return_date || b.request_date || 0).getTime()
      return bDate - aDate
    })
  }, [lentLoans, borrowedLoans]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 4 } }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 4 } }}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          היסטוריית השאלות
        </Typography>
        <Typography variant="body1" color="text.secondary">
          כל הספרים ששאלתם או השאלתם בעבר
        </Typography>
      </Box>

      {historyLoans.length === 0 ? (
        <Alert severity="info">אין רשומות היסטוריות להצגה</Alert>
      ) : (
        <Grid container spacing={3}>
          {historyLoans.map((loan) => {
            const book = toCatalogBook(loan, viewerFamilyId)
            const historyLabel = getHistoryLabel(loan, viewerFamilyId)
            return (
              <Grid key={loan.id} size={{ xs: 12, md: 6 }}>
                <CatalogBookCard book={book} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {historyLabel}
                </Typography>
              </Grid>
            )
          })}
        </Grid>
      )}
    </Container>
  );
}
