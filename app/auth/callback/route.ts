import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.exchangeCodeForSession(code)
    
    if (session?.user) {
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', session.user.id)
        .single()

      // If not, create the user
      if (!existingUser) {
        const username = session.user.user_metadata?.full_name || 
                        session.user.email?.split('@')[0] || 
                        `user_${session.user.id.slice(0, 8)}`

        // Use service role to bypass RLS
        const { error } = await supabase
          .from('users')
          .insert({
            id: session.user.id,
            username: username,
            email: session.user.email!,
          })

        if (error) {
          console.error('Error creating user:', error)
        }
      }
    }
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin))
}