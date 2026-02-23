import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { HowItWorksModal } from '@/components/modals/HowItWorksModal';
import { CronBootstrap } from '@/components/providers/CronBootstrap';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-cyber-black">
        <Header />
        <div className="flex">
          <Sidebar />
          {/* Spacer for fixed sidebar on lg screens */}
          <div className="hidden lg:block w-56 shrink-0" />
          <main className="flex-1 p-6 min-h-[calc(100vh-52px)]">
            {children}
          </main>
        </div>
        <HowItWorksModal />
        <CronBootstrap />
      </div>
    </AuthGuard>
  );
}
