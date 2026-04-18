import { useRepoStore } from '../store/repoStore'

export function useRepo() {
  return useRepoStore()
}
