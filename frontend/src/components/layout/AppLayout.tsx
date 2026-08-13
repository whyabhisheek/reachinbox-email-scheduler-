import { BarChart3, CalendarClock, Edit3, LayoutDashboard, LogOut, MailCheck, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Scheduled Emails", to: "/scheduled", icon: CalendarClock },
  { label: "Sent Emails", to: "/sent", icon: MailCheck },
  { label: "Compose Email", to: "/compose", icon: Edit3 }
];

function pageTitle(pathname: string) {
  if (pathname.startsWith("/scheduled")) return "Scheduled Emails";
  if (pathname.startsWith("/sent")) return "Sent Emails";
  if (pathname.startsWith("/compose")) return "Compose Email";
  return "Dashboard";
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const sidebar = (
    <aside className="flex h-full w-72 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-white">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">ReachInbox</p>
            <p className="text-xs text-slate-500">Scheduler</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition",
                isActive ? "bg-cyan-50 text-cyan-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              ].join(" ")
            }
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[288px_minmax(0,1fr)]">
      <div className="hidden lg:block">{sidebar}</div>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation overlay"
          />
          <div className="relative h-full">{sidebar}</div>
        </div>
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Workspace</p>
                <h1 className="text-lg font-semibold text-slate-950">{pageTitle(location.pathname)}</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/compose"
                className="hidden items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 sm:inline-flex"
              >
                <Edit3 className="h-4 w-4" aria-hidden="true" />
                Compose New Email
              </Link>
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="h-10 w-10 rounded-full border border-slate-200" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-700 text-sm font-semibold text-white">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden text-right md:block">
                <p className="text-sm font-semibold text-slate-950">{user?.name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-50"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
