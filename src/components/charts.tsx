import { useMemo } from 'react'
import { barY, defineChart, group } from '@tanstack/charts'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { tooltip } from '@tanstack/charts/tooltip'
import { pie, polar, radialArc } from '@tanstack/charts/polar'
import { Chart } from '@tanstack/charts/react'

const C_HADIR = '#3b82f6'
const C_TIDAK = '#f87171'

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-base-content/70">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

export function TrendChart({ 
  labels, 
  hadir, 
  tidakHadir
}: { 
  labels: string[]; 
  hadir: number[]; 
  tidakHadir: number[] 
}) {
  const definition = useMemo(() => {
    const rows = labels.flatMap((date, i) => [
      { date, jenis: 'Hadir', jumlah: hadir[i] ?? 0 },
      { date, jenis: 'Tidak Hadir', jumlah: tidakHadir[i] ?? 0 },
    ])
    return defineChart({
      marks: [
        barY(rows, {
          x: 'date',
          y: 'jumlah',
          color: 'jenis',
          fill: (d) => (d.jenis === 'Hadir' ? C_HADIR : C_TIDAK),
          layout: group({ padding: 0.1 }),
          radius: { end: 4 },
        }),
      ],
      scales: {
        x: {
          scale: () => scaleBand().padding(0.2),
          axis: { ticks: { format: (v) => String(v).slice(5) } },
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: { ticks: { format: (v) => (Number.isInteger(Number(v)) ? String(v) : '') } },
        },
      },
      tooltip,
    })
  }, [labels, hadir, tidakHadir])

  if (labels.length === 0) {
    return <p className="py-10 text-center text-sm text-base-content/60">Belum ada data 7 hari terakhir.</p>
  }
  return (
    <>
      <Chart definition={definition} height={250} ariaLabel="Tren kehadiran 7 hari terakhir" />
      <Legend items={[{ label: 'Hadir', color: C_HADIR }, { label: 'Tidak Hadir', color: C_TIDAK }]} />
    </>
  )
}

const STATUS_COLORS = { 
  Hadir: '#10b981', 
  Sakit: '#f59e0b', 
  Izin: '#3b82f6', 
  Alpa: '#ef4444' 
} as const

export function StatusDonut({ 
  hadir,
  sakit, 
  izin, 
  alpa
}: { 
  hadir: number; 
  sakit: number; 
  izin: number; 
  alpa: number 
}) {
  const total = hadir + sakit + izin + alpa

  const definition = useMemo(() => {
    const items = [
      { label: 'Hadir', jumlah: hadir, color: STATUS_COLORS.Hadir },
      { label: 'Sakit', jumlah: sakit, color: STATUS_COLORS.Sakit },
      { label: 'Izin', jumlah: izin, color: STATUS_COLORS.Izin },
      { label: 'Alpa', jumlah: alpa, color: STATUS_COLORS.Alpa },
    ]
    const slices = pie(items, { value: 'jumlah', gapAngle: 0.02 })
    return defineChart({
      marks: [
        polar({
          scales: { angle: null, radius: null },
          marks: [
            radialArc(slices, {
              key: 'label',
              innerRadius: ({ radius }) => radius * 0.6,
              fill: (d) => d.color,
            }),
          ],
        }),
      ],
      scales: { x: null, y: null },
      tooltip,
    })
  }, [hadir, sakit, izin, alpa])

  if (total === 0) {
    return <p className="py-10 text-center text-sm text-base-content/60">Belum ada absensi hari ini.</p>
  }
  return (
    <>
      <div className="mx-auto" style={{ width: 250 }}>
        <Chart definition={definition} height={250} ariaLabel="Ringkasan kehadiran hari ini" />
      </div>
      <Legend items={Object.entries(STATUS_COLORS).map(([label, color]) => ({ label, color }))} />
    </>
  )
}