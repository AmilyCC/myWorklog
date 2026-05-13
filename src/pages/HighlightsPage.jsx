import { useState, useEffect, useCallback } from 'react'
import { useDrive } from '../hooks/useDrive'
import { HIGHLIGHT_CATEGORIES } from '../config'
import {
  parseHighlightsMd, buildHighlightsMd,
  parseJournalMd, dateFromFilename,
} from '../utils/journalUtils'

const CAT_STORAGE_KEY = 'highlight_categories'

function getStoredCategories() {
  try {
    const s = localStorage.getItem(CAT_STORAGE_KEY)
    return s ? JSON.parse(s) : HIGHLIGHT_CATEGORIES
  } catch { return HIGHLIGHT_CATEGORIES }
}

export default function HighlightsPage() {
  const { loadHighlights, saveHighlights, listJournals, loadJournal } = useDrive()
  const [highlights, setHighlights]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [scanning, setScanning]         = useState(false)
  const [scanMsg, setScanMsg]           = useState('')
  const [error, setError]               = useState('')
  const [activeCategory, setActiveCategory] = useState('全部')
  const [editingId, setEditingId]       = useState(null)
  const [editForm, setEditForm]         = useState({})
  const [categories, setCategories]     = useState(getStoredCategories)
  const [showCatMgr, setShowCatMgr]     = useState(false)
  const [newCat, setNewCat]             = useState('')
  const [search, setSearch]             = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    loadHighlights()
      .then(md => {
        const parsed = parseHighlightsMd(md)
        setHighlights(parsed)
        // 自動新增亮點裡出現過但清單沒有的分類
        setCategories(prev => {
          const newCats = [...new Set(
            parsed.map(h => h.category).filter(c => c && c !== '其他' && !prev.includes(c))
          )]
          if (newCats.length === 0) return prev
          const updated = [...prev, ...newCats]
          localStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(updated))
          return updated
        })
      })
      .catch(e => setError(`載入失敗：${e.message}`))
      .finally(() => setLoading(false))
  }, [loadHighlights])

  useEffect(() => { load() }, [load])

  function persistCategories(cats) {
    setCategories(cats)
    localStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(cats))
  }

  function addCategory() {
    const name = newCat.trim()
    if (!name || categories.includes(name)) return
    persistCategories([...categories, name])
    setNewCat('')
  }

  function deleteCategory(cat) {
    if (!confirm(`確定刪除分類「${cat}」？已有的亮點不受影響。`)) return
    persistCategories(categories.filter(c => c !== cat))
    if (activeCategory === cat) setActiveCategory('全部')
  }

  // 從日誌掃描匯入（只匯入尚未處理的日期）
  async function handleScanAll() {
    setScanning(true)
    setScanMsg('')
    try {
      const files = await listJournals()
      setScanMsg(`找到 ${files.length} 份日誌，掃描中...`)

      const allHighlights = []
      for (const file of files) {
        const date = dateFromFilename(file.name)
        const content = await loadJournal(date).catch(() => null)
        if (!content) continue
        parseJournalMd(content).highlights.forEach(h => allHighlights.push({ ...h, date }))
      }

      if (allHighlights.length === 0) {
        setScanMsg('掃描完畢，日誌中沒有找到任何亮點。')
        return
      }

      const processedDates = new Set(highlights.map(h => h.date))
      const newOnes = allHighlights.filter(h => !processedDates.has(h.date))
      const merged = [...highlights, ...newOnes]

      await saveHighlights(buildHighlightsMd(merged))
      setHighlights(merged)
      setScanMsg(`✅ 完成！新增 ${newOnes.length} 筆（已處理過的日期略過，總計 ${merged.length} 筆）`)
    } catch (e) {
      setScanMsg(`❌ 掃描失敗：${e.message}`)
    } finally {
      setScanning(false)
    }
  }

  function startEdit(i, h) { setEditingId(i); setEditForm({ ...h }) }

  async function saveEdit(i) {
    const updated = highlights.map((h, idx) => idx === i ? { ...editForm } : h)
    setHighlights(updated)
    setEditingId(null)
    try {
      await saveHighlights(buildHighlightsMd(updated))
    } catch (e) {
      alert('儲存失敗：' + e.message)
    }
  }

  async function deleteHighlight(i) {
    if (!confirm('確定刪除這筆亮點？')) return
    const updated = highlights.filter((_, idx) => idx !== i)
    setHighlights(updated)
    try {
      await saveHighlights(buildHighlightsMd(updated))
    } catch (e) {
      alert('刪除失敗：' + e.message)
    }
  }

  const allCategoryTabs = ['全部', ...categories]

  const searchLower = search.toLowerCase()
  const visibleWithIdx = highlights
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => activeCategory === '全部' || h.category === activeCategory)
    .filter(({ h }) => !search || [h.problem, h.solution, h.result, h.category].some(
      s => s?.toLowerCase().includes(searchLower)
    ))

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-slate-800">⭐ 履歷亮點故事</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">{highlights.length} 筆</span>
          <button
            onClick={() => setShowCatMgr(v => !v)}
            className={`text-sm px-3 py-1.5 rounded-lg transition ${showCatMgr ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            管理分類
          </button>
          <button
            onClick={handleScanAll}
            disabled={scanning}
            className="text-sm px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-50"
          >
            {scanning ? '掃描中...' : '從日誌匯入'}
          </button>
        </div>
      </div>

      {/* 分類管理 */}
      {showCatMgr && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">分類管理</p>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <span key={c} className="flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm">
                {c}
                <button
                  onClick={() => deleteCategory(c)}
                  className="text-slate-400 hover:text-red-500 leading-none ml-0.5"
                >×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
              placeholder="新增分類名稱..."
              className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <button
              onClick={addCategory}
              disabled={!newCat.trim()}
              className="text-sm px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-40"
            >新增</button>
          </div>
        </div>
      )}

      {/* 掃描訊息 */}
      {scanMsg && (
        <div className={`text-sm px-4 py-3 rounded-xl ${
          scanMsg.startsWith('✅') ? 'bg-green-50 text-green-700' :
          scanMsg.startsWith('❌') ? 'bg-red-50 text-red-700' :
          'bg-amber-50 text-amber-700'
        }`}>{scanMsg}</div>
      )}

      {/* 錯誤 */}
      {error && (
        <div className="text-sm px-4 py-3 rounded-xl bg-accent-50 text-accent-700">
          {error}
          <button onClick={load} className="ml-3 underline">重試</button>
        </div>
      )}

      {/* 搜尋 */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="搜尋問題、解法、成效..."
        className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
      />

      {/* 分類 tabs */}
      <div className="flex gap-2 flex-wrap">
        {allCategoryTabs.map(c => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`px-3 py-1.5 rounded-full text-sm transition ${
              activeCategory === c
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {c}
            {c !== '全部' && (
              <span className="ml-1 opacity-60">
                ({highlights.filter(h => h.category === c).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 內容 */}
      {loading && <div className="text-center text-slate-400 py-12">載入中...</div>}

      {!loading && !error && visibleWithIdx.length === 0 && (
        <div className="text-center text-slate-400 py-12 space-y-2">
          <p className="text-4xl">⭐</p>
          <p>這個分類還沒有亮點</p>
          {highlights.length === 0 && (
            <p className="text-sm">按上方「從日誌匯入」把日誌裡的亮點掃進來</p>
          )}
        </div>
      )}

      <div className="grid gap-4">
        {visibleWithIdx.map(({ h, i }) => {
          const isEditing = editingId === i
          return (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-amber-700 font-medium block mb-1">分類</label>
                    <select
                      value={editForm.category}
                      onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}
                      className="text-sm border border-slate-200 rounded-xl px-3 py-2 w-full"
                    >
                      {categories.map(c => <option key={c}>{c}</option>)}
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  {['problem', 'solution', 'result'].map(field => (
                    <div key={field}>
                      <label className="text-xs text-amber-700 font-medium block mb-1">
                        {{ problem: '問題', solution: '解法', result: '成效' }[field]}
                      </label>
                      <textarea
                        value={editForm[field]}
                        onChange={e => setEditForm(p => ({ ...p, [field]: e.target.value }))}
                        rows={2}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
                      />
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(i)} className="flex-1 bg-primary-600 text-white rounded-xl py-2 text-sm hover:bg-primary-700">儲存</button>
                    <button onClick={() => setEditingId(null)} className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-2 text-sm hover:bg-slate-200">取消</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                      {h.category || '未分類'}
                    </span>
                    <span className="text-xs text-slate-400">{h.date}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-semibold text-accent-600">問題：</span><span className="text-slate-700">{h.problem}</span></p>
                    <p><span className="font-semibold text-primary-600">解法：</span><span className="text-slate-700">{h.solution}</span></p>
                    <p><span className="font-semibold text-green-600">成效：</span><span className="text-slate-700">{h.result}</span></p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => startEdit(i, h)} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg">編輯</button>
                    <button onClick={() => deleteHighlight(i)} className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-accent-600 rounded-lg">刪除</button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
