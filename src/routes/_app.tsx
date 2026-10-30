import { useEffect, useState } from 'react'
import { Link, Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import {
  BarChart3, BookOpenCheck, CalendarCheck, ClipboardCheck, ClipboardList, DoorOpen, LayoutDashboard, LogOut, Menu, School, Settings as SettingsIcon, UserCog, Users,
} from 'lucide-react'
import { requireUser } from '~/lib/auth'
import { settingsQuery } from '~/lib/queries'
import { logoutFn } from '~/server/functions'

export const Route = createFileRoute('/_app')({
  // Area login = SPA: tidak perlu SSR (bergantung cookie sesi dan tanggal lokal browser)
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const me = await requireUser(context)
    if (me.must_change_password && location.pathname !== '/settings') throw redirect({ to: '/settings' })
    return { me }
  },
  loader: ({ context }) => context.queryClient.query(settingsQuery),
  component: AppLayout,
})

type NavTo = '/dashboard' | '/attendance' | '/reports' | '/assignments' | '/tasks' | '/students' | '/classes' | '/teachers' | '/my-attendance' | '/settings'

function NavItem({ to, icon, label, onNavigate }: { to: NavTo; icon: React.ReactNode; label: string; onNavigate: () => void }) {
  return (
    <li>
      <Link to={to} onClick={onNavigate} activeProps={{ className: 'menu-active' }}>
        {icon}
        {label}
      </Link>
    </li>
  )
}

function AppLayout() {
  const { me } = Route.useRouteContext()
  const { data: settings } = useSuspenseQuery(settingsQuery)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  const name = settings.school_name || 'EduAbsen'
  useEffect(() => {
    document.title = `Absensi ${name}`
  }, [name])

  const logout = useMutation({
    mutationFn: () => logoutFn(),
    onSettled: () => {
      qc.clear()
      navigate({ to: '/login' })
    },
  })

  const isStudent = me.role === 'siswa'
  const isAdmin = me.role === 'admin'
  const ic = 'size-5'

  return (
    <div className="drawer h-full lg:drawer-open">
      <input id="app-drawer" type="checkbox" className="drawer-toggle" checked={open} onChange={(e) => setOpen(e.target.checked)} />

      <div className="drawer-content flex h-full min-w-0 flex-col overflow-hidden">
        <header className="navbar no-print min-h-14 border-b border-base-300 bg-base-100 px-2 lg:hidden">
          <label htmlFor="app-drawer" className="btn btn-square btn-ghost" aria-label="Buka menu">
            <Menu className="size-6" />
          </label>
          <div className="ml-1 flex items-center gap-2">
            <School className="size-5 text-primary" />
            <span className="font-bold">{name}</span>
          </div>
        </header>

        <main id="print-area" className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <div className="drawer-side no-print z-40">
        <label htmlFor="app-drawer" aria-label="Tutup menu" className="drawer-overlay" />
        <aside className="flex min-h-full w-64 flex-col border-r border-base-300 bg-base-100">
          <div className="flex h-16 shrink-0 items-center border-b border-base-300 px-6">
            <School className="mr-3 size-6 text-primary" />
            <span className="truncate text-lg font-bold">{name}</span>
          </div>

          <ul className="menu w-full flex-1 gap-1 p-3">
            {!isStudent && (
              <>
                <NavItem to="/dashboard" icon={<LayoutDashboard className={ic} />} label="Dashboard" onNavigate={close} />
                <li className="menu-title mt-3">Operasional</li>
                <NavItem to="/attendance" icon={<ClipboardCheck className={ic} />} label="Input Absensi" onNavigate={close} />
                <NavItem to="/assignments" icon={<ClipboardList className={ic} />} label="Tugas" onNavigate={close} />
                <NavItem to="/reports" icon={<BarChart3 className={ic} />} label="Laporan" onNavigate={close} />
              </>
            )}
            {isAdmin && (
              <>
                <li className="menu-title mt-3">Master Data</li>
                <NavItem to="/students" icon={<Users className={ic} />} label="Data Siswa" onNavigate={close} />
                <NavItem to="/classes" icon={<DoorOpen className={ic} />} label="Data Kelas" onNavigate={close} />
                <NavItem to="/teachers" icon={<UserCog className={ic} />} label="Data Guru" onNavigate={close} />
              </>
            )}
            {isStudent && (
              <>
                <NavItem to="/my-attendance" icon={<CalendarCheck className={ic} />} label="Kehadiran Saya" onNavigate={close} />
                <NavItem to="/tasks" icon={<BookOpenCheck className={ic} />} label="Tugas Saya" onNavigate={close} />
              </>
            )}
            <li className="menu-title mt-3">Sistem</li>
            <NavItem to="/settings" icon={<SettingsIcon className={ic} />} label="Pengaturan" onNavigate={close} />
          </ul>

          <div className="shrink-0 border-t border-base-300 p-4">
            <button type="button" className="btn btn-outline w-full" onClick={() => logout.mutate()} disabled={logout.isPending}>
              <LogOut className="size-4" /> Logout
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}