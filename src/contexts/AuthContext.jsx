import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { GOOGLE_CLIENT_ID, DRIVE_SCOPE } from '../config'

const AuthContext = createContext(null)
const TOKEN_KEY  = 'gd_access_token'
const EXPIRY_KEY = 'gd_token_expiry'
const USER_KEY   = 'gd_user_info'

function saveToken(token, expiresIn) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(EXPIRY_KEY, Date.now() + expiresIn * 1000)
}

function loadSavedToken() {
  const token  = localStorage.getItem(TOKEN_KEY)
  const expiry = Number(localStorage.getItem(EXPIRY_KEY))
  if (!token || !expiry) return null
  if (Date.now() > expiry - 60_000) {
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

function saveUserInfo(info) {
  localStorage.setItem(USER_KEY, JSON.stringify(info))
}

function loadUserInfo() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
}

function clearUserInfo() {
  localStorage.removeItem(USER_KEY)
}

function buildAuthUrl(extra = {}) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: window.location.origin,
    response_type: 'token',
    scope: DRIVE_SCOPE,
    ...extra,
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
  const [user, setUser]           = useState(() => loadUserInfo())
  const [authError, setAuthError] = useState(null)
  // 有儲存的用戶但 token 過期 → 需要靜默重新取得
  const [initializing, setInitializing] = useState(
    () => !loadSavedToken() && !!loadUserInfo()
  )

  // 靜默取得新 token（token 過期但有記住用戶）
  useEffect(() => {
    const savedUser  = loadUserInfo()
    const savedToken = loadSavedToken()
    const hash = parseHashParams()
    // 如果 URL hash 裡已有 token/error（OAuth 回調中），不重複 redirect
    if (!savedToken && savedUser?.email && !hash.token && !hash.error) {
      window.location.href = buildAuthUrl({
        prompt:     'none',
        login_hint: savedUser.email,
      })
    }
  }, [])

  // 解析 OAuth redirect 回來的 hash
  useEffect(() => {
    const { token: hashToken, expiresIn, error } = parseHashParams()
    if (hashToken) {
      window.history.replaceState(null, '', window.location.pathname)
      saveToken(hashToken, expiresIn)
      setToken(hashToken)
      setInitializing(false)
    } else if (error) {
      window.history.replaceState(null, '', window.location.pathname)
      // interaction_required / login_required = Google session 也過期，需手動登入
      const isSessionExpired = error === 'interaction_required' || error === 'login_required'
      clearUserInfo()
      setUser(null)
      setToken(null)
      if (!isSessionExpired) setAuthError(error)
      setInitializing(false)
    }
  }, [])

  // 有 token 但沒有 user info 時才去 fetch（避免重複呼叫）
  useEffect(() => {
    if (token && !user) {
      fetchUserInfo(token).then(info => {
        setUser(info)
        saveUserInfo(info)
      }).catch(console.error)
    }
  }, [token])

  const login = useCallback(() => {
    window.location.href = buildAuthUrl({ prompt: 'select_account' })
  }, [])

  const logout = useCallback(() => {
    if (token) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' }).catch(() => {})
    }
    clearSavedToken()
    clearUserInfo()
    setToken(null)
    setUser(null)
  }, [token])

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-slate-100">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, authError }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
