import { createTheme } from '@mui/material/styles'
import { heIL } from '@mui/material/locale'

// Hebrew RTL Theme
export const theme = createTheme(
  {
    direction: 'rtl',
    palette: {
      primary: {
        main: '#1976d2',
        light: '#42a5f5',
        dark: '#1565c0',
      },
      secondary: {
        main: '#9c27b0',
        light: '#ba68c8',
        dark: '#7b1fa2',
      },
      background: {
        default: '#f5f5f5',
        paper: '#ffffff',
      },
    },
    typography: {
      fontFamily: [
        'Rubik',
        'Arial',
        'sans-serif',
      ].join(','),
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            direction: 'rtl',
          },
        },
      },
    },
  },
  heIL // Hebrew locale
)
