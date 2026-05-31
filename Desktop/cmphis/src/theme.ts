export type Theme = 'light' | 'dark'

const KEY = 'cmphis_theme'

export function getStoredTheme(): Theme | null {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : null
}

export function getInitialTheme(): Theme {
  const stored = getStoredTheme()
  if (stored) return stored
  // 默认跟随系统
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
}

export function setTheme(theme: Theme) {
  localStorage.setItem(KEY, theme)
  applyTheme(theme)
}
