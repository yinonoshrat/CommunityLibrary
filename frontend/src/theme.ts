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
      // Compact TextField inputs
      MuiTextField: {
        defaultProps: {
          size: 'small',
        },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              fontSize: '1rem',
            },
          },
        },
      },
      // Compact outlined inputs
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            paddingTop: '8px',
            paddingBottom: '8px',
          },
          input: {
            padding: '8px 14px',
            fontSize: '1rem',
          },
        },
      },
      // Compact input labels
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontSize: '0.95rem',
          },
          outlined: {
            transform: 'translate(14px, 10px) scale(1)',
            '&.MuiInputLabel-shrink': {
              transform: 'translate(14px, -9px) scale(0.75)',
            },
          },
        },
      },
      // Compact buttons
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontSize: '0.95rem',
          },
          sizeMedium: {
            padding: '6px 16px',
            minHeight: '36px',
          },
          sizeLarge: {
            padding: '8px 22px',
            minHeight: '40px',
          },
          startIcon: {
            marginLeft: '8px',
            marginRight: '-4px',
          },
          endIcon: {
            marginRight: '8px',
            marginLeft: '-4px',
          },
        },
      },
      // Compact select dropdowns
      MuiSelect: {
        defaultProps: {
          size: 'small',
        },
        styleOverrides: {
          select: {
            padding: '8px 14px',
            fontSize: '1rem',
          },
        },
      },
      // Compact autocomplete
      MuiAutocomplete: {
        styleOverrides: {
          input: {
            padding: '2px 4px !important',
          },
          inputRoot: {
            paddingTop: '4px !important',
            paddingBottom: '4px !important',
          },
        },
      },
      // Compact form controls
      MuiFormControl: {
        defaultProps: {
          size: 'small',
        },
      },
    },
  },
  heIL // Hebrew locale
)
