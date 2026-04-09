import DOMPurify from 'dompurify'
import { marked } from 'marked'
import TurndownService from 'turndown'

marked.setOptions({ gfm: true, breaks: true })

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
})

turndown.addRule('strikethrough', {
  filter(node) {
    return ['DEL', 'S', 'STRIKE'].includes(node.nodeName)
  },
  replacement(content) {
    return '~~' + content + '~~'
  },
})

turndown.addRule('underlineTag', {
  filter: 'u',
  replacement(content) {
    return '<u>' + content + '</u>'
  },
})

/** Markdown stored in Firestore → safe HTML for TipTap `setContent`. */
export function taskMarkdownToEditorHtml(markdown: string): string {
  if (!markdown.trim()) return '<p></p>'
  const raw = marked.parse(markdown, { async: false }) as string
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'class'],
  })
}

/** TipTap / ProseMirror HTML → markdown for persistence and RichTextContent. */
export function taskEditorHtmlToMarkdown(html: string): string {
  if (!html || html === '<p></p>') return ''
  return turndown.turndown(html).replace(/\n{3,}/g, '\n\n').trimEnd()
}
