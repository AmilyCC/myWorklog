import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { GOOGLE_CLIENT_ID, DRIVE_SCOPE } from '../config'

const AuthContext = createContext(null)

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
  const [token, setToken]     = useState(null)
  const [user, setUser]       = useState(null)
  const [ready, setReady]     = useState(false)
  const [authError, setAuthError] = useState(null)
  const clientRef             = useRef(null)

  // 頁面載入時從 URL hash 取 token（redirect 回來後）
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

  useEffect(() => {
    const id = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(id)
        clientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: DRIVE_SCOPE,
          ux_mode: 'redirect',
          redirect_uri: window.location.origin,
        })
        setReady(true)
      }
    }, 200)
    return () => clearInterval(id)
  }, [])

  const login = useCallback(() => clientRef.current?.requestAccessToken(), [])

  const logout = useCallback(() => {
    if (token) window.google?.accounts.oauth2.revoke(token, () => {})
    setToken(null)
    setUser(null)
  }, [token])

  return (
    <AuthContext.Provider value={{ token, user, ready, login, logout, authError }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
