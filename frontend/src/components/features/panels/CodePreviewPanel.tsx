import Editor from '@monaco-editor/react'
import { Map } from 'lucide-react'
import { useState } from 'react'
import { useUIStore } from '../../../store/uiStore'

export function CodePreviewPanel({ code, language }: { code: string; language: string }) {
  const darkMode = useUIStore((state) => state.darkMode)
  const [minimapOn, setMinimapOn] = useState(false)

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Toolbar with minimap toggle */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">{language.toLowerCase()}</span>
        <button
          onClick={() => setMinimapOn((v) => !v)}
          title={minimapOn ? 'Hide minimap' : 'Show minimap'}
          className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] transition-colors ${
            minimapOn
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Map className="size-3" />
          Map
        </button>
      </div>
      <Editor
        height="296px"
        language={language.toLowerCase()}
        value={code}
        theme={darkMode ? 'vs-dark' : 'light'}
        options={{
          readOnly: true,
          minimap: { enabled: minimapOn },
          lineNumbersMinChars: 3,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 12,
          scrollBeyondLastLine: false,
          renderLineHighlight: 'none',
          overviewRulerLanes: 0,
        }}
      />
    </div>
  )
}
