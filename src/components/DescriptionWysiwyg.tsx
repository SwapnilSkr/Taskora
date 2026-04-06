import clsx from 'clsx'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react'
import {
  descriptionHtmlToMarkdown,
  markdownToDescriptionHtml,
} from '../utils/descriptionMarkdownHtml'
import { firstImageFromClipboard, markdownImageLine } from '../utils/imagePaste'

export type DescriptionWysiwygRef = {
  /** Append markdown for a new image (e.g. file picker) and persist via onMarkdownChange. */
  appendImageMarkdown: (markdownLine: string) => void
}

type Props = {
  markdown: string
  onMarkdownChange: (next: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  onPasteImageBlob: (blob: Blob) => Promise<string>
}

function insertPlainTextAtSelection(root: HTMLElement, text: string) {
  const sel = window.getSelection()
  if (!sel?.rangeCount) return
  const r = sel.getRangeAt(0)
  if (!root.contains(r.commonAncestorContainer)) return
  r.deleteContents()
  const tn = document.createTextNode(text)
  r.insertNode(tn)
  r.setStartAfter(tn)
  r.collapse(true)
  sel.removeAllRanges()
  sel.addRange(r)
  root.dispatchEvent(new InputEvent('input', { bubbles: true }))
}

export const DescriptionWysiwyg = forwardRef<DescriptionWysiwygRef, Props>(
  function DescriptionWysiwyg(
    {
      markdown,
      onMarkdownChange,
      disabled,
      placeholder = 'What is this task about?',
      className = '',
      onPasteImageBlob,
    },
    ref,
  ) {
    const elRef = useRef<HTMLDivElement>(null)
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined,
    )
    const lastEmitted = useRef(markdown)

    const flushMarkdown = useCallback(() => {
      const el = elRef.current
      if (!el) return
      const next = descriptionHtmlToMarkdown(el)
      if (next === lastEmitted.current) return
      lastEmitted.current = next
      onMarkdownChange(next)
    }, [onMarkdownChange])

    const scheduleFlush = useCallback(() => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = undefined
        flushMarkdown()
      }, 320)
    }, [flushMarkdown])

    useImperativeHandle(
      ref,
      () => ({
        appendImageMarkdown: (line: string) => {
          const el = elRef.current
          if (!el) return
          const md = descriptionHtmlToMarkdown(el) + line
          lastEmitted.current = md
          el.innerHTML = markdownToDescriptionHtml(md)
          onMarkdownChange(md)
        },
      }),
      [onMarkdownChange],
    )

    useLayoutEffect(() => {
      const el = elRef.current
      if (!el) return
      if (document.activeElement === el) return
      const domMd = descriptionHtmlToMarkdown(el)
      if (domMd === markdown) return
      lastEmitted.current = markdown
      el.innerHTML = markdownToDescriptionHtml(markdown)
    }, [markdown])

    useEffect(
      () => () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
      },
      [],
    )

    return (
      <div
        ref={elRef}
        className={clsx(
          'min-h-[120px] max-h-[420px] w-full resize-y overflow-y-auto rounded-card border border-border bg-app px-3 py-2 text-[13px] leading-[1.45] text-fg outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] focus:border-share focus:shadow-[0_0_0_1px_rgba(90,159,212,0.25)] [&_.desc-wysiwyg-img]:my-2 [&_.desc-wysiwyg-img]:block [&_.desc-wysiwyg-img]:max-h-[220px] [&_.desc-wysiwyg-img]:max-w-full [&_.desc-wysiwyg-img]:rounded-lg [&_.desc-wysiwyg-img]:border [&_.desc-wysiwyg-img]:border-border-subtle [&_.desc-wysiwyg-img]:object-contain',
          className,
        )}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-placeholder={placeholder}
        data-placeholder={placeholder}
        onInput={scheduleFlush}
        onBlur={() => {
          if (debounceTimer.current) {
            clearTimeout(debounceTimer.current)
            debounceTimer.current = undefined
          }
          flushMarkdown()
        }}
        onPaste={(e) => {
          const blob = firstImageFromClipboard(e.nativeEvent)
          if (blob) {
            e.preventDefault()
            const blobUrl = URL.createObjectURL(blob)
            const el = elRef.current
            if (!el) {
              URL.revokeObjectURL(blobUrl)
              return
            }
            const withBlob =
              descriptionHtmlToMarkdown(el) + markdownImageLine(blobUrl)
            lastEmitted.current = withBlob
            el.innerHTML = markdownToDescriptionHtml(withBlob)
            const mdBeforePaste = descriptionHtmlToMarkdown(el)
            void (async () => {
              try {
                const url = await onPasteImageBlob(blob)
                const cur = descriptionHtmlToMarkdown(elRef.current!)
                const finalMd = cur.includes(blobUrl)
                  ? cur.replaceAll(blobUrl, url)
                  : cur + markdownImageLine(url)
                lastEmitted.current = finalMd
                if (elRef.current) {
                  elRef.current.innerHTML = markdownToDescriptionHtml(finalMd)
                }
                onMarkdownChange(finalMd)
              } catch {
                lastEmitted.current = mdBeforePaste
                if (elRef.current) {
                  elRef.current.innerHTML =
                    markdownToDescriptionHtml(mdBeforePaste)
                }
                onMarkdownChange(mdBeforePaste)
              } finally {
                URL.revokeObjectURL(blobUrl)
              }
            })()
            return
          }
          e.preventDefault()
          const text = e.clipboardData?.getData('text/plain') ?? ''
          insertPlainTextAtSelection(elRef.current!, text)
          scheduleFlush()
        }}
      />
    )
  },
)
