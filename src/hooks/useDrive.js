import { useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { FOLDER_ID, HIGHLIGHTS_FILE } from '../config'
import * as api from '../utils/driveApi'
import { parseJournalMd, parseHighlightsMd, buildHighlightsMd } from '../utils/journalUtils'

export function useDrive() {
  const { token } = useAuth()
  const folderId = FOLDER_ID
  const initializing = false

  // 儲存日誌：自動放到對應月份子資料夾
  const saveJournal = useCallback(async (date, content) => {
    if (!token) throw new Error('未登入')
    const yearMonth = date.slice(0, 7)
    const name = `工作日誌_${date}.md`
    const monthFolderId = await api.getOrCreateMonthFolder(token, folderId, yearMonth)
    const existing = await api.findJournalFile(token, folderId, date)
    return api.saveFile(token, monthFolderId, name, content, existing?.id)
  }, [token, folderId])

  // 讀取日誌：從月份子資料夾或根目錄（向下相容）
  const loadJournal = useCallback(async (date) => {
    if (!token) return null
    const file = await api.findJournalFile(token, folderId, date)
    if (!file) return null
    return api.readFile(token, file.id)
  }, [token, folderId])

  // 刪除日誌
  const deleteJournal = useCallback(async (date) => {
    if (!token) return
    const file = await api.findJournalFile(token, folderId, date)
    if (file) await api.deleteFile(token, file.id)
  }, [token, folderId])

  // 列出所有日誌（根目錄 + 所有月份子資料夾）
  const listJournals = useCallback(async () => {
    if (!token) return []
    return api.listAllJournalFiles(token, folderId)
  }, [token, folderId])

  // 讀取亮點匯整（存在根目錄）
  const loadHighlights = useCallback(async () => {
    if (!token) return null
    const file = await api.findFile(token, folderId, HIGHLIGHTS_FILE)
    if (!file) return null
    return api.readFile(token, file.id)
  }, [token, folderId])

  // 儲存亮點匯整（存在根目錄，每次覆蓋）
  const saveHighlights = useCallback(async (content) => {
    if (!token) throw new Error('未登入')
    const existing = await api.findFile(token, folderId, HIGHLIGHTS_FILE)
    return api.saveFile(token, folderId, HIGHLIGHTS_FILE, content, existing?.id)
  }, [token, folderId])

  // 儲存日誌後同步亮點：移除該日期的舊亮點，加入新亮點
  const syncJournalHighlights = useCallback(async (date, journalMd) => {
    if (!token) throw new Error('未登入')
    const parsed = parseJournalMd(journalMd)
    const existingFile = await api.findFile(token, folderId, HIGHLIGHTS_FILE).catch(() => null)
    const existingMd = existingFile ? await api.readFile(token, existingFile.id).catch(() => null) : null
    const existing = parseHighlightsMd(existingMd || '')
    const filtered = existing.filter(h => h.date !== date)
    const newOnes = parsed.highlights.map(h => ({ ...h, date }))
    const merged = [...filtered, ...newOnes].sort((a, b) => b.date.localeCompare(a.date))
    return api.saveFile(token, folderId, HIGHLIGHTS_FILE, buildHighlightsMd(merged), existingFile?.id)
  }, [token, folderId])

  return { folderId, initializing, saveJournal, loadJournal, deleteJournal, listJournals, loadHighlights, saveHighlights, syncJournalHighlights }
}
