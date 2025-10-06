'use client'
import { useAuth } from '../components/AuthProvider'
import { LoginPage } from '../components/LoginPage'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Trophy, Users, Plus } from 'lucide-react'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    if (!loading && user && !isRedirecting) {
      setIsRedirecting(true)
      router.push('/draft')
    }
  }, [user, loading, router, isRedirecting])

  // Show loading spinner while auth is checking
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-xl text-gray-400">Loading...</div>
      </div>
    )
  }

  // Show loading while redirecting
  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-xl text-gray-400">Redirecting...</div>
      </div>
    )
  }

  // Show login page if no user
  if (!user) {
    return <LoginPage />
  }

  return (
    <div className="min-h-screen bg-dark-900">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <Trophy className="w-20 h-20 text-primary-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-4">
            Welcome to LoL Fantasy
          </h1>
          <p className="text-xl text-gray-400">
            Logged in as {user.email}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Link
            href="/create-league"
            className="bg-dark-800 hover:bg-dark-700 p-8 rounded-lg text-center transition group"
          >
            <Plus className="w-12 h-12 text-primary-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Create League</h3>
            <p className="text-gray-400">Start your own fantasy league</p>
          </Link>

          <Link
            href="/join"
            className="bg-dark-800 hover:bg-dark-700 p-8 rounded-lg text-center transition group"
          >
            <Users className="w-12 h-12 text-primary-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Join League</h3>
            <p className="text-gray-400">Enter an invite code</p>
          </Link>

          <Link
            href="/draft"
            className="bg-dark-800 hover:bg-dark-700 p-8 rounded-lg text-center transition group"
          >
            <Trophy className="w-12 h-12 text-primary-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">My League</h3>
            <p className="text-gray-400">Go to draft</p>
          </Link>
        </div>
      </div>
    </div>
  )
}