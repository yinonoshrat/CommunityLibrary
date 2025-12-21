import { useState, useMemo } from 'react'
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Grid,
  Tabs,
  Tab,
} from '@mui/material'
import { useAuth } from '../contexts/AuthContext'
import { useUser } from '../hooks/useUser'
import { useLoansByOwner, useLoansByBorrower } from '../hooks/useLoans'
import CatalogBookCard from '../components/CatalogBookCard'
import ReturnBookDialog from '../components/ReturnBookDialog'
import type { CatalogBook, BookLoanSummary } from '../types'
import { useQueryClient } from '@tanstack/react-query'

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
      onLoanCopies: loan.status === 'active' ? 1 : 0,
      totalLikes: 0,
      userLiked: false,
    },
    owners: [
      {
        familyBookId: loan.family_book_id,
        status: loan.status === 'active' ? 'lent' : 'returned',
        condition: null,
        notes: null,
        familyId: loan.owner_family_id,
        family: loan.owner_family || null,
        loan: loan.status === 'active' ? (loan as any) : null,
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
              status: loan.status === 'active' ? 'lent' : 'returned',
              loan: loan.status === 'active' ? (loan as any) : null,
            },
          ]
        : [],
      borrowedLoan: viewerIsBorrower && loan.status === 'active' ? (loan as any) : undefined,
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
  const queryClient = useQueryClient()
  const [tab, setTab] = useState(0)
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState<any | null>(null)

  // Reactive hooks - automatic caching
  const { data: userData } = useUser(user?.id)
  const familyId = userData?.user?.family_id

  // Active Loans
  const { data: activeLentLoans, isLoading: activeLentLoading } = useLoansByOwner(familyId, 'active')
  const { data: activeBorrowedLoans, isLoading: activeBorrowedLoading } = useLoansByBorrower(familyId, 'active')

  // History Loans
  const { data: historyLentLoans, isLoading: historyLentLoading } = useLoansByOwner(familyId, 'returned')
  const { data: historyBorrowedLoans, isLoading: historyBorrowedLoading } = useLoansByBorrower(familyId, 'returned')
  
  const loading = activeLentLoading || activeBorrowedLoading || historyLentLoading || historyBorrowedLoading;
  const viewerFamilyId = familyId || null;

  // Combine and sort history loans
  const historyLoans = useMemo(() => {
    return [
      ...(historyLentLoans?.loans || []),
      ...(historyBorrowedLoans?.loans || []),
    ].sort((a: any, b: any) => {
      const aDate = new Date(a.actual_return_date || a.request_date || 0).getTime()
      const bDate = new Date(b.actual_return_date || b.request_date || 0).getTime()
      return bDate - aDate
    })
  }, [historyLentLoans, historyBorrowedLoans]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTab(newValue)
  }

  const handleMarkReturned = ({ loan }: { book: CatalogBook; loan: BookLoanSummary }) => {
    setSelectedLoan(loan)
    setReturnDialogOpen(true)
  }

  const handleReturnSuccess = () => {
    setReturnDialogOpen(false)
    setSelectedLoan(null)
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['loans'] })
    queryClient.invalidateQueries({ queryKey: ['books'] })
  }

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
          ניהול השאלות
        </Typography>
        <Typography variant="body1" color="text.secondary">
          צפו בספרים שהשאלתם, שאלתם והיסטוריית ההשאלות
        </Typography>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={handleTabChange} aria-label="loans tabs">
          <Tab label="השאלתי" />
          <Tab label="שאלתי" />
          <Tab label="היסטוריה" />
        </Tabs>
      </Box>

      {/* Tab 0: Lent (Active) */}
      {tab === 0 && (
        <Box>
          {activeLentLoans?.loans && activeLentLoans.loans.length > 0 ? (
            <Grid container spacing={3}>
              {activeLentLoans.loans.map((loan) => {
                const book = toCatalogBook(loan, viewerFamilyId)
                return (
                  <Grid key={loan.id} size={{ xs: 12, md: 6 }}>
                    <Box data-testid="loan-card">
                      <CatalogBookCard 
                        book={book} 
                        onMarkReturned={handleMarkReturned}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        הושאל ל{loan.borrower_family?.name || 'משפחה'} ב-{formatDate(loan.request_date)}
                      </Typography>
                    </Box>
                  </Grid>
                )
              })}
            </Grid>
          ) : (
            <Alert severity="info">אין ספרים מושאלים כרגע</Alert>
          )}
        </Box>
      )}

      {/* Tab 1: Borrowed (Active) */}
      {tab === 1 && (
        <Box>
          {activeBorrowedLoans?.loans && activeBorrowedLoans.loans.length > 0 ? (
            <Grid container spacing={3}>
              {activeBorrowedLoans.loans.map((loan) => {
                const book = toCatalogBook(loan, viewerFamilyId)
                return (
                  <Grid key={loan.id} size={{ xs: 12, md: 6 }}>
                    <Box data-testid="loan-card">
                      <CatalogBookCard book={book} />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        הושאל מ{loan.owner_family?.name || 'משפחה'} ב-{formatDate(loan.request_date)}
                      </Typography>
                    </Box>
                  </Grid>
                )
              })}
            </Grid>
          ) : (
            <Alert severity="info">אין ספרים ששאלתם כרגע</Alert>
          )}
        </Box>
      )}

      {/* Tab 2: History */}
      {tab === 2 && (
        <Box>
          {historyLoans.length > 0 ? (
            <Grid container spacing={3}>
              {historyLoans.map((loan) => {
                const book = toCatalogBook(loan, viewerFamilyId)
                const historyLabel = getHistoryLabel(loan, viewerFamilyId)
                return (
                  <Grid key={loan.id} size={{ xs: 12, md: 6 }}>
                    <Box data-testid="loan-card">
                      <CatalogBookCard book={book} />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        {historyLabel}
                      </Typography>
                    </Box>
                  </Grid>
                )
              })}
            </Grid>
          ) : (
            <Alert severity="info">אין רשומות היסטוריות להצגה</Alert>
          )}
        </Box>
      )}

      {selectedLoan && (
        <ReturnBookDialog
          open={returnDialogOpen}
          onClose={() => setReturnDialogOpen(false)}
          loan={selectedLoan}
          familyBookId={selectedLoan.family_book_id}
          onSuccess={handleReturnSuccess}
        />
      )}
    </Container>
  );
}
