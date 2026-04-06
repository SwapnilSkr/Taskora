import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { getFirebaseStorage } from '../lib/firebase'
import { saveAttachmentMeta } from './db'

export async function uploadTaskFile(
  uid: string,
  projectId: string,
  taskId: string,
  file: File,
): Promise<void> {
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
}
