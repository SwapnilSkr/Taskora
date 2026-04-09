import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { cn } from '@/lib/utils'

marked.setOptions({ gfm: true, breaks: true })

type Props = {
  text: string
  className?: string
}

/**
 * Renders markdown (headings, lists, links, images, etc.) as sanitized HTML.
 * Stored comments/descriptions remain compatible with plain text and `![](...)` images.
 */
export function RichTextContent({ text, className }: Props) {
  if (!text.trim()) return null

  const raw = marked.parse(text.trim(), { async: false }) as string
  const html = DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'class'],
  })

  return (
    <div
      className={cn(
        'rich-text-content text-[13px] leading-relaxed text-foreground',
        '[&_h2]:mb-1.5 [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:tracking-tight',
        '[&_h3]:mb-1 [&_h3]:mt-1.5 [&_h3]:text-[13px] [&_h3]:font-semibold',
        '[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
        '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_li]:my-0.5',
        '[&_a]:font-medium [&_a]:text-share [&_a]:underline [&_a]:decoration-share/50 [&_a]:underline-offset-2',
        '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-share/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_code]:rounded [&_code]:bg-muted/80 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]',
        '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border/50 [&_pre]:bg-muted/30 [&_pre]:p-2 [&_pre]:text-[12px]',
        '[&_hr]:my-3 [&_hr]:border-border/55',
        '[&_img]:my-2 [&_img]:block [&_img]:max-h-[240px] [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-border/55 [&_img]:object-contain',
        '[&_strong]:font-semibold',
        'wrap-break-word',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
