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
        className={`description-wysiwyg ${className}`.trim()}
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
