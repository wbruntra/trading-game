import { Navigate, Outlet } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'

export default function RequiresCompetition() {
  const { activeCompetitionId } = useSelector((state: RootState) => state.game)

  if (!activeCompetitionId) {
    return <Navigate to="/competitions" replace />
  }

  return <Outlet />
}
