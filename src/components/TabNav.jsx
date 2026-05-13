import { useAuth } from '../contexts/AuthContext'

const TABS = [
  { id: 'history',    label: '📅 歷史', desc: '行事曆' },
  { id: 'highlights', label: '⭐ 亮點', desc: '履歷素材' },
]

export default function TabNav({ active, setActive }) {
  const { user, logout } = useAuth()

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                active === t.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <img src={user.picture} alt="" className="w-7 h-7 rounded-full" />
            <span className="text-sm text-slate-600 hidden sm:block">{user.name}</span>
            <button onClick={logout} className="text-xs text-slate-400 hover:text-slate-600 ml-1">登出</button>
          </div>
        )}
      </div>
    </nav>
  )
}
