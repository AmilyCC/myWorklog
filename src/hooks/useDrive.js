import { useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { FOLDER_ID, HIGHLIGHTS_FILE } from '../config'
import * as api from '../utils/driveApi'
import { parseJournalMd, parseHighlightsMd, buildHighlightsMd } from '../utils/journalUtils'

export function useDrive() {
  const { token, reauth } = useAuth()
  const folderId = FOLDER_ID
  const initializing = false

  const guard = useCallback(async (fn) => {
    try { return await fn() }
    catch (e) { if (e.isScopeError) reauth(); throw e }
  }, [reauth])

  const saveJournal = useCallback(async (date, content) => guard(async () => {
    if (!token) throw new Error('未登入')
    const yearMonth = date.slice(0, 7)
    const name = `工作日誌_${date}.md`
    const monthFolderId = await api.getOrCreateMonthFolder(token, folderId, yearMonth)
    const existing = await api.findJournalFile(token, folderId, date)
    return api.saveFile(token, monthFolderId, name, content, existing?.id)
  }), [token, folderId, guard])

  const loadJournal = useCallback(async (date) => guard(async () => {
    if (!token) return null
    const file = await api.findJournalFile(token, folderId, date)
    if (!file) return null
    return api.readFile(token, file.id)
  }), [token, folderId, guard])

  const deleteJournal = useCallback(async (date) => guard(async () => {
    if (!token) return
    const file = await api.findJournalFile(token, folderId, date)
    if (file) await api.deleteFile(token, file.id)
  }), [token, folderId, guard])

  const listJournals = useCallback(async () => guard(async () => {
    if (!token) return []
    return api.listAllJournalFiles(token, folderId)
  }), [token, folderId, guard])

  const loadHighlights = useCallback(async () => guard(async () => {
    if (!token) return null
    const file = await api.findFile(token, folderId, HIGHLIGHTS_FILE)
    if (!file) return null
    return api.readFile(token, file.id)
  }), [token, folderId, guard])

  const saveHighlights = useCallback(async (content) => guard(async () => {
    if (!token) throw new Error('未登入')
    const existing = await api.findFile(token, folderId, HIGHLIGHTS_FILE)
    return api.saveFile(token, folderId, HIGHLIGHTS_FILE, content, existing?.id)
  }), [token, folderId, guard])

  const syncJournalHighlights = useCallback(async (date, journalMd) => guard(async () => {
    if (!token) throw new Error('未登入')
    const parsed = parseJournalMd(journalMd)
    const existingFile = await api.findFile(token, folderId, HIGHLIGHTS_FILE).catch(() => null)
    const existingMd = existingFile ? await api.readFile(token, existingFile.id).catch(() => null) : null
    const existing = parseHighlightsMd(existingMd || '')
    const filtered = existing.filter(h => h.date !== date)
    const newOnes = parsed.highlights.map(h => ({ ...h, date }))
    const merged = [...filtered, ...newOnes].sort((a, b) => b.date.localeCompare(a.date))
    return api.saveFile(token, folderId, HIGHLIGHTS_FILE, buildHighlightsMd(merged), existingFile?.id)
  }), [token, folderId, guard])

  return { folderId, initializing, saveJournal, loadJournal, deleteJournal, listJournals, loadHighlights, saveHighlights, syncJournalHighlights }
}
