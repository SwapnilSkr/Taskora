import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { getFirebaseStorage } from '../lib/firebase'
import { saveAttachmentMeta } from './db'

export async function uploadTaskFile(
  uid: string,
  projectId: string,
  taskId: string,
  file: File,
): Promise<string> {
  const safeName = file.name.replace(/[^\w.\-()+ ]/g, '_')
  const path = `users/${uid}/projects/${projectId}/tasks/${taskId}/${Date.now()}_${safeName}`
  const r = ref(getFirebaseStorage(), path)
  await uploadBytes(r, file, { contentType: file.type || undefined })
  const url = await getDownloadURL(r)
  await saveAttachmentMeta(uid, projectId, taskId, {
    name: file.name,
    size: file.size,
    contentType: file.type || null,
    storagePath: path,
    downloadURL: url,
  })
  return url
}

function extForImageMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/svg+xml') return 'svg'
  return 'png'
}

/** Upload pasted or dropped image bytes; writes attachment doc like file upload. Returns download URL. */
export async function uploadTaskImageBlob(
  uid: string,
  projectId: string,
  taskId: string,
  blob: Blob,
  filenameHint: string,
): Promise<string> {
  const mime = blob.type && blob.type.startsWith('image/')
    ? blob.type
    : 'image/png'
  const ext = extForImageMime(mime)
  const base =
    filenameHint.replace(/[^\w.\-()+ ]/g, '_').replace(/\.[^.]+$/, '') ||
    'image'
  const name = `${base}.${ext}`
  const path = `users/${uid}/projects/${projectId}/tasks/${taskId}/${Date.now()}_${name}`
  const storage = getFirebaseStorage()
  const r = ref(storage, path)
  await uploadBytes(r, blob, { contentType: mime })
  const url = await getDownloadURL(r)
  await saveAttachmentMeta(uid, projectId, taskId, {
    name,
    size: blob.size,
    contentType: mime,
    storagePath: path,
    downloadURL: url,
  })
  return url
}
