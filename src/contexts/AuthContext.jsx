import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { GOOGLE_CLIENT_ID, DRIVE_SCOPE } from '../config'

const AuthContext = createContext(null)
const TOKEN_KEY  = 'gd_access_token'
const EXPIRY_KEY = 'gd_token_expiry'

function saveToken(token, expiresIn) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(EXPIRY_KEY, Date.now() + expiresIn * 1000)
}

function loadSavedToken() {
  const token  = localStorage.getItem(TOKEN_KEY)
  const expiry = Number(localStorage.getItem(EXPIRY_KEY))
  if (!token || !expiry) return null
  if (Date.now() > expiry - 60_000) { // 快到期就當過期
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EXPIRY_KEY)
    return null
  }
  return token
}

function clearSavedToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRY_KEY)
}

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
    token:     params.get('access_token') || null,
    expiresIn: Number(params.get('expires_in')) || 3600,
    error:     params.get('error') || null,
  }
}

async function fetchUserInfo(accessToken) {
  const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return r.json()
}

export function AuthProvider({ children }) {
  const [token, setToken]         = useState(() => loadSavedToken())
  const [user, setUser]           = useState(null)
  const [authError, setAuthError] = useState(null)

  // 有 token 就取 user info
  useEffect(() => {
    if (token && !user) {
      fetchUserInfo(token).then(setUser).catch(console.error)
    }
  }, [token])

  // 從 URL hash 讀 token（OAuth redirect 回來後）
  useEffect(() => {
    const { token: hashToken, expiresIn, error } = parseHashParams()
    if (hashToken) {
      window.history.replaceState(null, '', window.location.pathname)
      saveToken(hashToken, expiresIn)
      setToken(hashToken)
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
    clearSavedToken()
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
