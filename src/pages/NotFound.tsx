import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui'

export function NotFound() {
  return (
    <div className="panel mx-auto mt-10 max-w-lg">
      <EmptyState title="Nothing here">
        That page doesn't exist.{' '}
        <Link to="/" className="text-hex-400 underline">
          Back to your leagues
        </Link>
      </EmptyState>
    </div>
  )
}
