import { HIGHLIGHT_CATEGORIES } from '../config'

export const toDateStr = (d = new Date()) => d.toISOString().split('T')[0]

export const journalFilename = (date) => `工作日誌_${date}.md`

export const dateFromFilename = (name) => name.replace('工作日誌_', '').replace('.md', '')

export function parseRelativeDate(text) {
  const t = text.trim()
  if (t === '今天') return toDateStr()
  if (t === '昨天') {
    const d = new Date(); d.setDate(d.getDate() - 1); return toDateStr(d)
  }
  if (t === '前天') {
    const d = new Date(); d.setDate(d.getDate() - 2); return toDateStr(d)
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/(\d{1,2})\/(\d{1,2})/)
  if (m) {
    const year = new Date().getFullYear()
    return `${year}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
  }
  return null
}

export function buildJournalMd(date, entries, highlights, tags) {
  let md = `# 工作日誌 ${date}\n\n`
  md += `## 今日工作紀錄\n`
  entries.forEach(e => { md += `- ${e}\n` })

  if (highlights.length > 0) {
    md += `\n## 履歷亮點故事\n`
    highlights.forEach(h => {
      md += `- 問題：${h.problem} | 解法：${h.solution} | 成效：${h.result} [分類:${h.category}]\n`
    })
  }

  if (tags.length > 0) {
    md += `\n## 關鍵字標籤\n${tags.join('、')}\n`
  }

  return md
}

export function parseJournalMd(content) {
  const result = { entries: [], highlights: [], tags: [] }
  if (!content) return result

  const lines = content.split('\n')
  let section = ''

  for (const line of lines) {
    if (line.startsWith('## 今日工作紀錄')) { section = 'entries'; continue }
    if (line.startsWith('## 履歷亮點故事')) { section = 'highlights'; continue }
    if (line.startsWith('## 關鍵字標籤')) { section = 'tags'; continue }
    if (line.startsWith('#')) { section = ''; continue }

    if (section === 'entries' && line.startsWith('- ')) {
      result.entries.push(line.slice(2).trim())
    }
    if (section === 'highlights' && line.startsWith('- ')) {
      const m = line.match(/問題：(.+?)\s*\|\s*解法：(.+?)\s*\|\s*成效：(.+?)(?:\s*\[分類:(.+?)\])?$/)
      if (m) result.highlights.push({ problem: m[1].trim(), solution: m[2].trim(), result: m[3].trim(), category: m[4]?.trim() || '其他' })
    }
    if (section === 'tags' && line.trim()) {
      result.tags = line.split('、').map(t => t.trim()).filter(Boolean)
    }
  }

  return result
}

export function buildHighlightsMd(allHighlights) {
  let md = '# 亮點匯整\n\n'
  const grouped = Object.fromEntries(HIGHLIGHT_CATEGORIES.map(c => [c, []]))

  for (const h of allHighlights) {
    const cat = h.category || '其他'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(h)
  }

  for (const [cat, items] of Object.entries(grouped)) {
    if (!items.length) continue
    md += `## ${cat}\n`
    items.forEach(h => {
      md += `- 問題：${h.problem} | 解法：${h.solution} | 成效：${h.result} [日期:${h.date}]\n`
    })
    md += '\n'
  }
  return md
}

export function parseHighlightsMd(content) {
  if (!content) return []
  const highlights = []
  let currentCat = ''
  for (const line of content.split('\n')) {
    if (line.startsWith('## ')) { currentCat = line.slice(3).trim(); continue }
    if (line.startsWith('- ')) {
      const m = line.match(/問題：(.+?)\s*\|\s*解法：(.+?)\s*\|\s*成效：(.+?)\s*\[日期:(.+?)\]/)
      if (m) highlights.push({ problem: m[1].trim(), solution: m[2].trim(), result: m[3].trim(), date: m[4].trim(), category: currentCat })
    }
  }
  return highlights
}

export function extractTags(entries) {
  const stopWords = new Set(['的', '了', '在', '是', '有', '和', '與', '或', '到', '從', '對', '為', '這', '那', '我', '他', '她', '它', '今天', '明天'])
  const words = entries.join(' ').match(/[一-鿿]{2,4}|[A-Z][a-z]+|[A-Z]{2,}/g) || []
  const freq = {}
  words.forEach(w => { if (!stopWords.has(w)) freq[w] = (freq[w] || 0) + 1 })
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w)
}
