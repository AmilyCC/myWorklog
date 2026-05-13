const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

async function req(url, opts, token) {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...opts?.headers },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Drive API ${res.status}: ${text}`)
  }
  return res
}

// 取得或建立月份子資料夾，例如 "2026-05"
export async function getOrCreateMonthFolder(token, rootId, yearMonth) {
  const q = `name='${yearMonth}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const res = await req(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)`, {}, token)
  const { files } = await res.json()
  if (files.length > 0) return files[0].id

  const r = await req(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: yearMonth,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootId],
    }),
  }, token)
  return (await r.json()).id
}

// 找特定日期的日誌檔：先找月份子資料夾，找不到再找根目錄（向下相容）
export async function findJournalFile(token, rootId, date) {
  const yearMonth = date.slice(0, 7)
  const name = `工作日誌_${date}.md`

  // 1. 找月份子資料夾
  const folderQ = `name='${yearMonth}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const folderRes = await req(`${DRIVE_API}/files?q=${encodeURIComponent(folderQ)}&fields=files(id)`, {}, token)
  const { files: folders } = await folderRes.json()

  if (folders.length > 0) {
    const folderId = folders[0].id
    const fileQ = `name='${name}' and '${folderId}' in parents and trashed=false`
    const fileRes = await req(`${DRIVE_API}/files?q=${encodeURIComponent(fileQ)}&fields=files(id,name)`, {}, token)
    const { files } = await fileRes.json()
    if (files.length > 0) return { ...files[0], parentFolderId: folderId }
  }

  // 2. fallback：根目錄
  const rootQ = `name='${name}' and '${rootId}' in parents and trashed=false`
  const rootRes = await req(`${DRIVE_API}/files?q=${encodeURIComponent(rootQ)}&fields=files(id,name)`, {}, token)
  const { files: rootFiles } = await rootRes.json()
  if (rootFiles.length > 0) return { ...rootFiles[0], parentFolderId: rootId }

  return null
}

// 列出根目錄＋所有月份子資料夾內的日誌檔
export async function listAllJournalFiles(token, rootId) {
  const all = []

  // 根目錄的日誌檔（舊格式 / 未分類）
  const rootQ = `'${rootId}' in parents and name contains '工作日誌_' and mimeType!='application/vnd.google-apps.folder' and trashed=false`
  const rootRes = await req(`${DRIVE_API}/files?q=${encodeURIComponent(rootQ)}&fields=files(id,name,modifiedTime)&pageSize=500`, {}, token)
  const { files: rootFiles } = await rootRes.json()
  all.push(...rootFiles)

  // 列出所有子資料夾
  const subQ = `'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const subRes = await req(`${DRIVE_API}/files?q=${encodeURIComponent(subQ)}&fields=files(id,name)&pageSize=100`, {}, token)
  const { files: subFolders } = await subRes.json()

  // 每個子資料夾內的日誌檔
  await Promise.all(subFolders.map(async (folder) => {
    const q = `'${folder.id}' in parents and name contains '工作日誌_' and trashed=false`
    const res = await req(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&pageSize=500`, {}, token)
    const { files } = await res.json()
    all.push(...files)
  }))

  // 依檔名（日期）排序，新到舊
  return all.sort((a, b) => b.name.localeCompare(a.name))
}

export async function findFile(token, folderId, name) {
  const q = `name='${name}' and '${folderId}' in parents and trashed=false`
  const res = await req(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)`, {}, token)
  const { files } = await res.json()
  return files[0] ?? null
}

export async function readFile(token, fileId) {
  const res = await req(`${DRIVE_API}/files/${fileId}?alt=media`, {}, token)
  return res.text()
}

export async function saveFile(token, folderId, name, content, existingId = null) {
  const meta = existingId ? { name } : { name, parents: [folderId] }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
  form.append('media', new Blob([content], { type: 'text/markdown; charset=utf-8' }))

  const url = existingId
    ? `${UPLOAD_API}/files/${existingId}?uploadType=multipart`
    : `${UPLOAD_API}/files?uploadType=multipart`

  const res = await req(url, { method: existingId ? 'PATCH' : 'POST', body: form }, token)
  return res.json()
}

export async function deleteFile(token, fileId) {
  await req(`${DRIVE_API}/files/${fileId}`, { method: 'DELETE' }, token)
}
