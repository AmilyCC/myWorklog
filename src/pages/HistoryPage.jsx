import { useState, useEffect, useCallback } from 'react'
import { useDrive } from '../hooks/useDrive'
import { dateFromFilename, parseJournalMd, toDateStr } from '../utils/journalUtils'

function newJournalTemplate(date) {
  return `# 工作日誌 ${date}

## 今日工作紀錄
-

## 履歷亮點故事


## 關鍵字標籤
`
}

function Calendar({ year, month, markedDates, selected, onSelect, onYearMonth }) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = toDateStr()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const fmt = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const DAYS = ['日', '一', '二', '三', '四', '五', '六']
  const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2020 + 2 }, (_, i) => 2020 + i)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <select
          value={year}
          onChange={e => onYearMonth(Number(e.target.value), month)}
          className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {years.map(y => <option key={y} value={y}>{y} 年</option>)}
        </select>
        <select
          value={month}
          onChange={e => onYearMonth(year, Number(e.target.value))}
          className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => <div key={d} className="text-center text-xs text-slate-400 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const dateStr = fmt(d)
          const hasEntry = markedDates.has(dateStr)
          const isSelected = selected === dateStr
          const isToday = dateStr === today
          return (
            <button
              key={i}
              onClick={() => hasEntry && onSelect(dateStr)}
              className={`aspect-square rounded-lg text-sm flex flex-col items-center justify-center transition
                ${isSelected ? 'bg-indigo-600 text-white' : ''}
                ${!isSelected && hasEntry ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer' : ''}
                ${!isSelected && !hasEntry ? 'text-slate-300 cursor-default' : ''}
                ${isToday && !isSelected ? 'ring-2 ring-indigo-400' : ''}
              `}
            >
              {d}
              {hasEntry && <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-indigo-200' : 'bg-indigo-400'}`} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const { listJournals, loadJournal, saveJournal, deleteJournal, syncJournalHighlights } = useDrive()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [files, setFiles] = useState([])
  const [selected, setSelected] = useState(null)
  const [content, setContent] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editMd, setEditMd] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 新增日誌
  const [creating, setCreating] = useState(false)
  const [newDate, setNewDate] = useState(toDateStr())
  const [newMd, setNewMd] = useState('')

  const markedDates = new Set(files.map(f => dateFromFilename(f.name)))

  const refresh = useCallback(() => {
    listJournals().then(setFiles).catch(console.error)
  }, [listJournals])

  useEffect(() => { refresh() }, [refresh])

  function startCreating() {
    const today = toDateStr()
    setNewDate(today)
    setNewMd(newJournalTemplate(today))
    setCreating(true)
    setSelected(null)
    setContent(null)
    setEditing(false)
  }

  function handleNewDateChange(date) {
    setNewDate(date)
    setNewMd(newJournalTemplate(date))
  }

  async function handleCreate() {
    if (!newDate || !newMd.trim()) return
    if (markedDates.has(newDate) && !confirm(`${newDate} 已有日誌，確定要覆蓋？`)) return
    setSaving(true)
    try {
      await saveJournal(newDate, newMd)
      await syncJournalHighlights(newDate, newMd)
      await refresh()
      setCreating(false)
      setSelected(newDate)
      setContent(newMd)
      setParsed(parseJournalMd(newMd))
    } catch (e) { alert('儲存失敗：' + e.message) }
    finally { setSaving(false) }
  }

  async function selectDate(date) {
    setSelected(date)
    setCreating(false)
    setEditing(false)
    setLoading(true)
    try {
      const md = await loadJournal(date)
      setContent(md)
      setParsed(parseJournalMd(md))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    try {
      await saveJournal(selected, editMd)
      await syncJournalHighlights(selected, editMd)
      setContent(editMd)
      setParsed(parseJournalMd(editMd))
      setEditing(false)
    } catch (e) { alert('儲存失敗：' + e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!selected || !confirm(`確定刪除 ${selected} 的日誌？`)) return
    setDeleting(true)
    try {
      await deleteJournal(selected)
      setSelected(null)
      setContent(null)
      refresh()
    } catch (e) { alert('刪除失敗：' + e.message) }
    finally { setDeleting(false) }
  }


  return (
    <div className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
      {/* Left: Calendar + file list */}
      <div className="space-y-4">
        <button
          onClick={startCreating}
          className="w-full py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
        >
          + 新增日誌
        </button>
        <Calendar year={year} month={month} markedDates={markedDates} selected={selected} onSelect={selectDate} onYearMonth={(y, m) => { setYear(y); setMonth(m) }} />
        <div className="space-y-1">
          <p className="text-xs text-slate-400 px-1">最近記錄</p>
          {files.slice(0, 10).map(f => {
            const date = dateFromFilename(f.name)
            return (
              <button key={f.id} onClick={() => selectDate(date)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition ${selected === date ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-slate-100 text-slate-600'}`}>
                {date}
              </button>
            )
          })}
          {files.length === 0 && <p className="text-sm text-slate-400 px-1">尚無日誌記錄</p>}
        </div>
      </div>

      {/* Right panel */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 min-h-64">

        {/* 新增模式 */}
        {creating && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800">新增日誌</h2>
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={saving}
                  className="text-sm px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? '儲存中...' : '儲存'}
                </button>
                <button onClick={() => setCreating(false)}
                  className="text-sm px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600">取消</button>
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs text-slate-500 block mb-1">日期</label>
              <input
                type="date"
                value={newDate}
                onChange={e => handleNewDateChange(e.target.value)}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <textarea
              value={newMd}
              onChange={e => setNewMd(e.target.value)}
              className="w-full h-80 text-sm font-mono border border-slate-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </>
        )}

        {/* 空狀態 */}
        {!creating && !selected && (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            點擊日曆上有記錄的日期查看，或按「+ 新增日誌」
          </div>
        )}

        {/* 載入中 */}
        {!creating && selected && loading && (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">載入中...</div>
        )}

        {/* 檢視 / 編輯模式 */}
        {!creating && selected && !loading && content && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800">📅 {selected}</h2>
              <div className="flex gap-2">
                {!editing && (
                  <>
                    <button onClick={() => { setEditing(true); setEditMd(content) }}
                      className="text-sm px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600">編輯</button>
                    <button onClick={handleDelete} disabled={deleting}
                      className="text-sm px-3 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-50">刪除</button>
                  </>
                )}
                {editing && (
                  <>
                    <button onClick={handleSave} disabled={saving}
                      className="text-sm px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                      {saving ? '儲存中...' : '儲存'}
                    </button>
                    <button onClick={() => setEditing(false)}
                      className="text-sm px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600">取消</button>
                  </>
                )}
              </div>
            </div>

            {editing ? (
              <textarea
                value={editMd}
                onChange={e => setEditMd(e.target.value)}
                className="w-full h-80 text-sm font-mono border border-slate-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            ) : (
              <div className="space-y-4 text-sm">
                {parsed?.entries.length > 0 && (
                  <div>
                    <p className="font-semibold text-slate-700 mb-2">今日工作紀錄</p>
                    <ul className="space-y-1">
                      {parsed.entries.map((e, i) => (
                        <li key={i} className="flex gap-2 text-slate-600"><span className="text-indigo-400">•</span>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {parsed?.highlights.length > 0 && (
                  <div>
                    <p className="font-semibold text-slate-700 mb-2">履歷亮點故事</p>
                    <div className="space-y-2">
                      {parsed.highlights.map((h, i) => (
                        <div key={i} className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                          <p><span className="text-amber-700 font-medium">問題：</span>{h.problem}</p>
                          <p><span className="text-amber-700 font-medium">解法：</span>{h.solution}</p>
                          <p><span className="text-amber-700 font-medium">成效：</span>{h.result}</p>
                          <span className="inline-block mt-1 text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">{h.category}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {parsed?.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {parsed.tags.map(t => (
                      <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
