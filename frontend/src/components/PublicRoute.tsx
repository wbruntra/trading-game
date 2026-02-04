import { Navigate, Outlet } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'

export default function PublicRoute() {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth)
  const { activeCompetitionId } = useSelector((state: RootState) => state.game)

  if (isAuthenticated) {
    if (activeCompetitionId) {
      return <Navigate to="/portfolio" replace />
    } else {
      return <Navigate to="/competitions" replace />
    }
  }

  return <Outlet />
}
