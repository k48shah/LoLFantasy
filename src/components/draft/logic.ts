import type { Player, Role } from '../../lib/types'
import { ROLES } from '../../lib/types'
import { ROLE_META } from '../../lib/roles'

/** Same blend the server uses to rank "best available" for auto-picks. */
export const rating = (p: Player) => (p.all.points + p.seed * 3) / (p.all.games + 3)

/** Which user holds overall pick `pickNo` in a snake draft over `order` (user ids by draft position)? */
export function userAtPick(order: string[], pickNo: number): string | undefined {
  const n = order.length
  if (!n || pickNo < 1) return undefined
  const round = Math.floor((pickNo - 1) / n)
  let i = (pickNo - 1) % n
  if (round % 2 === 1) i = n - 1 - i
  return order[i]
}

/** How many picks until `userId` is next on the clock (0 = right now), or null if they're done. */
export function picksUntil(order: string[], current: number, total: number, userId: string): number | null {
  for (let p = current; p <= total; p++) if (userAtPick(order, p) === userId) return p - current
  return null
}

/** Client-side mirror of the server's per-roster rule, used only to disable buttons with a helpful tooltip. */
export function localProblem(player: Player, mine: Player[], rosterSize: number): string | null {
  if (mine.length >= rosterSize) return 'Your roster is full.'
  const have = new Set<Role>(mine.map((m) => m.role))
  have.add(player.role)
  const missing = ROLES.filter((r) => !have.has(r))
  if (missing.length > rosterSize - mine.length - 1) {
    return `You still need ${missing.map((r) => ROLE_META[r].label).join(', ')} — picking another ${ROLE_META[player.role].label} leaves no room.`
  }
  return null
}

export const rolesMissing = (mine: Player[]): Role[] => ROLES.filter((r) => !mine.some((m) => m.role === r))
