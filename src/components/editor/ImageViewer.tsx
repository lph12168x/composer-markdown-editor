import type { Document } from '../../types/file'

interface ImageViewerProps {
  document: Document
}

/**
 * Read-only image viewer used for image-kind documents. The data URL is
 * already loaded into `document.content` by `openImageDocument`, so this
 * component is purely a renderer with no I/O and no state.
 *
 * Two layout choices are explicit here:
 * - The image sits inside a flex-centered container so it auto-fits to
 *   the viewport (max-h / max-w keeps aspect ratio without JS measurement).
 * - We rely on the browser's native zoom (Ctrl+wheel / pinch) rather than
 *   rolling our own pan/zoom — keeps the file minimal and avoids fighting
 *   with the scroll container's own behaviour.
 */
export function ImageViewer({ document }: ImageViewerProps): JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto bg-neutral-100 p-6 dark:bg-neutral-950">
      <img
        src={document.content}
        alt={document.ref.name}
        className="max-h-full max-w-full object-contain shadow-sm"
        draggable={false}
      />
    </div>
  )
}