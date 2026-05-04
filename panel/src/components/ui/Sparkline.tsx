/** Sparkline mini SVG. `data` valores normalizados, draw animation built-in. */
export function Sparkline({
  data,
  color = "#FF3B27",
  height = 24,
  width = 100,
  strokeWidth = 1.5,
}: {
  data: number[]
  color?: string
  height?: number
  width?: number
  strokeWidth?: number
}) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = width / (data.length - 1)
  const points = data
    .map((v, i) => {
      const x = i * step
      const y = height - ((v - min) / range) * height
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} width={width} height={height} preserveAspectRatio="none">
      <path d={points} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
