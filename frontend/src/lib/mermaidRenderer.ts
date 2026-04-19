import mermaid from 'mermaid'

let initializedTheme: 'dark' | 'base' | null = null
let renderNonce = 0

export function initMermaid(darkMode: boolean) {
  const theme = darkMode ? 'dark' : 'base'
  if (initializedTheme === theme) return

  const fontFamily = typeof window === 'undefined'
    ? 'ui-sans-serif, system-ui, sans-serif'
    : getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || 'ui-sans-serif, system-ui, sans-serif'

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme,
    themeVariables: {
      fontFamily,
    },
  })
  initializedTheme = theme
}

export async function renderMermaid(id: string, source: string, darkMode: boolean) {
  initMermaid(darkMode)
  return mermaid.render(`${id}-${renderNonce++}`, source)
}
