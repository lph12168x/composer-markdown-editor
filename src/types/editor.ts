export interface EditorProps {
  /** Initial Markdown content. The editor owns subsequent mutations and reports them via onChange. */
  content: string
  /** Called whenever the editor content changes (debounced by the concrete editor if needed). */
  onChange: (content: string) => void
}
