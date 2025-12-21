import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { useQueryClient } from '@tanstack/react-query'
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
  Menu,
} from '@mui/material'
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Download as DownloadIcon,
} from '@mui/icons-material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useBooks } from '../hooks/useBooks'
import CatalogBookCard from '../components/CatalogBookCard'
import ReturnBookDialog from '../components/ReturnBookDialog'
import CreateLoanDialog from '../components/CreateLoanDialog'
import type { CatalogBook, BookLoanSummary } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { useUser } from '../hooks/useUser'

type BookView = 'my' | 'borrowed' | 'all'

const STATUS_OPTIONS = [
  { value: 'all', label: 'הכל' },
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
  const { user } = useAuth()
  const { data: userData } = useUser(user?.id)
  const queryClient = useQueryClient()
  const userFamilyId = userData?.user?.family_id
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
  const [selectedLoan, setSelectedLoan] = useState<ReturnDialogLoan | null>(null)
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [loanDialogOpen, setLoanDialogOpen] = useState(false)
  const [selectedBookForLoan, setSelectedBookForLoan] = useState<{ id: string; title: string; author: string } | null>(null)
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null)
  const exportMenuOpen = Boolean(exportAnchorEl)

  // Reactive hook - automatic caching and refetching
  const { data: booksResponse, isLoading: loading, error: booksError, refetch } = useBooks({
    view,
    q: searchQuery.trim() || undefined,
    status: statusFilter !== 'all' ? (statusFilter as 'available' | 'on_loan') : undefined,
    genre: genreFilter !== 'all' ? genreFilter : undefined,
    sortBy: sortBy !== 'title' ? sortBy : undefined,
  });
  
  const books = useMemo(() => booksResponse?.books || [], [booksResponse?.books]);
  const error = booksError ? (booksError as Error).message : '';

  // Group books into rows for responsive grid (3 per row on desktop, 2 on tablet, 1 on mobile)
  const ITEMS_PER_ROW = 3;
  const bookRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < books.length; i += ITEMS_PER_ROW) {
      rows.push(books.slice(i, i + ITEMS_PER_ROW));
    }
    return rows;
  }, [books]);

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('view', view)
    if (searchQuery) params.set('q', searchQuery)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (genreFilter !== 'all') params.set('genre', genreFilter)
    if (sortBy !== 'title') params.set('sortBy', sortBy)
    setSearchParams(params, { replace: true })
  }, [view, searchQuery, statusFilter, genreFilter, sortBy, setSearchParams])

  const uniqueGenres = useMemo(() => {
    const dynamic = new Set<string>()
    books.forEach((book) => {
      if (book.genre) dynamic.add(book.genre)
    })
    return Array.from(new Set([...GENRE_OPTIONS, ...dynamic]))
  }, [books])

  const handleViewChange = useCallback((_: React.SyntheticEvent, nextView: BookView) => {
    if (nextView) {
      setView(nextView)
    }
  }, [])

  const handleSearchSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault()
    setSearchQuery(searchQuery.trim())
  }, [searchQuery])

  const handleRefresh = useCallback(() => {
    // Invalidate both the books list and normalized cache
    queryClient.invalidateQueries({ queryKey: ['books'] });
    refetch();
  }, [refetch, queryClient])

  const [selectedFamilyBookId, setSelectedFamilyBookId] = useState<string | undefined>()
  
  const handleMarkReturned = useCallback(({ book, loan }: { book: CatalogBook; loan: BookLoanSummary }) => {
    // Get the family book ID from the book's owned copies
    const familyBookId = book.viewerContext?.ownedCopies?.[0]?.familyBookId
    setSelectedFamilyBookId(familyBookId)
    
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
  }, [])

  const handleReturnDialogClose = useCallback(() => {
    setReturnDialogOpen(false)
    setSelectedLoan(null)
  }, [])

  const handleLoanCreated = useCallback(() => {
    // Close dialog - cache is already updated by the mutation
    setLoanDialogOpen(false)
    setSelectedBookForLoan(null)
    // No need to refetch - the mutation's onSuccess already updated the cache
  }, [])

  const handleOpenLoanDialog = useCallback((book: { id: string; title: string; author: string }) => {
    setSelectedBookForLoan(book)
    setLoanDialogOpen(true)
  }, [])

  const handleCloseLoanDialog = useCallback(() => {
    setLoanDialogOpen(false)
    setSelectedBookForLoan(null)
  }, [])

  const handleReturnSuccess = () => {
    setReturnDialogOpen(false)
    setSelectedLoan(null)
    refetch(); // Refresh books list after return
  }

  const handleExportClick = (event: React.MouseEvent<HTMLElement>) => {
    setExportAnchorEl(event.currentTarget)
  }

  const handleExportClose = () => {
    setExportAnchorEl(null)
  }

  const exportToCSV = useCallback(() => {
    const headers = ['Title', 'Author', 'Series', 'Series Number', 'Genre', 'Age Range', 'Status', 'Owner']
    const rows = books.map(book => [
      book.title || book.titleHebrew || '',
      book.author || book.authorHebrew || '',
      book.series || '',
      book.seriesNumber || '',
      book.genre || '',
      book.ageRange || '',
      book.stats.availableCopies > 0 ? 'Available' : 'On Loan',
      book.owners.map(o => o.family?.name || '').join('; ')
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `my-books-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    handleExportClose()
  }, [books])

  const exportToJSON = useCallback(() => {
    const exportData = books.map(book => ({
      title: book.title || book.titleHebrew || '',
      author: book.author || book.authorHebrew || '',
      series: book.series || '',
      seriesNumber: book.seriesNumber || null,
      genre: book.genre || '',
      ageRange: book.ageRange || '',
      coverImageUrl: book.coverImageUrl || '',
      availableCopies: book.stats.availableCopies,
      totalCopies: book.stats.totalCopies,
      owners: book.owners.map(o => ({
        familyName: o.family?.name || '',
        status: o.status
      }))
    }))

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `my-books-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    handleExportClose()
  }, [books])

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
          <IconButton aria-label="ייצוא" onClick={handleExportClick}>
            <DownloadIcon />
          </IconButton>
          <Menu
            anchorEl={exportAnchorEl}
            open={exportMenuOpen}
            onClose={handleExportClose}
          >
            <MenuItem onClick={exportToCSV}><bdi>ייצוא ל-CSV</bdi></MenuItem>
            <MenuItem onClick={exportToJSON}><bdi>ייצוא ל-JSON</bdi></MenuItem>
          </Menu>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/books/add')}>
            <bdi>הוסף ספרים</bdi>
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
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 5 }}>
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
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="נקה חיפוש"
                      onClick={() => setSearchQuery('')}
                      edge="end"
                      size="small"
                    >
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2.5 }}>
            <FormControl fullWidth>
              <InputLabel id="status-label">סטטוס</InputLabel>
              <Select
                labelId="status-label"
                id="status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="סטטוס"
              >
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
              <InputLabel id="genre-label">ז'אנר</InputLabel>
              <Select
                labelId="genre-label"
                id="genre-select"
                value={genreFilter}
                onChange={(e) => setGenreFilter(e.target.value)}
                label="ז'אנר"
              >
                {uniqueGenres.map((genre) => (
                  <MenuItem key={genre} value={genre === 'הכל' ? 'all' : genre}>
                    {genre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2.5 }}>
            <FormControl fullWidth>
              <InputLabel id="sort-label">מיון</InputLabel>
              <Select
                labelId="sort-label"
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                label="מיון"
              >
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
        <Virtuoso
          useWindowScroll
          totalCount={bookRows.length}
          itemContent={(rowIndex) => (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {bookRows[rowIndex].map((book) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={book.catalogId}>
                  <CatalogBookCard 
                    book={book} 
                    onMarkReturned={handleMarkReturned}
                    onLoanSuccess={handleLoanCreated}
                    onCreateLoan={handleOpenLoanDialog}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        />
      )}

      {/* Shared CreateLoanDialog - only rendered when needed */}
      {selectedBookForLoan && userFamilyId && user?.id && (
        <CreateLoanDialog
          open={loanDialogOpen}
          onClose={handleCloseLoanDialog}
          book={selectedBookForLoan}
          userFamilyId={userFamilyId}
          userId={user.id}
          onSuccess={handleLoanCreated}
        />
      )}

      {selectedLoan && (
        <ReturnBookDialog
          open={returnDialogOpen}
          onClose={handleReturnDialogClose}
          loan={selectedLoan}
          familyBookId={selectedFamilyBookId}
          onSuccess={handleReturnSuccess}
        />
      )}
    </Container>
  )
}
