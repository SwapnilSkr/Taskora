import { mergeAttributes } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import type { Node as PmNode } from '@tiptap/pm/model'
import type { NodeView } from '@tiptap/pm/view'

declare module '@tiptap/extension-image' {
  interface SetImageOptions {
    /** When true, shows skeleton until upload finishes and remote URL is applied. */
    uploading?: boolean
  }
}

const FRAME = 'task-tiptap-image-frame'
const FRAME_LOADING = 'task-tiptap-image-frame--loading'
const SKEL = 'task-tiptap-image-skeleton'
const IMG = 'task-tiptap-image-img'

/**
 * Block image with optional `uploading` state + node view (skeleton → smooth reveal).
 */
export const TaskImage = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      ...this.parent?.(),
      uploading: {
        default: false,
        parseHTML: (element) => {
          const el = element as HTMLElement
          const wrap = el.closest?.('[data-task-image]')
          if (wrap) return wrap.getAttribute('data-uploading') === 'true'
          return el.getAttribute('data-uploading') === 'true'
        },
        renderHTML: (attributes) =>
          attributes.uploading ? { 'data-uploading': 'true' } : {},
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-task-image]',
        getAttrs: (dom: HTMLElement) => {
          const img = dom.querySelector('img')
          if (!img) return false
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt'),
            title: img.getAttribute('title'),
            width: img.getAttribute('width'),
            height: img.getAttribute('height'),
            uploading: dom.getAttribute('data-uploading') === 'true',
          }
        },
      },
      ...(this.parent?.() ?? []),
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const uploading = node.attrs.uploading === true
    const imgAttrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      src: node.attrs.src,
      alt: node.attrs.alt,
      title: node.attrs.title,
      width: node.attrs.width,
      height: node.attrs.height,
      class: IMG,
    })
    return [
      'div',
      {
        'data-task-image': '1',
        ...(uploading ? { 'data-uploading': 'true' } : {}),
        class: uploading ? `${FRAME} ${FRAME_LOADING}` : FRAME,
      },
      ['div', { class: SKEL, 'aria-hidden': 'true' as const }],
      ['img', imgAttrs],
    ]
  },

  addNodeView() {
    if (this.options.resize && this.options.resize.enabled) {
      return this.parent?.() ?? null
    }

    return ({ node, HTMLAttributes }): NodeView => {
      const wrap = document.createElement('div')
      wrap.className = FRAME
      wrap.setAttribute('data-task-image', '1')
      wrap.draggable = true

      const skeleton = document.createElement('div')
      skeleton.className = SKEL
      skeleton.setAttribute('aria-hidden', 'true')

      const img = document.createElement('img')
      img.className = IMG
      img.draggable = false

      for (const [key, value] of Object.entries(
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      )) {
        if (value == null || key === 'class') continue
        img.setAttribute(key, String(value))
      }

      const apply = (n: PmNode) => {
        const uploading = n.attrs.uploading === true
        const src = (n.attrs.src as string | null) ?? ''

        wrap.classList.toggle(FRAME_LOADING, uploading)
        if (uploading) wrap.setAttribute('data-uploading', 'true')
        else wrap.removeAttribute('data-uploading')

        img.alt = (n.attrs.alt as string | null) ?? ''
        if (n.attrs.title) img.title = String(n.attrs.title)
        const w = n.attrs.width
        const h = n.attrs.height
        if (w) img.width = Number(w)
        else img.removeAttribute('width')
        if (h) img.height = Number(h)
        else img.removeAttribute('height')

        skeleton.style.display = uploading ? 'block' : 'none'
        img.style.transition = 'opacity 0.32s ease'

        if (!src) {
          img.removeAttribute('src')
          img.style.opacity = '0'
          return
        }

        if (uploading) {
          img.src = src
          img.style.opacity = '0'
          return
        }

        if (img.getAttribute('src') === src && img.complete && img.naturalWidth) {
          img.style.opacity = '1'
          return
        }

        img.style.opacity = '0'
        img.onload = () => {
          img.style.opacity = '1'
        }
        img.onerror = () => {
          img.style.opacity = '0.35'
        }
        img.src = src
      }

      apply(node)

      wrap.appendChild(skeleton)
      wrap.appendChild(img)

      return {
        dom: wrap,
        update: (updated: PmNode) => {
          if (updated.type.name !== 'image') return false
          apply(updated)
          return true
        },
        ignoreMutation: () => true,
      }
    }
  },

  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(this.parent?.() as any),
      setImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: options.src,
              alt: options.alt ?? '',
              title: options.title,
              width: options.width,
              height: options.height,
              uploading: options.uploading ?? false,
            },
          })
        },
    }
  },
})
