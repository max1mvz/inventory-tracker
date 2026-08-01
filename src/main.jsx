import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { OfflineProvider } from './offline/OfflineContext.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <OfflineProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </OfflineProvider>
  </StrictMode>,
)
