import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { firstImageFromClipboard, markdownImageLine } from '@/utils/imagePaste'
import {
  taskEditorHtmlToMarkdown,
  taskMarkdownToEditorHtml,
} from '@/utils/tiptapMarkdown'

type Options = {
  /** Resolves the latest uploader without recreating the editor. */
  getUpload: () => (blob: Blob) => Promise<string>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    taskImagePaste: {
      /**
       * Append an image at the document end (e.g. file picker uses Firebase URL + alt).
       */
      appendTaskImageFromMarkdownLine: (line: string) => ReturnType
    }
  }
}

function parseImageLine(line: string): { alt: string; src: string } | null {
  const m = line.trim().match(/!\[([^\]]*)\]\(([^)]+)\)/)
  if (!m) return null
  return {
    alt: (m[1] || 'image').replaceAll('[', '').replaceAll(']', ''),
    src: m[2],
  }
}

export const TaskImagePaste = Extension.create<Options>({
  name: 'taskImagePaste',

  addOptions() {
    return {
      getUpload: () => async () => '',
    }
  },

  addCommands() {
    return {
      appendTaskImageFromMarkdownLine:
        (line: string) =>
        ({ commands, editor }) => {
          const parsed = parseImageLine(line)
          if (!parsed) return false
          let md = taskEditorHtmlToMarkdown(editor.getHTML())
          md =
            (md ? md + '\n\n' : '') +
            markdownImageLine(parsed.src, parsed.alt).trim()
          return commands.setContent(taskMarkdownToEditorHtml(md))
        },
    }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    const getUpload = this.options.getUpload

    return [
      new Plugin({
        props: {
          handlePaste(_view, event) {
            const blob = firstImageFromClipboard(event as ClipboardEvent)
            if (!blob) return false
            event.preventDefault()
            const blobUrl = URL.createObjectURL(blob)
            let md = taskEditorHtmlToMarkdown(editor.getHTML())
            md = (md ? md + '\n\n' : '') + markdownImageLine(blobUrl).trim()
            editor.commands.setContent(taskMarkdownToEditorHtml(md))

            const upload = getUpload()
            void (async () => {
              try {
                const url = await upload(blob)
                let next = taskEditorHtmlToMarkdown(editor.getHTML())
                next = next.includes(blobUrl)
                  ? next.replaceAll(blobUrl, url)
                  : next + markdownImageLine(url)
                editor.commands.setContent(taskMarkdownToEditorHtml(next))
              } catch {
                let revert = taskEditorHtmlToMarkdown(editor.getHTML())
                const line = markdownImageLine(blobUrl).trim()
                revert = revert
                  .replace(line, '')
                  .replace(/\n{3,}/g, '\n\n')
                  .trimEnd()
                editor.commands.setContent(taskMarkdownToEditorHtml(revert))
              } finally {
                URL.revokeObjectURL(blobUrl)
              }
            })()
            return true
          },
        },
      }),
    ]
  },
})
