import { useState, useEffect, useCallback } from 'react'
import { useDrive } from '../hooks/useDrive'
import { HIGHLIGHT_CATEGORIES } from '../config'
import {
  parseHighlightsMd, buildHighlightsMd,
  parseJournalMd, dateFromFilename,
} from '../utils/journalUtils'

export default function HighlightsPage() {
  const { loadHighlights, saveHighlights, listJournals, loadJournal } = useDrive()
  const [highlights, setHighlights]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [scanning, setScanning]         = useState(false)
  const [scanMsg, setScanMsg]           = useState('')
  const [error, setError]               = useState('')
  const [activeCategory, setActiveCategory] = useState('全部')
  const [editingId, setEditingId]       = useState(null)
  const [editForm, setEditForm]         = useState({})
  const [dirty, setDirty]               = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    loadHighlights()
      .then(md => {
        setHighlights(parseHighlightsMd(md))
        setDirty(false)
      })
      .catch(e => setError(`載入失敗：${e.message}`))
      .finally(() => setLoading(false))
  }, [loadHighlights])

  useEffect(() => { load() }, [load])

  // 掃描所有日誌，把裡面的亮點全部匯入 亮點匯整.md
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
        const parsed = parseJournalMd(content)
        parsed.highlights.forEach(h => {
          allHighlights.push({ ...h, date })
        })
      }

      if (allHighlights.length === 0) {
        setScanMsg('掃描完畢，日誌中沒有找到任何亮點格式的內容。')
        return
      }

      // 合併：只匯入「亮點匯整.md 中完全沒有紀錄的日期」，已處理過的日期一律跳過
      const existing = highlights
      const processedDates = new Set(existing.map(h => h.date))
      const newOnes = allHighlights.filter(h => !processedDates.has(h.date))
      const merged = [...existing, ...newOnes]

      await saveHighlights(buildHighlightsMd(merged))
      setHighlights(merged)
      setDirty(false)
      setScanMsg(`✅ 完成！新增 ${newOnes.length} 筆（已處理過的日期略過，總計 ${merged.length} 筆）`)
    } catch (e) {
      setScanMsg(`❌ 掃描失敗：${e.message}`)
    } finally {
      setScanning(false)
    }
  }

  const categories = ['全部', ...HIGHLIGHT_CATEGORIES]

  const visible = highlights.filter(h =>
    activeCategory === '全部' || h.category === activeCategory
  )

  const globalIndices = highlights.reduce((acc, h, i) => {
    if (activeCategory === '全部' || h.category === activeCategory) acc.push(i)
    return acc
  }, [])

  function startEdit(i, h) { setEditingId(i); setEditForm({ ...h }) }

  function saveEdit(globalIdx) {
    setHighlights(prev => prev.map((h, i) => i === globalIdx ? { ...editForm } : h))
    setEditingId(null)
    setDirty(true)
  }

  async function deleteHighlight(globalIdx) {
    if (!confirm('確定刪除這筆亮點？')) return
    const updated = highlights.filter((_, i) => i !== globalIdx)
    setHighlights(updated)
    try {
      await saveHighlights(buildHighlightsMd(updated))
    } catch (e) {
      alert('刪除失敗：' + e.message)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveHighlights(buildHighlightsMd(highlights))
      setDirty(false)
    } catch (e) {
      alert('儲存失敗：' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-slate-800">⭐ 履歷亮點故事</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">{highlights.length} 筆</span>
          <button
            onClick={handleScanAll}
            disabled={scanning}
            className="text-sm px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-50"
          >
            {scanning ? '掃描中...' : '從日誌重新匯入'}
          </button>
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? '儲存中...' : '儲存變更'}
            </button>
          )}
        </div>
      </div>

      {/* 掃描訊息 */}
      {scanMsg && (
        <div className={`text-sm px-4 py-3 rounded-xl ${scanMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : scanMsg.startsWith('❌') ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
          {scanMsg}
        </div>
      )}

      {/* 錯誤 */}
      {error && (
        <div className="text-sm px-4 py-3 rounded-xl bg-red-50 text-red-700">
          {error}
          <button onClick={load} className="ml-3 underline">重試</button>
        </div>
      )}

      {/* 分類 tabs */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`px-3 py-1.5 rounded-full text-sm transition ${
              activeCategory === c
                ? 'bg-indigo-600 text-white'
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

      {!loading && !error && visible.length === 0 && (
        <div className="text-center text-slate-400 py-12 space-y-2">
          <p className="text-4xl">⭐</p>
          <p>這個分類還沒有亮點</p>
          {highlights.length === 0 && (
            <p className="text-sm">按上方「從日誌重新匯入」，把日誌裡的亮點全部掃進來</p>
          )}
        </div>
      )}

      <div className="grid gap-4">
        {visible.map((h, visIdx) => {
          const globalIdx = globalIndices[visIdx]
          const isEditing = editingId === globalIdx
          return (
            <div key={globalIdx} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              {isEditing ? (
                <div className="space-y-3">
                  {['problem', 'solution', 'result'].map(field => (
                    <div key={field}>
                      <label className="text-xs text-amber-700 font-medium block mb-1">
                        {{ problem: '問題', solution: '解法', result: '成效' }[field]}
                      </label>
                      <textarea
                        value={editForm[field]}
                        onChange={e => setEditForm(p => ({ ...p, [field]: e.target.value }))}
                        rows={2}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-amber-700 font-medium block mb-1">分類</label>
                    <select
                      value={editForm.category}
                      onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}
                      className="text-sm border border-slate-200 rounded-xl px-3 py-2 w-full"
                    >
                      {HIGHLIGHT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(globalIdx)} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm hover:bg-indigo-700">儲存</button>
                    <button onClick={() => setEditingId(null)} className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-2 text-sm hover:bg-slate-200">取消</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">{h.category || '未分類'}</span>
                    <span className="text-xs text-slate-400">{h.date}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-semibold text-red-600">問題：</span><span className="text-slate-700">{h.problem}</span></p>
                    <p><span className="font-semibold text-blue-600">解法：</span><span className="text-slate-700">{h.solution}</span></p>
                    <p><span className="font-semibold text-green-600">成效：</span><span className="text-slate-700">{h.result}</span></p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => startEdit(globalIdx, h)} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg">編輯</button>
                    <button onClick={() => deleteHighlight(globalIdx)} className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg">刪除</button>
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
