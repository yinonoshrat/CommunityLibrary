# Theme System Documentation

## Overview
The application now supports multiple look-and-feel themes that can be changed through the profile menu. The selected theme is persisted in localStorage and will be restored when the user returns to the application.

## Available Themes
1. **Blue (Default)** - The original theme with blue primary color
2. **Dark** - A dark theme optimized for low-light environments
3. **Green** - A green-themed variant
4. **Purple** - A purple-themed variant
5. **Orange** - An orange-themed variant

## How to Use

### Changing Theme
1. Click the user avatar in the top right corner to open the profile menu
2. Select "ערכת נושא" (Theme)
3. Choose from the available theme options
4. The theme changes immediately and is saved to localStorage

### Architecture

#### Key Files
- **`src/themes.ts`** - Theme definitions and factory function
  - Contains all 5 theme definitions
  - `createThemeByName()` - Creates a MUI theme object for a given theme name
  - `AVAILABLE_THEMES` - Array of available themes with labels

- **`src/contexts/ThemeContext.tsx`** - Theme management context
  - `ThemeContextProvider` - React context provider
  - `useThemeContext()` - Hook to access theme functions
  - Handles localStorage persistence automatically

- **`src/components/Navbar.tsx`** - Updated with theme selector
  - Theme menu nested under the profile menu
  - Shows current theme as selected in the menu

- **`src/App.tsx`** - Updated to use ThemeContext
  - Wraps the app with `ThemeContextProvider`
  - Uses `useThemeContext()` to get the dynamic theme
  - Passes theme to MUI `ThemeProvider`

#### Data Flow
1. User selects a theme from the menu
2. `useThemeContext().setTheme(themeName)` is called
3. ThemeContext updates state and saves to localStorage
4. App component receives the new `muiTheme` via context
5. MUI ThemeProvider re-renders with the new theme

#### localStorage
- **Key**: `communityLibrary_theme`
- **Value**: Theme name (e.g., 'dark', 'green', 'purple', 'orange', 'blue')
- **Persistence**: Automatic - saved on every theme change
- **Loading**: Loaded on app initialization from localStorage

## Customization

### Adding a New Theme
1. Add a theme creation function in `src/themes.ts`:
   ```typescript
   const createMyTheme = () => createTheme({
     direction: 'rtl',
     palette: {
       primary: { main: '#yourcolor' },
       // ... other theme options
     },
     // ...
   }, heIL)
   ```

2. Add to `AVAILABLE_THEMES` array:
   ```typescript
   { name: 'mytheme', label: 'My Theme Label' }
   ```

3. Add case in `createThemeByName()`:
   ```typescript
   case 'mytheme':
     return createMyTheme()
   ```

### Modifying Existing Themes
Edit the theme creation function in `src/themes.ts` and the changes will be reflected across the entire app.

## Technical Details

### Common Component Overrides
All themes share the same component styling to maintain consistency. These are defined in `commonComponentOverrides` object:
- MuiCssBaseline - RTL and base styles
- MuiContainer - Padding adjustments
- MuiTextField - Compact sizing
- MuiButton - Consistent button styling
- And more...

### Theme Properties
Each theme includes:
- **direction**: 'rtl' for Hebrew RTL support
- **palette**: Primary, secondary, and background colors
- **typography**: Font family (Rubik for Hebrew)
- **components**: MUI component overrides
- **locale**: Hebrew locale (heIL) for localization

## Browser Compatibility
The theme system uses:
- localStorage API - supported in all modern browsers
- React Context API - no additional polyfills needed
- MUI v5 - stable and well-supported

## Future Enhancements
- Add custom color picker for theme customization
- Add theme preview before saving
- Add system theme preference detection
- Add more theme options
- Add ability to export/import custom themes
