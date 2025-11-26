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
            margin: 0,
            padding: 0,
          },
          '#root': {
            minHeight: '100vh',
            margin: 0,
            padding: 0,
          },
          html: {
            margin: 0,
            padding: 0,
          },
          '*': {
            boxSizing: 'border-box',
          },
        },
      },
      MuiContainer: {
        styleOverrides: {
          root: {
            paddingLeft: '8px !important',
            paddingRight: '8px !important',
            '@media (min-width: 600px)': {
              paddingLeft: '24px !important',
              paddingRight: '24px !important',
            },
          },
        },
      },
    },
  },
  heIL // Hebrew locale
)
