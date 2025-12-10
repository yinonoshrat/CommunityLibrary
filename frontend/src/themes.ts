import { createTheme } from '@mui/material/styles'
import { heIL } from '@mui/material/locale'

// Helper function to create component overrides with custom border radius and shape
const createComponentOverrides = (borderRadius: { cards: number; buttons: number; inputs: number }) => ({
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
  // Cards with custom border radius
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: `${borderRadius.cards}px`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
        },
      },
    },
  },
  // Paper with custom border radius
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: `${borderRadius.cards}px`,
      },
      elevation1: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
      elevation2: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  // Buttons with custom border radius and enhanced styling
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontSize: '0.95rem',
        borderRadius: `${borderRadius.buttons}px`,
        fontWeight: 500,
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
        },
      },
      contained: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        '&:hover': {
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
        },
      },
      outlined: {
        borderWidth: '2px',
        '&:hover': {
          borderWidth: '2px',
        },
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
  // IconButton with custom styling
  MuiIconButton: {
    styleOverrides: {
      root: {
        borderRadius: `${borderRadius.buttons}px`,
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
        },
      },
      sizeSmall: {
        padding: '4px',
      },
      sizeMedium: {
        padding: '8px',
      },
      sizeLarge: {
        padding: '12px',
      },
    },
  },
  // TextField inputs with custom border radius
  MuiTextField: {
    defaultProps: {
      size: 'small' as const,
    },
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          fontSize: '1rem',
          borderRadius: `${borderRadius.inputs}px`,
          transition: 'all 0.2s ease',
        },
      },
    },
  },
  // Outlined inputs
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        paddingTop: '8px',
        paddingBottom: '8px',
        borderRadius: `${borderRadius.inputs}px`,
        transition: 'all 0.2s ease',
        '&.Mui-focused': {
          boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.1)',
        },
      },
      input: {
        padding: '8px 14px',
        fontSize: '1rem',
      },
    },
  },
  // Input labels
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
  // Select dropdowns with custom border radius
  MuiSelect: {
    defaultProps: {
      size: 'small' as const,
    },
    styleOverrides: {
      select: {
        padding: '8px 14px',
        fontSize: '1rem',
        borderRadius: `${borderRadius.inputs}px`,
      },
    },
  },
  // Autocomplete with custom border radius
  MuiAutocomplete: {
    styleOverrides: {
      paper: {
        borderRadius: `${borderRadius.inputs}px`,
      },
      input: {
        padding: '2px 4px !important',
      },
      inputRoot: {
        paddingTop: '4px !important',
        paddingBottom: '4px !important',
        borderRadius: `${borderRadius.inputs}px`,
      },
    },
  },
  // Menu items
  MuiMenu: {
    styleOverrides: {
      paper: {
        borderRadius: `${borderRadius.cards}px`,
        marginTop: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  MuiMenuItem: {
    styleOverrides: {
      root: {
        borderRadius: '0',
        transition: 'all 0.15s ease',
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
        },
      },
    },
  },
  // Dialog with custom border radius
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: `${borderRadius.cards}px`,
      },
    },
  },
  // Form controls
  MuiFormControl: {
    defaultProps: {
      size: 'small' as const,
    },
  },
  // Chips with custom border radius
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: `${borderRadius.buttons / 2}px`,
        fontWeight: 500,
        transition: 'all 0.2s ease',
      },
      filled: {
        '&:hover': {
          transform: 'scale(1.02)',
        },
      },
    },
  },
  // AppBar styling
  MuiAppBar: {
    styleOverrides: {
      root: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
      },
    },
  },
})

// Default Blue Theme - Sharp modern style
const createBlueTheme = () => createTheme(
  {
    direction: 'rtl',
    shape: {
      borderRadius: 8,
    },
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
    components: createComponentOverrides({ cards: 8, buttons: 6, inputs: 6 }),
  },
  heIL
)

// Dark Theme - Modern dark with rounded corners
const createDarkTheme = () => createTheme(
  {
    direction: 'rtl',
    shape: {
      borderRadius: 12,
    },
    palette: {
      mode: 'dark',
      primary: {
        main: '#90caf9',
        light: '#e3f2fd',
        dark: '#1565c0',
      },
      secondary: {
        main: '#f48fb1',
        light: '#f8bbd0',
        dark: '#c2185b',
      },
      background: {
        default: '#121212',
        paper: '#1e1e1e',
      },
    },
    typography: {
      fontFamily: [
        'Rubik',
        'Arial',
        'sans-serif',
      ].join(','),
    },
    components: createComponentOverrides({ cards: 12, buttons: 10, inputs: 8 }),
  },
  heIL
)

// Green Theme - Nature inspired with organic shapes
const createGreenTheme = () => createTheme(
  {
    direction: 'rtl',
    shape: {
      borderRadius: 16,
    },
    palette: {
      primary: {
        main: '#2e7d32',
        light: '#66bb6a',
        dark: '#1b5e20',
      },
      secondary: {
        main: '#00897b',
        light: '#26a69a',
        dark: '#00695c',
      },
      background: {
        default: '#f1f8f6',
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
    components: createComponentOverrides({ cards: 16, buttons: 14, inputs: 12 }),
  },
  heIL
)

// Purple Theme - Elegant with soft curves
const createPurpleTheme = () => createTheme(
  {
    direction: 'rtl',
    shape: {
      borderRadius: 10,
    },
    palette: {
      primary: {
        main: '#6a1b9a',
        light: '#ba68c8',
        dark: '#38006b',
      },
      secondary: {
        main: '#00bcd4',
        light: '#80deea',
        dark: '#00838f',
      },
      background: {
        default: '#f3e5f5',
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
    components: createComponentOverrides({ cards: 10, buttons: 8, inputs: 8 }),
  },
  heIL
)

// Orange Theme - Bold with sharp edges
const createOrangeTheme = () => createTheme(
  {
    direction: 'rtl',
    shape: {
      borderRadius: 4,
    },
    palette: {
      primary: {
        main: '#f57c00',
        light: '#ffb74d',
        dark: '#e65100',
      },
      secondary: {
        main: '#ff6f00',
        light: '#ffb74d',
        dark: '#e65100',
      },
      background: {
        default: '#fff3e0',
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
    components: createComponentOverrides({ cards: 4, buttons: 2, inputs: 4 }),
  },
  heIL
)

export type ThemeName = 'blue' | 'dark' | 'green' | 'purple' | 'orange'

export const AVAILABLE_THEMES: { name: ThemeName; label: string }[] = [
  { name: 'blue', label: 'כחול (ברירת מחדל)' },
  { name: 'dark', label: 'אפל' },
  { name: 'green', label: 'ירוק' },
  { name: 'purple', label: 'סגול' },
  { name: 'orange', label: 'כתום' },
]

export const createThemeByName = (themeName: ThemeName) => {
  switch (themeName) {
    case 'dark':
      return createDarkTheme()
    case 'green':
      return createGreenTheme()
    case 'purple':
      return createPurpleTheme()
    case 'orange':
      return createOrangeTheme()
    case 'blue':
    default:
      return createBlueTheme()
  }
}

// Default export for backward compatibility
export const theme = createBlueTheme()
