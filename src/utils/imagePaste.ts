/** `blob:` allowed for in-browser preview before upload finishes; omitted from Storage cleanup. */
const MD_IMAGE = /!\[([^\]]*)\]\((https?:\/\/[^)]+|blob:[^)]+)\)/gi

/** Normalize a download URL for stable matching (auth tokens, encoding). */
export function normalizeDownloadUrl(url: string): string {
  const t = url.trim()
  if (t.startsWith('blob:')) return t
  try {
    return new URL(t).href
  } catch {
    return t
  }
}

/** Every distinct raw `https://...` URL inside markdown images in `text`. */
export function extractMarkdownImageUrls(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const re = new RegExp(MD_IMAGE.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const raw = m[2]
    if (raw.startsWith('blob:')) continue
    const n = normalizeDownloadUrl(raw)
    if (seen.has(n)) continue
    seen.add(n)
    out.push(raw)
  }
  return out
}

/** Remove markdown image tokens whose URL matches `targetUrl` (after normalize). */
export function removeMarkdownImagesWithUrl(text: string, targetUrl: string): string {
  const target = normalizeDownloadUrl(targetUrl)
  const re = new RegExp(MD_IMAGE.source, 'gi')
  return text
    .replace(re, (full, _alt, url) =>
      normalizeDownloadUrl(url) === target ? '' : full,
    )
    .replace(/\n{3,}/g, '\n\n')
}

/** Markdown line for an image URL stored in Firebase (or any https URL). */
export function markdownImageLine(url: string, alt = 'image'): string {
  const safeAlt = alt.replaceAll('[', '').replaceAll(']', '')
  return `\n![${safeAlt}](${url})\n`
}

/** True if text contains at least one markdown image with http(s) URL. */
export function textHasMarkdownImages(text: string): boolean {
  return /!\[[^\]]*\]\((https?:\/\/[^)]+|blob:[^)]+)\)/i.test(text)
}

/** First image in clipboard data from a paste event, or null. */
export function firstImageFromClipboard(e: ClipboardEvent): Blob | null {
  const items = e.clipboardData?.items
  if (!items?.length) return null
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile()
      if (f) return f
    }
  }
  return null
}
