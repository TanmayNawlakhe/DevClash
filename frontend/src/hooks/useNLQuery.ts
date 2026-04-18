import { useMutation } from '@tanstack/react-query'
import { submitNLQuery } from '../services/queryService'

export function useNLQuery(repoId: string) {
  return useMutation({
    mutationFn: (query: string) => submitNLQuery(repoId, query),
  })
}
