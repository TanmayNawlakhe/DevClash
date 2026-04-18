export function ownershipColor(name: string) {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 68% 52%)`
}

export function buildOwnerPalette(names: string[]) {
  return names.reduce<Record<string, string>>((palette, name) => {
    palette[name] = ownershipColor(name)
    return palette
  }, {})
}
