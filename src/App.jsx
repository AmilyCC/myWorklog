import { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './components/LoginPage'
import TabNav from './components/TabNav'
import HistoryPage from './pages/HistoryPage'
import HighlightsPage from './pages/HighlightsPage'

function AppContent() {
  const { token } = useAuth()
  const [tab, setTab] = useState('history')

  if (!token) return <LoginPage />

  return (
    <div className="min-h-screen bg-slate-50">
      <TabNav active={tab} setActive={setTab} />
      {tab === 'history'    && <HistoryPage />}
      {tab === 'highlights' && <HighlightsPage />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
