import { AdminGuard } from '@/components/admin/AdminGuard';
import { AdminNav } from '@/components/admin/AdminNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-cyber-black">
        {/* Admin header */}
        <header className="sticky top-0 z-40 border-b border-terminal-border bg-cyber-black/90 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border border-cyber-red rounded flex items-center justify-center">
                <span className="text-cyber-red font-bold text-sm font-mono">A</span>
              </div>
              <span className="text-lg font-bold font-mono text-cyber-red tracking-widest uppercase">
                PVP AI Admin
              </span>
            </div>
            <span className="text-[10px] font-mono text-gray-600">
              v1.0.0-beta
            </span>
          </div>
        </header>
        <div className="flex">
          <AdminNav />
          <main className="flex-1 p-6 min-h-[calc(100vh-52px)]">
            {children}
          </main>
        </div>
      </div>
    </AdminGuard>
  );
}
