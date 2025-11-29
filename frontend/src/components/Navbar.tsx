import { AppBar, Toolbar, Typography, Button, Box, IconButton, Menu, MenuItem, Avatar } from '@mui/material'
import { ArrowBack } from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface NavbarProps {
  user: any
}

export default function Navbar({ user }: NavbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  // Pages that should not show back button (main navigation pages)
  const noBackButtonPages = ['/', '/login', '/register']
  const showBackButton = !noBackButtonPages.includes(location.pathname)

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
    handleClose()
  }

  return (
    <AppBar position="static" sx={{ width: '100%', left: 0, right: 0, m: 0 }}>
      <Toolbar sx={{ px: { xs: 0, sm: 3 }, minHeight: { xs: 56, sm: 64 } }}>
        {showBackButton && (
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate(-1)}
            sx={{ ml: { xs: 0.5, sm: 0 }, mr: { xs: 0.5, sm: 2 } }}
          >
            <ArrowBack />
          </IconButton>
        )}
        
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          ספריה קהילתית
        </Typography>

        {user ? (
          <Box>
            <IconButton
              size="large"
              onClick={handleMenu}
              color="inherit"
            >
              <Avatar sx={{ width: 32, height: 32 }}>
                {user.email?.[0]?.toUpperCase()}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
            >
              <MenuItem onClick={() => { navigate('/profile'); handleClose(); }}>
                הפרופיל שלי
              </MenuItem>
              <MenuItem onClick={() => { navigate('/family'); handleClose(); }}>
                המשפחה שלי
              </MenuItem>
              <MenuItem onClick={() => { navigate('/books'); handleClose(); }}>
                הספרים שלי
              </MenuItem>
              <MenuItem onClick={() => { navigate('/books/add'); handleClose(); }}>
                הוסף ספר
              </MenuItem>
              <MenuItem onClick={() => { navigate('/search'); handleClose(); }}>
                חיפוש ספרים
              </MenuItem>
              <MenuItem onClick={() => { navigate('/loans'); handleClose(); }}>
                היסטוריית השאלות
              </MenuItem>
              <MenuItem onClick={() => { navigate('/recommendations'); handleClose(); }}>
                המלצות
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                התנתק
              </MenuItem>
            </Menu>
          </Box>
        ) : (
          <Box>
            <Button color="inherit" onClick={() => navigate('/login')}>
              התחבר
            </Button>
            <Button color="inherit" onClick={() => navigate('/register')}>
              הירשם
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  )
}
