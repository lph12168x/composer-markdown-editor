import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { EditorProps } from '../../types/editor'

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: '#2563eb', fontWeight: 'bold' },
  { tag: tags.strong, color: '#dc2626', fontWeight: 'bold' },
  { tag: tags.emphasis, color: '#7c3aed', fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: '#2563eb', textDecoration: 'underline' },
  { tag: tags.url, color: '#2563eb' },
  { tag: tags.monospace, color: '#dc2626', backgroundColor: '#f3f4f6', borderRadius: '3px', padding: '0 2px' },
  { tag: tags.quote, color: '#6b7280', fontStyle: 'italic' },
  { tag: tags.list, color: '#374151' },
  { tag: tags.meta, color: '#9ca3af' },
  { tag: tags.comment, color: '#9ca3af', fontStyle: 'italic' },
  { tag: tags.invalid, color: '#ef4444' }
])

export function SourceEditor({ content, onChange }: EditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const view = new EditorView({
      doc: content,
      extensions: [
        basicSetup,
        markdown(),
        syntaxHighlighting(markdownHighlightStyle),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(view.state.doc.toString())
          }
        })
      ],
      parent: container
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Editor is created once per mount; external content changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === content) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
      scrollIntoView: false
    })
  }, [content])

  return (
    <>
      <style>{`
        .source-editor .cm-editor {
          background-color: #ffffff;
          color: #171717;
        }
        .source-editor .cm-gutters {
          background-color: #f5f5f5;
          border-right: 1px solid #e5e5e5;
        }
        .source-editor .cm-activeLine {
          background-color: #f5f5f5;
        }
        .source-editor .cm-activeLineGutter {
          background-color: #e5e5e5;
        }
        .dark .source-editor .cm-editor {
          background-color: #171717;
          color: #f5f5f5;
        }
        .dark .source-editor .cm-gutters {
          background-color: #262626;
          border-right-color: #404040;
          color: #a3a3a3;
        }
        .dark .source-editor .cm-activeLine,
        .dark .source-editor .cm-activeLineGutter {
          background-color: #262626;
        }
        .dark .source-editor .cm-cursor {
          border-left-color: #f5f5f5;
        }
        .dark .source-editor .cm-selectionBackground {
          background-color: #404040;
        }
      `}</style>
      <div
        ref={containerRef}
        data-editor-scroll="true"
        className="source-editor h-full w-full overflow-auto"
      />
    </>
  )
}
