export function calculateFantasyPoints(stats: {
  kills: number
  deaths: number
  assists: number
  cs: number
  visionScore: number
}): number {
  const { kills, deaths, assists, cs, visionScore } = stats
  
  const points = (
    kills * 1.0 +
    deaths * -0.7 +
    assists * 0.5 +
    (cs / 50) * 0.5 +
    (visionScore / 10) * 0.0
  )
  
  return Math.round(points * 100) / 100 // Round to 2 decimals
}