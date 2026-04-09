import { Extension, type Editor } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'
import { Plugin } from '@tiptap/pm/state'
import { firstImageFromClipboard } from '@/utils/imagePaste'

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

export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Image failed to load'))
    img.src = url
  })
}

/**
 * After remote URL is ready: preload, then swap blob → https and clear uploading
 * so the skeleton hands off to a single smooth image fade (no mid-flight flash).
 */
export async function finalizeTaskImageUpload(
  editor: Editor,
  blobUrl: string,
  remoteUrl: string,
): Promise<boolean> {
  try {
    await preloadImage(remoteUrl)
  } catch {
    /* still commit URL — network/CDN may recover in the img element */
  }
  const { state } = editor
  const matches: { pos: number; node: PmNode }[] = []
  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'image' || node.attrs.src !== blobUrl) return
    matches.push({ pos, node })
  })
  if (matches.length === 0) return false
  const tr = state.tr
  for (const { pos, node } of matches.sort((a, b) => b.pos - a.pos)) {
    tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      src: remoteUrl,
      uploading: false,
    })
  }
  editor.view.dispatch(tr)
  return true
}

function removeImagesWithSrc(editor: Editor, src: string): boolean {
  const { state } = editor
  const ranges: { from: number; to: number }[] = []
  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'image' || node.attrs.src !== src) return
    ranges.push({ from: pos, to: pos + node.nodeSize })
  })
  if (ranges.length === 0) return false
  const tr = state.tr
  for (const { from, to } of ranges.sort((a, b) => b.from - a.from)) {
    tr.delete(from, to)
  }
  editor.view.dispatch(tr)
  return true
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
        ({ chain }) => {
          const parsed = parseImageLine(line)
          if (!parsed) return false
          const uploading = parsed.src.startsWith('blob:')
          return chain()
            .focus('end')
            .setImage({ src: parsed.src, alt: parsed.alt, uploading })
            .run()
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
            editor
              .chain()
              .focus()
              .setImage({ src: blobUrl, alt: 'image', uploading: true })
              .run()

            const upload = getUpload()
            void (async () => {
              try {
                const url = await upload(blob)
                await finalizeTaskImageUpload(editor, blobUrl, url)
              } catch {
                removeImagesWithSrc(editor, blobUrl)
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
