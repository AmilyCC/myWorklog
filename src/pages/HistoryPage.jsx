import { useState, useEffect, useCallback } from 'react'
import { useDrive } from '../hooks/useDrive'
import { dateFromFilename, parseJournalMd, toDateStr } from '../utils/journalUtils'

function newJournalTemplate(date) {
  return `# 工作日誌 ${date}

## 今日工作紀錄

## 履歷亮點故事


## 關鍵字標籤`
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
      <div className="flex items-center gap-2 mb-3">
        <select
          value={year}
          onChange={e => onYearMonth(Number(e.target.value), month)}
          className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          {years.map(y => <option key={y} value={y}>{y} 年</option>)}
        </select>
        <select
          value={month}
          onChange={e => onYearMonth(year, Number(e.target.value))}
          className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
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
                ${isSelected ? 'bg-primary-600 text-white' : ''}
                ${!isSelected && hasEntry ? 'bg-primary-50 text-primary-700 hover:bg-primary-100 cursor-pointer font-medium' : ''}
                ${!isSelected && !hasEntry ? 'text-slate-300 cursor-default' : ''}
                ${isToday && !isSelected ? 'ring-2 ring-primary-400' : ''}
              `}
            >
              {d}
              {hasEntry && <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-primary-200' : 'bg-primary-400'}`} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function JournalViewer({ parsed }) {
  return (
    <div className="space-y-5">
      {parsed?.entries.length > 0 && (
        <div className="bg-primary-50 rounded-xl p-4 border-l-4 border-primary-400">
          <p className="text-xs font-semibold text-primary-600 tracking-wide mb-3">今日工作紀錄</p>
          <ul className="space-y-2">
            {parsed.entries.map((e, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
                <span className="text-primary-400 shrink-0 mt-0.5">•</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {parsed?.highlights.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-accent-600 tracking-wide mb-3">✨ 履歷亮點故事</p>
          <div className="space-y-3">
            {parsed.highlights.map((h, i) => (
              <div key={i} className="bg-accent-50 border border-accent-200 rounded-xl p-4 border-l-4 border-l-accent-400">
                <span className="inline-block mb-3 text-xs bg-accent-100 text-accent-700 px-2.5 py-0.5 rounded-full font-medium">
                  {h.category || '其他'}
                </span>
                <div className="space-y-1.5 text-sm">
                  <p className="leading-relaxed">
                    <span className="font-semibold text-accent-600">問題：</span>
                    <span className="text-slate-700">{h.problem}</span>
                  </p>
                  <p className="leading-relaxed">
                    <span className="font-semibold text-primary-600">解法：</span>
                    <span className="text-slate-700">{h.solution}</span>
                  </p>
                  <p className="leading-relaxed">
                    <span className="font-semibold text-primary-400">成效：</span>
                    <span className="text-slate-700">{h.result}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {parsed?.tags.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-primary-500 tracking-wide mb-2">標籤</p>
          <div className="flex flex-wrap gap-1.5">
            {parsed.tags.map(t => (
              <span key={t} className="text-xs bg-primary-50 text-primary-600 border border-primary-200 px-3 py-1 rounded-full">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function HistoryPage() {
  const { listJournals, loadJournal, saveJournal, deleteJournal, syncJournalHighlights } = useDrive()
  const now = new Date()
  const [year, setYear]         = useState(now.getFullYear())
  const [month, setMonth]       = useState(now.getMonth())
  const [files, setFiles]       = useState([])
  const [selected, setSelected] = useState(null)
  const [content, setContent]   = useState(null)
  const [parsed, setParsed]     = useState(null)
  const [editing, setEditing]   = useState(false)
  const [editMd, setEditMd]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [calOpen, setCalOpen]   = useState(false)
  const [creating, setCreating] = useState(false)
  const [newDate, setNewDate]   = useState(toDateStr())
  const [newMd, setNewMd]       = useState('')

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
    if (markedDates.has(newDate) && !confirm(`${newDate} 已有日誌，確定覆蓋？`)) return
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
    setCalOpen(false)
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

      {/* 左側欄 */}
      <div className="space-y-3">
        <button
          onClick={startCreating}
          className="w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition"
        >
          + 新增日誌
        </button>

        {/* 行動版：收合日曆按鈕 */}
        <button
          onClick={() => setCalOpen(v => !v)}
          className="md:hidden w-full flex items-center justify-between px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600"
        >
          <span>📅 {year} 年{month + 1} 月</span>
          <span className="text-slate-400">{calOpen ? '▲' : '▼'}</span>
        </button>

        {/* 日曆：桌機永遠顯示，手機收合 */}
        <div className={`${calOpen ? 'block' : 'hidden'} md:block`}>
          <Calendar
            year={year} month={month}
            markedDates={markedDates} selected={selected}
            onSelect={selectDate}
            onYearMonth={(y, m) => { setYear(y); setMonth(m) }}
          />
        </div>

        {/* 最近日誌 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-1">
          <p className="text-xs text-slate-400 px-1 pb-1">最近日誌</p>
          {files.slice(0, 10).map(f => {
            const date = dateFromFilename(f.name)
            return (
              <button key={f.id} onClick={() => selectDate(date)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition flex items-center justify-between ${
                  selected === date
                    ? 'bg-primary-50 text-primary-700 font-semibold'
                    : 'hover:bg-slate-50 text-slate-600'
                }`}>
                <span>{date}</span>
                {selected === date && <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />}
              </button>
            )
          })}
          {files.length === 0 && <p className="text-sm text-slate-400 px-1 py-2">尚無日誌</p>}
        </div>
      </div>

      {/* 右側內容 */}
      <div className="bg-white rounded-2xl border border-slate-200 min-h-64 overflow-hidden">

        {/* 新增日誌表單 */}
        {creating && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800">新增日誌</h2>
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={saving}
                  className="text-sm px-4 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">
                  {saving ? '儲存中...' : '儲存'}
                </button>
                <button onClick={() => setCreating(false)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600">取消</button>
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs text-slate-500 block mb-1">日期</label>
              <input
                type="date" value={newDate}
                onChange={e => handleNewDateChange(e.target.value)}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <textarea
              value={newMd} onChange={e => setNewMd(e.target.value)}
              className="w-full h-80 text-sm font-mono border border-slate-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
        )}

        {/* 空白提示 */}
        {!creating && !selected && (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-sm gap-2">
            <span className="text-3xl">📅</span>
            <p>從左側選擇日期或新增日誌</p>
          </div>
        )}

        {/* 載入中 */}
        {!creating && selected && loading && (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">載入中...</div>
        )}

        {/* 檢視 / 編輯 */}
        {!creating && selected && !loading && content && (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">工作日誌</p>
                <h2 className="font-bold text-slate-800 text-base">{selected}</h2>
              </div>
              <div className="flex gap-2">
                {!editing ? (
                  <>
                    <button onClick={() => { setEditing(true); setEditMd(content) }}
                      className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium">編輯</button>
                    <button onClick={handleDelete} disabled={deleting}
                      className="text-sm px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-accent-600 font-medium disabled:opacity-50">刪除</button>
                  </>
                ) : (
                  <>
                    <button onClick={handleSave} disabled={saving}
                      className="text-sm px-4 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 font-medium disabled:opacity-50">
                      {saving ? '儲存中...' : '儲存'}
                    </button>
                    <button onClick={() => setEditing(false)}
                      className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600">取消</button>
                  </>
                )}
              </div>
            </div>

            <div className="p-5">
              {editing ? (
                <textarea
                  value={editMd} onChange={e => setEditMd(e.target.value)}
                  className="w-full h-80 text-sm font-mono border border-slate-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              ) : (
                <JournalViewer parsed={parsed} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
