import { useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { FOLDER_ID, HIGHLIGHTS_FILE } from '../config'
import * as api from '../utils/driveApi'
import { parseJournalMd, parseHighlightsMd, buildHighlightsMd } from '../utils/journalUtils'

export function useDrive() {
  const { reauth, ensureToken } = useAuth()
  const folderId = FOLDER_ID
  const initializing = false

  const guard = useCallback(async (fn) => {
    try {
      const tok = await ensureToken()
      return await fn(tok)
    } catch (e) {
      if (e.isScopeError) { reauth(); throw e }
      throw e
    }
  }, [reauth, ensureToken])

  const saveJournal = useCallback((date, content) => guard(async (tok) => {
    const yearMonth = date.slice(0, 7)
    const name = `工作日誌_${date}.md`
    const monthFolderId = await api.getOrCreateMonthFolder(tok, folderId, yearMonth)
    const existing = await api.findJournalFile(tok, folderId, date)
    return api.saveFile(tok, monthFolderId, name, content, existing?.id)
  }), [folderId, guard])

  const loadJournal = useCallback((date) => guard(async (tok) => {
    const file = await api.findJournalFile(tok, folderId, date)
    if (!file) return null
    return api.readFile(tok, file.id)
  }), [folderId, guard])

  const deleteJournal = useCallback((date) => guard(async (tok) => {
    const file = await api.findJournalFile(tok, folderId, date)
    if (file) await api.deleteFile(tok, file.id)
  }), [folderId, guard])

  const listJournals = useCallback(() => guard(async (tok) => {
    return api.listAllJournalFiles(tok, folderId)
  }), [folderId, guard])

  const loadHighlights = useCallback(() => guard(async (tok) => {
    const file = await api.findFile(tok, folderId, HIGHLIGHTS_FILE)
    if (!file) return null
    return api.readFile(tok, file.id)
  }), [folderId, guard])

  const saveHighlights = useCallback((content) => guard(async (tok) => {
    const existing = await api.findFile(tok, folderId, HIGHLIGHTS_FILE)
    return api.saveFile(tok, folderId, HIGHLIGHTS_FILE, content, existing?.id)
  }), [folderId, guard])

  const syncJournalHighlights = useCallback((date, journalMd) => guard(async (tok) => {
    const parsed = parseJournalMd(journalMd)
    const existingFile = await api.findFile(tok, folderId, HIGHLIGHTS_FILE).catch(() => null)
    const existingMd = existingFile ? await api.readFile(tok, existingFile.id).catch(() => null) : null
    const existing = parseHighlightsMd(existingMd || '')
    const filtered = existing.filter(h => h.date !== date)
    const newOnes = parsed.highlights.map(h => ({ ...h, date }))
    const merged = [...filtered, ...newOnes].sort((a, b) => b.date.localeCompare(a.date))
    return api.saveFile(tok, folderId, HIGHLIGHTS_FILE, buildHighlightsMd(merged), existingFile?.id)
  }), [folderId, guard])

  return { folderId, initializing, saveJournal, loadJournal, deleteJournal, listJournals, loadHighlights, saveHighlights, syncJournalHighlights }
}
