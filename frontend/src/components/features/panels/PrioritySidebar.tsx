import { PriorityChecklist } from '../priority/PriorityChecklist'
import { PriorityProgressBar } from '../priority/PriorityProgressBar'
import { usePriorityStore } from '../../../store/priorityStore'

export function PrioritySidebar() {
  const rankings = usePriorityStore((state) => state.rankings)
  const checked = usePriorityStore((state) => state.checkedFileIds)
  return (
    <div className="space-y-4">
      <PriorityProgressBar done={checked.size} total={rankings.length} />
      <PriorityChecklist />
    </div>
  )
}
