import { useEffect, useRef } from 'react'
import { Crepe } from '@milkdown/crepe'
import type { EditorProps } from '../../types/editor'
import '../../styles/milkdown-theme/common/style.css'
import '../../styles/milkdown-theme/nord/style.css'

export function MilkdownEditor({ content, onChange }: EditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialContentRef = useRef(content)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const crepe = new Crepe({
      root: container,
      defaultValue: initialContentRef.current,
      features: {
        [Crepe.Feature.TopBar]: true
      }
    })

    crepe.on((listener) => {
      listener.markdownUpdated((_, markdown) => {
        onChangeRef.current(markdown)
      })
    })

    void crepe.create()

    return () => {
      void crepe.destroy()
    }
  }, [])

  return <div ref={containerRef} data-editor-scroll="true" className="h-full w-full overflow-auto" />
}
