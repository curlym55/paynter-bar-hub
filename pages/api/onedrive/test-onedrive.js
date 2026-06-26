import { getAccessToken } from '../../../lib/onedrive'

export default async function handler(req, res) {
  try {
    const token = await getAccessToken()
    const folder = process.env.ONEDRIVE_FOLDER_PATH ?? 'NOT SET - using default'
    
    // Try to list the root to verify token works
    const rootRes = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const rootData = await rootRes.json()
    const rootFolders = (rootData.value || []).map(f => f.name)

    // Try to list the target folder
    const folderEncoded = (process.env.ONEDRIVE_FOLDER_PATH ?? '').split('/').map(encodeURIComponent).join('/')
    const folderRes = folderEncoded ? await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${folderEncoded}:/children`,
      { headers: { Authorization: `Bearer ${token}` } }
    ) : null
    const folderData = folderRes ? await folderRes.json() : null

    return res.json({
      ok: true,
      env_ONEDRIVE_FOLDER_PATH: folder,
      token_works: rootRes.ok,
      root_folders: rootFolders,
      target_folder_exists: folderRes?.ok ?? false,
      target_folder_error: folderData?.error?.message ?? null,
      target_folder_contents: folderRes?.ok ? (folderData.value || []).map(f => f.name) : null,
    })
  } catch (e) {
    return res.json({ ok: false, error: e.message })
  }
}