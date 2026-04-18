import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { DataTable } from '../../ui/DataTable'
import { Badge, StatusBadge } from '../../ui/Badge'
import { EmptyState } from '../../ui/EmptyState'
import type { Repo } from '../../../types'
import { formatNumber } from '../../../lib/utils'

export function RecentReposTable({ repos }: { repos: Repo[] }) {
  const navigate = useNavigate()
  return (
    <DataTable
      data={repos.slice(0, 10)}
      onRowClick={(repo) => navigate(`/analysis/${repo.id}`)}
      empty={<EmptyState title="No repos analyzed yet" description="Paste a GitHub URL above to get started." />}
      columns={[
        {
          header: 'Repo',
          cell: (repo) => (
            <span className="font-mono font-medium">
              {repo.owner}/{repo.name}
            </span>
          ),
        },
        {
          header: 'Languages',
          cell: (repo) => (
            <div className="flex gap-1">
              {repo.languages.slice(0, 2).map((language) => (
                <Badge key={language}>{language}</Badge>
              ))}
            </div>
          ),
        },
        { header: 'Files', cell: (repo) => <span className="font-mono">{formatNumber(repo.files)}</span> },
        { header: 'Status', cell: (repo) => <StatusBadge status={repo.status} /> },
        {
          header: 'Last Analyzed',
          cell: (repo) => <span className="text-muted-foreground">{formatDistanceToNow(new Date(repo.lastAnalyzed), { addSuffix: true })}</span>,
        },
      ]}
    />
  )
}
