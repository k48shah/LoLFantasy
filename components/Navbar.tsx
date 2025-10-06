'use client'
import Link from 'next/link'
import { useAuth } from './AuthProvider'
import { Trophy, Users, BarChart3, Star, LogOut, ArrowRightLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function Navbar() {
  const { user, signOut } = useAuth()
  const [username, setUsername] = useState<string>('')

  useEffect(() => {
    if (user) {
      loadUsername()
    }
  }, [user])

  async function loadUsername() {
    const { data } = await supabase
      .from('users')
      .select('username')
      .eq('id', user!.id)
      .single()

    if (data) {
      setUsername(data.username)
    }
  }

  return (
    <nav className="bg-dark-800 border-b border-dark-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <Trophy className="w-8 h-8 text-primary-500" />
              <span className="text-xl font-bold text-white">LoL Fantasy</span>
            </Link>
            
            {user && (
              <div className="hidden md:flex space-x-4">
                <NavLink href="/draft" icon={<Star className="w-4 h-4" />}>
                  Draft
                </NavLink>
                <NavLink href="/rosters" icon={<Users className="w-4 h-4" />}>
                  Rosters
                </NavLink>
                <NavLink href="/standings" icon={<BarChart3 className="w-4 h-4" />}>
                  Standings
                </NavLink>
                <NavLink href="/trades" icon={<ArrowRightLeft className="w-4 h-4" />}>
                  Trades
                </NavLink>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-gray-300 text-sm hidden sm:block">
                  {username || user.email}
                </span>
                <button
                  onClick={signOut}
                  className="flex items-center space-x-2 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  )
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-dark-700 rounded-lg transition"
    >
      {icon}
      <span>{children}</span>
    </Link>
  )
}