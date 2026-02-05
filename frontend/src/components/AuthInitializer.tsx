import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useGetStatusQuery } from '@/store/api/authApi'
import { setCredentials, logout } from '@/store/slices/authSlice'

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch()

  // We skip the query if we already have a token in state/localStorage,
  // but we actually want to verify it.
  // Let's just always try to fetch status. If it fails (401), we log out.
  const { data, error, isLoading } = useGetStatusQuery()

  useEffect(() => {
    if (isLoading) return

    if (data && data.user) {
      // Token is valid
      // We need the token to be in the store for the query to work in the first place,
      // so we assume if this query succeeded, the existing token is good.
      // We might want to refresh the user data in store.
      const token = localStorage.getItem('token')
      if (token) {
        dispatch(setCredentials({ user: data.user, token }))
      }
    } else if (error) {
      // Token invalid or expired
      dispatch(logout())
    }

  }, [data, error, isLoading, dispatch])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        Loading...
      </div>
    )
  }

  return <>{children}</>
}
