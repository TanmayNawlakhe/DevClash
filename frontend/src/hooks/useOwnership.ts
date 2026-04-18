import { useOwnershipStore } from '../store/ownershipStore'

export function useOwnership() {
  return useOwnershipStore()
}
