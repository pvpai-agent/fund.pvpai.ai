import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cyber-black">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-h-[calc(100vh-52px)] overflow-y-auto lg:pl-56 pb-14 lg:pb-0">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
