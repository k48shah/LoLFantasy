import { Crosshair, HeartHandshake, Shield, Trees, Wand2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from './types'

export const ROLE_META: Record<Role, { label: string; short: string; color: string; Icon: LucideIcon }> = {
  top: { label: 'Top', short: 'TOP', color: '#e89b3c', Icon: Shield },
  jungle: { label: 'Jungle', short: 'JNG', color: '#3ec97b', Icon: Trees },
  mid: { label: 'Mid', short: 'MID', color: '#5b9cf6', Icon: Wand2 },
  adc: { label: 'Bot', short: 'BOT', color: '#ef5b6e', Icon: Crosshair },
  support: { label: 'Support', short: 'SUP', color: '#b78cf5', Icon: HeartHandshake },
}

/** hex color + alpha (0-1) → 8-digit hex */
export const withAlpha = (hex: string, alpha: number) => hex + Math.round(alpha * 255).toString(16).padStart(2, '0')
