const MD_IMG =
  /!\[([^\]]*)\]\((https?:\/\/[^)]+|blob:[^)]+)\)/gi

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

/** Build safe HTML for a contenteditable description (text + inline imgs only). */
export function markdownToDescriptionHtml(markdown: string): string {
  if (!markdown) return ''
  const re = new RegExp(MD_IMG.source, 'gi')
  let out = ''
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(markdown)) !== null) {
    const textChunk = markdown.slice(last, m.index)
    out += escapeHtml(textChunk).replaceAll('\n', '<br />')
    const alt = m[1] || 'image'
    const src = m[2]
    if (
      src.startsWith('https://') ||
      src.startsWith('http://') ||
      src.startsWith('blob:')
    ) {
      out += `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" class="desc-wysiwyg-img" contenteditable="false" draggable="false" />`
    } else {
      out += escapeHtml(m[0])
    }
    last = m.index + m[0].length
  }
  out += escapeHtml(markdown.slice(last)).replaceAll('\n', '<br />')
  return out
}

/** Serialize editor DOM back to markdown (subset: text, br, imgs). */
export function descriptionHtmlToMarkdown(root: HTMLElement): string {
  let md = ''

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      md += node.textContent ?? ''
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const tag = el.tagName
    if (tag === 'BR') {
      md += '\n'
      return
    }
    if (tag === 'IMG') {
      const src = el.getAttribute('src') ?? ''
      const alt = el.getAttribute('alt') ?? 'image'
      const safeAlt = alt.replaceAll('[', '').replaceAll(']', '')
      if (
        src.startsWith('https://') ||
        src.startsWith('http://') ||
        src.startsWith('blob:')
      ) {
        md += `![${safeAlt}](${src})`
      }
      return
    }
    for (const c of el.childNodes) walk(c)
    if (tag === 'DIV') {
      const last = md.at(-1)
      if (last !== undefined && last !== '\n') md += '\n'
    }
  }

  for (const c of root.childNodes) walk(c)
  return md.replace(/\n{3,}/g, '\n\n').trimEnd()
}
