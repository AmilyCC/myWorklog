import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { GOOGLE_CLIENT_ID, DRIVE_SCOPE } from '../config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const clientRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(id)
        clientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: DRIVE_SCOPE,
          callback: async (resp) => {
            if (resp.error) { console.error(resp); return }
            setToken(resp.access_token)
            try {
              const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${resp.access_token}` },
              })
              setUser(await r.json())
            } catch (e) { console.error(e) }
          },
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
    localStorage.removeItem('pm_folder_id')
  }, [token])

  return (
    <AuthContext.Provider value={{ token, user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
