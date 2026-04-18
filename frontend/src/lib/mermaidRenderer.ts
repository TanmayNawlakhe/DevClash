import mermaid from 'mermaid'

let initialized = false

export function initMermaid(darkMode: boolean) {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: darkMode ? 'dark' : 'base',
    themeVariables: {
      primaryColor: 'var(--accent)',
      primaryTextColor: 'var(--foreground)',
      primaryBorderColor: 'var(--primary)',
      lineColor: 'var(--border)',
      fontFamily: 'var(--font-sans)',
    },
  })
  initialized = true
}

export async function renderMermaid(id: string, source: string, darkMode: boolean) {
  if (!initialized) initMermaid(darkMode)
  return mermaid.render(id, source)
}
