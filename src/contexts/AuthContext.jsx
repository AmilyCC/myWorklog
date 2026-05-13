import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { GOOGLE_CLIENT_ID, DRIVE_SCOPE } from '../config'

const AuthContext = createContext(null)

function buildAuthUrl() {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: window.location.origin,
    response_type: 'token',
    scope: DRIVE_SCOPE,
    prompt: 'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

function parseHashParams() {
  const params = new URLSearchParams(window.location.hash.slice(1))
  return {
    token: params.get('access_token') || null,
    error: params.get('error') || null,
  }
}

async function fetchUserInfo(accessToken) {
  const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return r.json()
}

export function AuthProvider({ children }) {
  const [token, setToken]         = useState(null)
  const [user, setUser]           = useState(null)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    const { token: hashToken, error } = parseHashParams()
    if (hashToken) {
      window.history.replaceState(null, '', window.location.pathname)
      setToken(hashToken)
      fetchUserInfo(hashToken).then(setUser).catch(console.error)
    } else if (error) {
      window.history.replaceState(null, '', window.location.pathname)
      setAuthError(error)
    }
  }, [])

  const login = useCallback(() => {
    window.location.href = buildAuthUrl()
  }, [])

  const logout = useCallback(() => {
    if (token) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' })
        .catch(() => {})
    }
    setToken(null)
    setUser(null)
  }, [token])

  return (
    <AuthContext.Provider value={{ token, user, login, logout, authError }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
