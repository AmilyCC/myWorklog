import { useState, useRef, useEffect, useCallback } from 'react'
import { useDrive } from '../hooks/useDrive'
import { buildSystemPrompt } from '../config'
import { dateFromFilename, parseJournalMd } from '../utils/journalUtils'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-20250514'
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

// ── 工具函式 ────────────────────────────────────────────
function msgId() { return Date.now() + Math.random() }
const userMsg = (text) => ({ role: 'user', text, id: msgId() })
const botMsg  = (text) => ({ role: 'bot',  text, id: msgId() })

function parseJournalBlock(text) {
  const m = text.match(/\[JOURNAL_START\]([\s\S]*?)\[JOURNAL_END\]/)
  if (!m) return null
  const inner = m[1].trim()
  const dateM = inner.match(/^DATE:(\d{4}-\d{2}-\d{2})/)
  if (!dateM) return null
  const date = dateM[1]
  const markdown = inner.replace(/^DATE:\d{4}-\d{2}-\d{2}\n?/, '').trim()
  return { date, markdown }
}

// ── 日誌預覽卡片 ─────────────────────────────────────────
function JournalCard({ journal, onSave, onDiscard, saving }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mx-4 mb-3 border border-indigo-200 bg-indigo-50 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-indigo-800">日誌已整理 — {journal.date}</span>
        <button onClick={() => setOpen(v => !v)} className="text-xs text-indigo-500 hover:text-indigo-700">
          {open ? '收起' : '展開預覽'}
        </button>
      </div>
      {open && (
        <pre className="px-4 pb-3 text-xs text-slate-600 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto border-t border-indigo-100">
          {journal.markdown}
        </pre>
      )}
      <div className="flex gap-2 px-4 pb-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? '儲存中...' : '存到 Google Drive'}
        </button>
        <button onClick={onDiscard} className="px-4 bg-slate-100 text-slate-600 rounded-xl py-2 text-sm hover:bg-slate-200">
          捨棄
        </button>
      </div>
    </div>
  )
}

// ── 主元件 ───────────────────────────────────────────────
export default function AssistantPage() {
  const { listJournals, loadJournal, saveJournal, syncJournalHighlights } = useDrive()

  const [displayMsgs, setDisplayMsgs] = useState([botMsg('嗨！今天過得如何？有什麼工作想記下來的嗎？')])
  const [chatHistory, setChatHistory]  = useState([])
  const [context, setContext]          = useState('')
  const [contextReady, setContextReady] = useState(false)
  const [input, setInput]              = useState('')
  const [loading, setLoading]          = useState(false)
  const [pendingJournal, setPendingJournal] = useState(null)
  const [savingJournal, setSavingJournal]   = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [displayMsgs, pendingJournal])

  // 載入最近 5 筆日誌作為 context
  const loadContext = useCallback(async () => {
    try {
      const files = await listJournals()
      const recent = files.slice(0, 5)
      const parts = await Promise.all(
        recent.map(async f => {
          const date = dateFromFilename(f.name)
          const content = await loadJournal(date).catch(() => null)
          return content ? `=== ${date} ===\n${content}` : null
        })
      )
      const joined = parts.filter(Boolean).join('\n\n')
      setContext(joined ? `以下是最近 5 筆日誌供參考：\n\n${joined}` : '')
    } catch (e) {
      console.error('載入 context 失敗', e)
    } finally {
      setContextReady(true)
    }
  }, [listJournals, loadJournal])

  useEffect(() => { loadContext() }, [loadContext])

  // 呼叫 Anthropic API
  async function callClaude(history) {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: buildSystemPrompt(context),
        messages: history,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message || `API 錯誤 ${res.status}`)
    }

    const data = await res.json()
    return data.content?.[0]?.text ?? ''
  }

  // 傳送訊息
  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const newHistory = [...chatHistory, { role: 'user', content: text }]
    setChatHistory(newHistory)
    setDisplayMsgs(prev => [...prev, userMsg(text)])
    setLoading(true)

    try {
      const reply = await callClaude(newHistory)
      if (!reply) { setLoading(false); return }

      setChatHistory(prev => [...prev, { role: 'assistant', content: reply }])

      const journal = parseJournalBlock(reply)
      if (journal) {
        setPendingJournal(journal)
        const clean = reply.replace(/\[JOURNAL_START\][\s\S]*?\[JOURNAL_END\]/, '').trim()
        if (clean) setDisplayMsgs(prev => [...prev, botMsg(clean)])
      } else {
        setDisplayMsgs(prev => [...prev, botMsg(reply)])
      }
    } catch (e) {
      setDisplayMsgs(prev => [...prev, botMsg(`抱歉，出了點問題：${e.message}`)])
    } finally {
      setLoading(false)
    }
  }

  // 存日誌到 Drive
  async function handleSaveJournal() {
    if (!pendingJournal) return
    setSavingJournal(true)
    try {
      await saveJournal(pendingJournal.date, pendingJournal.markdown)
      await syncJournalHighlights(pendingJournal.date, pendingJournal.markdown)
      setDisplayMsgs(prev => [...prev, botMsg(`好，${pendingJournal.date} 的日誌已存進 Drive 了！還有什麼嗎？`)])
      setPendingJournal(null)
      await loadContext()
    } catch (e) {
      setDisplayMsgs(prev => [...prev, botMsg(`儲存失敗：${e.message}`)])
    } finally {
      setSavingJournal(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* 狀態列 */}
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-400">
        <span className={contextReady ? 'text-green-600' : 'text-amber-500'}>
          {contextReady ? '● 日誌已載入' : '○ 載入中...'}
        </span>
        <span className="ml-auto">{MODEL}</span>
      </div>

      {/* 對話訊息 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin">
        {displayMsgs.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'bot' && <span className="text-lg mr-2 mt-0.5 shrink-0">🤖</span>}
            <div
              className={m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-bot'}
              style={{ whiteSpace: 'pre-wrap', maxWidth: '75%' }}
            >
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <span className="text-lg mr-2">🤖</span>
            <div className="chat-bubble-bot flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 日誌卡片 */}
      {pendingJournal && (
        <JournalCard
          journal={pendingJournal}
          onSave={handleSaveJournal}
          onDiscard={() => setPendingJournal(null)}
          saving={savingJournal}
        />
      )}

      {/* 輸入列 */}
      <div className="border-t border-slate-200 px-4 py-3 bg-white flex items-end gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="說說今天做了什麼..."
          rows={2}
          disabled={loading}
          className="flex-1 resize-none border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 disabled:bg-slate-50"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
