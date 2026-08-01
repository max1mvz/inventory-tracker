import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light'
    ? 'light'
    : 'dark'
}

/** Day/night switch. Persists the choice and flips the root data-theme. */
export default function ThemeToggle({ compact }) {
  const [theme, setTheme] = useState(currentTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* private mode */
    }
  }, [theme])

  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      className={`theme-toggle ${compact ? 'compact' : ''}`}
      onClick={() => setTheme(next)}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={compact ? 18 : 16} />
      {!compact && <span>{theme === 'dark' ? 'Light' : 'Dark'} mode</span>}
    </button>
  )
}
