import * as Popover from '@radix-ui/react-popover'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Switch } from '../../ui/Switch'
import { LANGUAGES, LAYER_COLORS } from '../../../lib/constants'
import { useGraphStore } from '../../../store/graphStore'
import type { Layer } from '../../../types'

export function GraphFilterPanel() {
  const filters = useGraphStore((state) => state.filters)
  const setFilters = useGraphStore((state) => state.setFilters)
  const resetFilters = useGraphStore((state) => state.resetFilters)

  const toggleLayer = (layer: Layer) => {
    setFilters({
      layers: filters.layers.includes(layer) ? filters.layers.filter((item) => item !== layer) : [...filters.layers, layer],
    })
  }

  const toggleLanguage = (language: string) => {
    setFilters({
      languages: filters.languages.includes(language)
        ? filters.languages.filter((item) => item !== language)
        : [...filters.languages, language],
    })
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="size-4" />
          Filters
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="center" sideOffset={10} className="z-40 w-72 rounded-lg border border-border bg-popover p-4 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Filters</h3>
            <button className="text-xs text-primary hover:underline" onClick={resetFilters}>
              Reset Filters
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase text-muted-foreground">Layer</p>
            <div className="space-y-2">
              {(Object.keys(LAYER_COLORS) as Layer[]).map((layer) => (
                <label key={layer} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={filters.layers.includes(layer)} onChange={() => toggleLayer(layer)} />
                  <span className="size-2 rounded-full" style={{ background: LAYER_COLORS[layer].hex }} />
                  {LAYER_COLORS[layer].label}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs uppercase text-muted-foreground">Language</p>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map((language) => (
                <label key={language} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={filters.languages.includes(language)} onChange={() => toggleLanguage(language)} />
                  {language}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <Switch label="Show Orphans" checked={filters.showOrphans} onCheckedChange={(showOrphans) => setFilters({ showOrphans })} />
            <Switch label="Entry Points Only" checked={filters.entryOnly} onCheckedChange={(entryOnly) => setFilters({ entryOnly })} />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
