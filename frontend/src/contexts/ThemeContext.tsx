import React, { createContext, useContext, useState, useEffect } from 'react'
import type { Theme } from '@mui/material'
import { createThemeByName, AVAILABLE_THEMES } from '../themes'
import type { ThemeName } from '../themes'

interface ThemeContextType {
  currentTheme: ThemeName
  muiTheme: Theme
  setTheme: (themeName: ThemeName) => void
  availableThemes: typeof AVAILABLE_THEMES
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'communityLibrary_theme'

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('blue')
  const [muiTheme, setMuiTheme] = useState(() => createThemeByName('blue'))
  const [isLoaded, setIsLoaded] = useState(false)

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeName | null
    if (savedTheme && AVAILABLE_THEMES.some(t => t.name === savedTheme)) {
      setCurrentTheme(savedTheme)
      setMuiTheme(createThemeByName(savedTheme))
    }
    setIsLoaded(true)
  }, [])

  const handleSetTheme = (themeName: ThemeName) => {
    setCurrentTheme(themeName)
    setMuiTheme(createThemeByName(themeName))
    localStorage.setItem(THEME_STORAGE_KEY, themeName)
  }

  if (!isLoaded) {
    return <>{children}</> // Render children while loading from localStorage
  }

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        muiTheme,
        setTheme: handleSetTheme,
        availableThemes: AVAILABLE_THEMES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useThemeContext() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeContextProvider')
  }
  return context
}
