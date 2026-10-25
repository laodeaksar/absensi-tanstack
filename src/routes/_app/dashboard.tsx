import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Thermometer, UserCheck, UserX, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { allowRoles } from '~/lib/auth'
import { dashboardQuery } from '~/lib/queries'
import { StatusDonut, TrendChart } from '~/components/charts'

export const Route = createFileRoute('/_app/dashboard')({
  beforeLoad: ({ context }) => allowRoles(context.me, ['admin', 'guru']),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: DashboardPage,
})

function StatCard({ title, value, icon, tone }: { title: string; value: ReactNode; icon: ReactNode; tone: string }) {
  return (
    <div className="stats border border-base-300 bg-base-100">
      <div className="stat">
        <div className={`stat-figure ${tone}`}>
          <div className="flex size-12 items-center justify-center rounded-full bg-current/10">{icon}</div>
        </div>
        <div className="stat-title">{title}</div>
        <div className="stat-value text-2xl">{value}</div>
      </div>
    </div>
  )
}

function DashboardPage() {
  const { data } = useSuspenseQuery(dashboardQuery)
  const { stats, chartData } = data

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard Overview</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Siswa" value={stats.totalStudents} tone="text-primary" icon={<Users className="size-6" />} />
        <StatCard title="Hadir Hari Ini" value={stats.hadir} tone="text-success" icon={<UserCheck className="size-6" />} />
        <StatCard title="Sakit / Izin" value={stats.sakit + stats.izin} tone="text-warning" icon={<Thermometer className="size-6" />} />
        <StatCard title="Persentase Kehadiran" value={`${stats.persentase}%`} tone="text-error" icon={<UserX className="size-6" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card border border-base-300 bg-base-100">
          <div className="card-body">
            <h3 className="card-title text-base">Tren Kehadiran (7 Hari Terakhir)</h3>
            <TrendChart labels={chartData.labels} hadir={chartData.hadir} tidakHadir={chartData.tidakHadir} />
          </div>
        </div>
        <div className="card border border-base-300 bg-base-100">
          <div className="card-body">
            <h3 className="card-title text-base">Ringkasan Hari Ini</h3>
            <StatusDonut hadir={stats.hadir} sakit={stats.sakit} izin={stats.izin} alpa={stats.alpa} />
          </div>
        </div>
      </div>
    </div>
  )
}