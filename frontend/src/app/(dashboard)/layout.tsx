import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { SidebarProvider } from '@/components/layout/SidebarContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      {/* h-screen-safe usa 100dvh: no iOS o 100vh inclui a barra de endereço,
          e com overflow-hidden o rodapé ficava fora da área visível. */}
      <div className="flex h-screen-safe overflow-hidden bg-lumine-cream">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-safe">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
