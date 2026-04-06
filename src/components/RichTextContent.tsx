import type { ReactNode } from 'react'

/** Match embedded images (https and temporary `blob:` previews in composers). */
const IMG_RE =
  /!\[([^\]]*)\]\((https?:\/\/[^)]+|blob:[^)]+)\)/g

type Props = {
  text: string
  className?: string
}

/** Renders plain text with markdown-style images `![alt](https://...)`. Only https/http URLs are shown. */
export function RichTextContent({ text, className }: Props) {
  if (!text.trim()) return null

  const nodes: ReactNode[] = []
  let last = 0
  const re = new RegExp(IMG_RE.source, 'g')
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(
        <span key={key++}>{text.slice(last, m.index)}</span>,
      )
    }
    const alt = m[1] || 'image'
    const src = m[2]
    const isBlob = src.startsWith('blob:')
    nodes.push(
      isBlob ? (
        <span key={key++} className="rich-inline-img-link rich-inline-img-blob">
          <img src={src} alt={alt} className="rich-inline-img" decoding="async" />
        </span>
      ) : (
        <a
          key={key++}
          href={src}
          target="_blank"
          rel="noreferrer"
          className="rich-inline-img-link"
        >
          <img src={src} alt={alt} className="rich-inline-img" decoding="async" />
        </a>
      ),
    )
    last = m.index + m[0].length
  }
  if (last < text.length) {
    nodes.push(<span key={key++}>{text.slice(last)}</span>)
  }

  return (
    <div
      className={className}
      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
    >
      {nodes}
    </div>
  )
}
