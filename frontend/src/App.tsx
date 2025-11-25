import { ThemeProvider, CssBaseline } from '@mui/material'
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
import Profile from './pages/Profile'
import FamilyDashboard from './pages/FamilyDashboard'
import FamilyMembers from './pages/FamilyMembers'
import MyBooks from './pages/MyBooks'
import AddBook from './pages/AddBook'
import BookDetails from './pages/BookDetails'
import EditBook from './pages/EditBook'

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
    <>
      <Navbar user={user} />
      <Routes>
        <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
        <Route path="/books" element={user ? <MyBooks /> : <Navigate to="/login" />} />
        <Route path="/books/add" element={user ? <AddBook /> : <Navigate to="/login" />} />
        <Route path="/books/:id" element={user ? <BookDetails /> : <Navigate to="/login" />} />
        <Route path="/books/:id/edit" element={user ? <EditBook /> : <Navigate to="/login" />} />
        <Route path="/search" element={user ? <Home /> : <Navigate to="/login" />} />
        <Route path="/loans" element={user ? <Home /> : <Navigate to="/login" />} />
        <Route path="/family" element={user ? <FamilyDashboard /> : <Navigate to="/login" />} />
        <Route path="/family/members" element={user ? <FamilyMembers /> : <Navigate to="/login" />} />
        <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
      </Routes>
    </>
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
