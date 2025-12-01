import { useState, useEffect, useMemo } from 'react'
import {
  Container,
  Typography,
  Box,
  Grid,
  TextField,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
  CircularProgress,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
} from '@mui/material'
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiCall } from '../utils/apiCall'
import CatalogBookCard from '../components/CatalogBookCard'
import ReturnBookDialog from '../components/ReturnBookDialog'
import type { CatalogBook, BookLoanSummary } from '../types'

type BookView = 'my' | 'borrowed' | 'all'

const STATUS_OPTIONS = [
  { value: 'all', label: 'כל הסטטוסים' },
  { value: 'available', label: 'זמין' },
  { value: 'on_loan', label: 'מושאל' },
]

const GENRE_OPTIONS = ['הכל', 'רומן', 'מתח', 'מדע בדיוני', 'פנטזיה', 'ביוגרפיה', 'ילדים', 'נוער', 'עיון', 'אחר']

type ReturnDialogLoan = {
  id: string
  family_books?: {
    book_catalog: {
      title?: string
      title_hebrew?: string
      author?: string
      author_hebrew?: string
    }
  }
  books?: {
    title?: string
    title_hebrew?: string
    author?: string
    author_hebrew?: string
  }
  borrower_family?: {
    name: string
    phone?: string
    whatsapp?: string
  }
}

export default function MyBooks() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialView = (searchParams.get('view') as BookView) || 'my'
  const initialStatus = searchParams.get('status') || 'all'
  const initialGenre = searchParams.get('genre') || 'all'
  const initialSearch = searchParams.get('q') || ''
  const initialSort = searchParams.get('sortBy') || 'title'

  const [view, setView] = useState<BookView>(initialView)
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [genreFilter, setGenreFilter] = useState(initialGenre)
  const [sortBy, setSortBy] = useState(initialSort)
  const [books, setBooks] = useState<CatalogBook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedLoan, setSelectedLoan] = useState<ReturnDialogLoan | null>(null)
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [refreshFlag, setRefreshFlag] = useState(0)

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('view', view)
    if (searchQuery) params.set('q', searchQuery)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (genreFilter !== 'all') params.set('genre', genreFilter)
    if (sortBy !== 'title') params.set('sortBy', sortBy)
    setSearchParams(params, { replace: true })
  }, [view, searchQuery, statusFilter, genreFilter, sortBy, setSearchParams])

  useEffect(() => {
    let isCancelled = false

    const loadBooks = async () => {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        params.set('view', view)
        if (searchQuery.trim()) params.set('search', searchQuery.trim())
        if (statusFilter !== 'all') params.set('status', statusFilter)
        if (genreFilter !== 'all') params.set('genre', genreFilter)
        if (sortBy !== 'title') params.set('sortBy', sortBy)

        const response = await apiCall<{ books: CatalogBook[]; meta?: { message?: string } }>(`/api/books?${params.toString()}`)
        if (!isCancelled) {
          setBooks(response.books || [])
          // Show info message if no family is associated
          if (response.meta?.message && (response.books || []).length === 0) {
            setError('')
            // You could also set a separate info state here if you want to display it differently
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load books', err)
          setError(err instanceof Error ? err.message : 'שגיאה בטעינת הספרים')
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadBooks()
    return () => {
      isCancelled = true
    }
  }, [view, searchQuery, statusFilter, genreFilter, sortBy, refreshFlag])

  const uniqueGenres = useMemo(() => {
    const dynamic = new Set<string>()
    books.forEach((book) => {
      if (book.genre) dynamic.add(book.genre)
    })
    return Array.from(new Set([...GENRE_OPTIONS, ...dynamic]))
  }, [books])

  const handleViewChange = (_: React.SyntheticEvent, nextView: BookView) => {
    if (nextView) {
      setView(nextView)
    }
  }

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setSearchQuery(searchQuery.trim())
  }

  const handleRefresh = () => {
    setRefreshFlag(Date.now())
  }

  const handleMarkReturned = ({ book, loan }: { book: CatalogBook; loan: BookLoanSummary }) => {
    const dialogLoan: ReturnDialogLoan = {
      id: loan.id,
      borrower_family: loan.borrowerFamily
        ? {
            name: loan.borrowerFamily.name || 'משפחה',
            phone: loan.borrowerFamily.phone,
            whatsapp: loan.borrowerFamily.whatsapp,
          }
        : undefined,
      family_books: {
        book_catalog: {
          title: book.title,
          title_hebrew: book.titleHebrew,
          author: book.author,
          author_hebrew: book.authorHebrew,
        },
      },
    }
    setSelectedLoan(dialogLoan)
    setReturnDialogOpen(true)
  }

  const handleReturnDialogClose = () => {
    setReturnDialogOpen(false)
    setSelectedLoan(null)
  }

  const handleLoanCreated = (catalogId: string, loan: any) => {
    // Update the book in place instead of reloading all books
    setBooks(prevBooks => prevBooks.map(book => {
      if (book.catalogId === catalogId) {
        // Update the viewer's owned copy to show it's now on loan
        const updatedOwnedCopies = book.viewerContext.ownedCopies.map(copy => ({
          ...copy,
          loan: {
            id: loan.id,
            status: loan.status || 'active',
            familyBookId: copy.familyBookId,
            borrowerFamilyId: loan.borrower_family_id,
            ownerFamilyId: loan.owner_family_id,
            borrowerFamily: loan.borrower_family,
            dueDate: loan.due_date,
            requestDate: loan.created_at,
            approvedDate: loan.approved_date
          } as BookLoanSummary
        }))
        return {
          ...book,
          viewerContext: {
            ...book.viewerContext,
            ownedCopies: updatedOwnedCopies
          },
          stats: {
            ...book.stats,
            availableCopies: Math.max(0, book.stats.availableCopies - 1)
          }
        }
      }
      return book
    }))
  }

  const handleReturnSuccess = () => {
    setReturnDialogOpen(false)
    setSelectedLoan(null)
    setRefreshFlag(Date.now())
  }

  const subtitle = {
    my: 'צפו בכל הספרים שבבעלות המשפחה שלכם, כולל ספרים זמינים ומושאלים',
    borrowed: 'רשימת הספרים ששאלתם ממשפחות אחרות בקהילה',
    all: 'קטלוג הקהילה - חפשו ספרים מעניינים וצפו במשפחות המחזיקות בהם',
  }[view]

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box mb={3} display="flex" flexDirection="column" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
        <Box>
          <Box display="flex" flexDirection="row-reverse" justifyContent="center" alignItems="center" gap={2}>
            <Typography variant="h4" component="h1">
              {view === 'all' ? 'קטלוג הקהילה' : 'הספרים שלי'}
            </Typography>
               <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 'normal' }}>
              ({books.length})
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <IconButton aria-label="רענן" onClick={handleRefresh}>
            <RefreshIcon />
          </IconButton>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/books/add')}>
            הוסף ספרים
          </Button>
        </Box>
      </Box>

      <ToggleButtonGroup value={view} exclusive onChange={handleViewChange} sx={{ mb: 4 }}>
        <ToggleButton value="my">הספרים שלי</ToggleButton>
        <ToggleButton value="borrowed">ספרים ששאלתי</ToggleButton>
        <ToggleButton value="all">כל הקטלוג</ToggleButton>
      </ToggleButtonGroup>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSearchSubmit} mb={4}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              placeholder="חפש לפי שם, מחבר או סדרה"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>סטטוס</InputLabel>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="סטטוס">
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>ז'אנר</InputLabel>
              <Select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)} label="ז'אנר">
                {uniqueGenres.map((genre) => (
                  <MenuItem key={genre} value={genre === 'הכל' ? 'all' : genre}>
                    {genre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>מיון</InputLabel>
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} label="מיון">
                <MenuItem value="title">שם הספר</MenuItem>
                <MenuItem value="author">מחבר</MenuItem>
                <MenuItem value="updated">עודכן לאחרונה</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
          <CircularProgress />
        </Box>
      ) : books.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            לא נמצאו ספרים להצגה
          </Typography>
          <Typography variant="body2" color="text.secondary">
            נסו לשנות את החיפוש או להוסיף ספר חדש
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {books.map((book) => (
            <Grid key={book.catalogId} size={{ xs: 12, md: 6 }}>
              <CatalogBookCard 
                book={book} 
                onMarkReturned={handleMarkReturned}
                onLoanSuccess={handleLoanCreated}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {selectedLoan && (
        <ReturnBookDialog
          open={returnDialogOpen}
          onClose={handleReturnDialogClose}
          loan={selectedLoan}
          onSuccess={handleReturnSuccess}
        />
      )}
    </Container>
  )
}
