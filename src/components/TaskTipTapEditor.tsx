import type { Editor } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import { TaskImagePaste } from '@/extensions/taskImagePaste'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  taskEditorHtmlToMarkdown,
  taskMarkdownToEditorHtml,
} from '@/utils/tiptapMarkdown'

export type TaskTipTapEditorRef = {
  appendImageMarkdown: (markdownLine: string) => void
  /** Replace a URL substring in stored markdown (e.g. swap `blob:` for Firebase after upload). */
  replaceMarkdownUrl: (fromUrl: string, toUrl: string) => void
  /** Empty the editor and notify parent (works while focused). */
  clearDocument: () => void
}

type Props = {
  markdown: string
  onMarkdownChange: (next: string) => void
  /** When this changes (e.g. task id), content resets from `markdown`. */
  documentKey?: string
  disabled?: boolean
  placeholder?: string
  className?: string
  /** Shell classes (border, background). Editor chrome is nested inside. */
  wrapperClassName?: string
  onPasteImageBlob: (blob: Blob) => Promise<string>
  /**
   * Debounce before calling `onMarkdownChange`. Use `0` for comments (instant React state).
   */
  debounceMs?: number
  /** Shorter min-height for comment composer. */
  minEditorHeightClass?: string
}

const TOOLBAR_BTN =
  'h-8 w-8 shrink-0 rounded-md p-0 text-muted-foreground hover:bg-muted/80 hover:text-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground'

export const TaskTipTapEditor = forwardRef<TaskTipTapEditorRef, Props>(
  function TaskTipTapEditor(
    {
      markdown,
      onMarkdownChange,
      documentKey,
      disabled = false,
      placeholder = 'Write something…',
      className = '',
      wrapperClassName,
      onPasteImageBlob,
      debounceMs = 320,
      minEditorHeightClass = 'min-h-[120px]',
    },
    ref,
  ) {
    const uploadRef = useRef(onPasteImageBlob)
    useEffect(() => {
      uploadRef.current = onPasteImageBlob
    }, [onPasteImageBlob])

    const placeholderRef = useRef(placeholder)
    useEffect(() => {
      placeholderRef.current = placeholder
    }, [placeholder])

    const editorRef = useRef<Editor | null>(null)
    const lastEmitted = useRef(markdown)
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined,
    )
    const docKeyRef = useRef(documentKey)

    const emitMarkdown = useCallback(
      (editor: Editor) => {
        const next = taskEditorHtmlToMarkdown(editor.getHTML())
        if (next === lastEmitted.current) return
        lastEmitted.current = next
        onMarkdownChange(next)
      },
      [onMarkdownChange],
    )

    const flushDebounced = useCallback(() => {
      const ed = editorRef.current
      if (!ed) return
      emitMarkdown(ed)
    }, [emitMarkdown])

    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: {
            class:
              'font-medium text-share underline decoration-share/50 underline-offset-2 hover:decoration-share',
          },
        }),
        Image.configure({
          inline: false,
          allowBase64: false,
          HTMLAttributes: {
            class:
              'my-2 block max-h-[220px] max-w-full rounded-lg border border-border/60 object-contain',
          },
        }),
        // eslint-disable-next-line react-hooks/refs -- placeholder ref read when ProseMirror decorates, not during render
        Placeholder.configure({
          /**
           * Show the hint only when the whole document is empty. Otherwise empty
           * paragraphs (e.g. after an image) would repeat the same label.
           */
          placeholder: ({ editor }) =>
            editor.isEmpty ? placeholderRef.current : '',
          emptyEditorClass: 'is-editor-empty',
          emptyNodeClass: 'is-empty',
          showOnlyWhenEditable: true,
          showOnlyCurrent: true,
        }),
        // eslint-disable-next-line react-hooks/refs -- getUpload runs on clipboard paste only
        TaskImagePaste.configure({
          getUpload: () => uploadRef.current,
        }),
      ],
      content: taskMarkdownToEditorHtml(markdown),
      editable: !disabled,
      editorProps: {
        attributes: {
          class: cn(
            'task-tiptap-editor max-w-none px-3 py-2.5 text-[13px] leading-relaxed text-foreground outline-none',
            minEditorHeightClass,
            '[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight',
            '[&_h3]:mb-1.5 [&_h3]:mt-2 [&_h3]:text-[13px] [&_h3]:font-semibold',
            '[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
            '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
            '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
            '[&_li]:my-0.5',
            '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-share/50 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
            '[&_hr]:my-3 [&_hr]:border-border/60',
            '[&_pre]:my-2 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border/50 [&_pre]:bg-muted/40 [&_pre]:p-3 [&_pre]:text-[12px]',
            '[&_code]:rounded-md [&_code]:bg-muted/90 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]',
            '[&_strong]:font-semibold',
            '[&_a]:break-all',
          ),
        },
      },
      onUpdate: ({ editor: ed }) => {
        if (debounceMs <= 0) {
          emitMarkdown(ed)
          return
        }
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(() => {
          debounceTimer.current = undefined
          emitMarkdown(ed)
        }, debounceMs)
      },
    })

    useEffect(() => {
      editorRef.current = editor
    }, [editor])

    useEffect(
      () => () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
      },
      [],
    )

    useEffect(() => {
      if (!editor) return
      editor.setEditable(!disabled)
    }, [editor, disabled])

    useEffect(() => {
      if (!editor) return
      const keyChanged = docKeyRef.current !== documentKey
      docKeyRef.current = documentKey
      if (keyChanged) {
        lastEmitted.current = markdown
        editor.commands.setContent(taskMarkdownToEditorHtml(markdown), {
          emitUpdate: false,
        })
        return
      }
      if (editor.isFocused) return
      const cur = taskEditorHtmlToMarkdown(editor.getHTML())
      if (cur === markdown) return
      lastEmitted.current = markdown
      editor.commands.setContent(taskMarkdownToEditorHtml(markdown), {
        emitUpdate: false,
      })
    }, [editor, documentKey, markdown])

    useImperativeHandle(
      ref,
      () => ({
        appendImageMarkdown: (line: string) => {
          editor
            ?.chain()
            .focus()
            .appendTaskImageFromMarkdownLine(line)
            .run()
        },
        replaceMarkdownUrl: (fromUrl: string, toUrl: string) => {
          if (!editor) return
          let md = taskEditorHtmlToMarkdown(editor.getHTML())
          if (!md.includes(fromUrl)) return
          md = md.replaceAll(fromUrl, toUrl)
          lastEmitted.current = md
          onMarkdownChange(md)
          editor.commands.setContent(taskMarkdownToEditorHtml(md), {
            emitUpdate: false,
          })
        },
        clearDocument: () => {
          if (!editor) return
          lastEmitted.current = ''
          onMarkdownChange('')
          editor.commands.clearContent()
        },
      }),
      [editor, onMarkdownChange],
    )

    const setLink = useCallback(() => {
      if (!editor) return
      const prev = editor.getAttributes('link').href as string | undefined
      const url = window.prompt('Link URL', prev ?? 'https://')
      if (url === null) return
      const t = url.trim()
      if (t === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run()
        return
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: t }).run()
    }, [editor])

    if (!editor) {
      return (
        <div
          className={cn(
            'rounded-lg border border-border/70 bg-muted/20',
            minEditorHeightClass,
            className,
            wrapperClassName,
          )}
        />
      )
    }

    return (
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-border/70 bg-background shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-foreground/4 transition-[box-shadow,border-color] dark:bg-background/85 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] dark:ring-white/6',
          'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25',
          className,
          wrapperClassName,
        )}
      >
        <div
          role="toolbar"
          aria-label="Formatting"
          className="flex flex-wrap items-center gap-0.5 border-b border-border/50 bg-muted/25 px-2 py-1.5 dark:bg-muted/15"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOOLBAR_BTN}
            data-active={editor.isActive('bold')}
            aria-pressed={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={disabled}
            title="Bold"
          >
            <Bold className="size-4" strokeWidth={2.25} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOOLBAR_BTN}
            data-active={editor.isActive('italic')}
            aria-pressed={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={disabled}
            title="Italic"
          >
            <Italic className="size-4" strokeWidth={2.25} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOOLBAR_BTN}
            data-active={editor.isActive('underline')}
            aria-pressed={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            disabled={disabled}
            title="Underline"
          >
            <UnderlineIcon className="size-4" strokeWidth={2.25} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOOLBAR_BTN}
            data-active={editor.isActive('strike')}
            aria-pressed={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            disabled={disabled}
            title="Strikethrough"
          >
            <Strikethrough className="size-4" strokeWidth={2.25} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOOLBAR_BTN}
            data-active={editor.isActive('code')}
            aria-pressed={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}
            disabled={disabled}
            title="Inline code"
          >
            <Code className="size-4" strokeWidth={2.25} />
          </Button>
          <span className="mx-0.5 hidden h-5 w-px bg-border/70 sm:inline" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOOLBAR_BTN}
            data-active={editor.isActive('heading', { level: 2 })}
            aria-pressed={editor.isActive('heading', { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            disabled={disabled}
            title="Heading"
          >
            <Heading2 className="size-4" strokeWidth={2.25} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOOLBAR_BTN}
            data-active={editor.isActive('bulletList')}
            aria-pressed={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            disabled={disabled}
            title="Bullet list"
          >
            <List className="size-4" strokeWidth={2.25} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOOLBAR_BTN}
            data-active={editor.isActive('orderedList')}
            aria-pressed={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            disabled={disabled}
            title="Numbered list"
          >
            <ListOrdered className="size-4" strokeWidth={2.25} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOOLBAR_BTN}
            data-active={editor.isActive('blockquote')}
            aria-pressed={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            disabled={disabled}
            title="Quote"
          >
            <Quote className="size-4" strokeWidth={2.25} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOOLBAR_BTN}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            disabled={disabled}
            title="Divider"
          >
            <Minus className="size-4" strokeWidth={2.25} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOOLBAR_BTN}
            data-active={editor.isActive('link')}
            aria-pressed={editor.isActive('link')}
            onClick={setLink}
            disabled={disabled}
            title="Link"
          >
            <Link2 className="size-4" strokeWidth={2.25} />
          </Button>
          <span className="mx-0.5 hidden h-5 w-px bg-border/70 sm:inline" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOOLBAR_BTN}
            onClick={() => editor.chain().focus().undo().run()}
            disabled={disabled || !editor.can().undo()}
            title="Undo"
          >
            <Undo2 className="size-4" strokeWidth={2.25} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOOLBAR_BTN}
            onClick={() => editor.chain().focus().redo().run()}
            disabled={disabled || !editor.can().redo()}
            title="Redo"
          >
            <Redo2 className="size-4" strokeWidth={2.25} />
          </Button>
        </div>

        <BubbleMenu
          editor={editor}
          options={{
            placement: 'top',
            offset: 8,
          }}
          className="flex items-center gap-0.5 rounded-xl border border-border/80 bg-popover/95 px-1 py-1 shadow-lg shadow-black/10 backdrop-blur-md dark:shadow-black/40"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOOLBAR_BTN}
            data-active={editor.isActive('bold')}
            aria-pressed={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold className="size-4" strokeWidth={2.25} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOOLBAR_BTN}
            data-active={editor.isActive('italic')}
            aria-pressed={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic className="size-4" strokeWidth={2.25} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOOLBAR_BTN}
            data-active={editor.isActive('link')}
            aria-pressed={editor.isActive('link')}
            onClick={setLink}
            title="Link"
          >
            <Link2 className="size-4" strokeWidth={2.25} />
          </Button>
        </BubbleMenu>

        <EditorContent
          editor={editor}
          className="max-h-[min(420px,50vh)] overflow-y-auto"
          onBlur={() => {
            if (debounceMs <= 0) return
            if (debounceTimer.current) {
              clearTimeout(debounceTimer.current)
              debounceTimer.current = undefined
            }
            flushDebounced()
          }}
        />
      </div>
    )
  },
)
