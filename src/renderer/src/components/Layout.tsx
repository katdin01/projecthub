import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { SearchPalette } from './SearchPalette'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/projects', label: 'Projects' },
  { to: '/daily-log', label: 'Hours Log' },
  { to: '/notes', label: 'Notes' },
  { to: '/settings', label: 'Settings' }
]

export function Layout(): React.JSX.Element {
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="px-4 py-4 text-lg font-bold tracking-tight">ProjectHub</div>
        <nav className="flex-1 space-y-0.5 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'block rounded-md px-3 py-1.5 text-sm font-medium',
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => setSearchOpen(true)}
          className="m-2 rounded-md border border-slate-200 px-3 py-1.5 text-left text-xs text-slate-400 hover:bg-slate-50"
        >
          ⌘K Search everything
        </button>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
