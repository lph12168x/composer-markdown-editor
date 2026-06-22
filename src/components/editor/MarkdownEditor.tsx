import type { EditorProps } from '../../types/editor'
import { MilkdownEditor } from './MilkdownEditor'

/**
 * Markdown editor adapter.
 *
 * This is the single integration point between the application and the concrete
 * editor implementation. To swap Milkdown for another editor (TipTap, CodeMirror 6,
 * a split preview/editor, etc.), replace the component rendered below and keep the
 * same `EditorProps` contract.
 *
 * Contract requirements for any replacement:
 * - Render the provided `content` as editable Markdown.
 * - Call `onChange(content)` whenever the user changes the document.
 * - Render headings as standard semantic `<h1>` ... `<h6>` elements so that the
 *   outline panel can scroll to them.
 */
export function MarkdownEditor(props: EditorProps): JSX.Element {
  return <MilkdownEditor {...props} />
}
