import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { prefixer } from 'stylis'
import rtlPlugin from 'stylis-plugin-rtl'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'
import { theme } from './theme'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import AuthCallback from './pages/AuthCallback'
import CompleteProfile from './pages/CompleteProfile'
import ResetPassword from './pages/ResetPassword'
import Profile from './pages/Profile'
import FamilyDashboard from './pages/FamilyDashboard'
import FamilyMembers from './pages/FamilyMembers'
import MyBooks from './pages/MyBooks'
import AddBook from './pages/AddBook'
import BookDetails from './pages/BookDetails'
import EditBook from './pages/EditBook'
import LoansDashboard from './pages/LoansDashboard'
import Recommendations from './pages/Recommendations'
import SearchBooks from './pages/SearchBooks'

// Create RTL cache
const cacheRtl = createCache({
  key: 'muirtl',
  stylisPlugins: [prefixer, rtlPlugin as any],
})

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return null // AuthProvider handles loading state
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', m: 0, p: 0 }}>
      <Navbar user={user} />
      <Box component="main" sx={{ flexGrow: 1, p: 0, m: 0 }}>
        <Routes>
        <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/books" element={user ? <MyBooks /> : <Navigate to="/login" />} />
        <Route path="/books/add" element={user ? <AddBook /> : <Navigate to="/login" />} />
        <Route path="/books/:id" element={user ? <BookDetails /> : <Navigate to="/login" />} />
        <Route path="/books/:id/edit" element={user ? <EditBook /> : <Navigate to="/login" />} />
        <Route path="/search" element={user ? <SearchBooks /> : <Navigate to="/login" />} />
        <Route path="/loans" element={user ? <LoansDashboard /> : <Navigate to="/login" />} />
        <Route path="/recommendations" element={user ? <Recommendations /> : <Navigate to="/login" />} />
        <Route path="/family" element={user ? <FamilyDashboard /> : <Navigate to="/login" />} />
        <Route path="/family/members" element={user ? <FamilyMembers /> : <Navigate to="/login" />} />
        <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
        </Routes>
      </Box>
    </Box>
  )
}

function App() {
  return (
    <CacheProvider value={cacheRtl}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </CacheProvider>
  )
}

export default App
