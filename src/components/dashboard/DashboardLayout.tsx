import { ReactNode, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  GraduationCap, 
  LogOut, 
  LayoutDashboard, 
  FileText, 
  PlusCircle,
  BarChart3,
  Menu,
  Moon,
  Sun,
  FolderOpen,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: { id: string; label: string; icon: ReactNode }[];
}

export default function DashboardLayout({ children, activeTab, onTabChange, tabs }: DashboardLayoutProps) {
  const { signOut, role } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    setOpen(false);
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sidebar-primary/20 flex items-center justify-center">
            <GraduationCap className="h-6 w-6 text-sidebar-primary" />
          </div>
          <div>
            <span className="text-xl font-display font-bold text-sidebar-foreground">aLooi</span>
            <p className="text-xs text-sidebar-foreground/60 capitalize">{role} Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-1">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 mr-3" />
          ) : (
            <Moon className="h-4 w-4 mr-3" />
          )}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Header */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border h-16 flex items-center px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
              <div className="flex flex-col h-full">
                <SidebarContent />
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 ml-3">
            <GraduationCap className="h-6 w-6 text-sidebar-primary" />
            <span className="text-lg font-display font-bold text-sidebar-foreground">aLooi</span>
          </div>
        </header>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col fixed h-full">
          <SidebarContent />
        </aside>
      )}

      {/* Main content */}
      <main className={cn(
        "flex-1 overflow-auto",
        isMobile ? "pt-16" : "ml-64"
      )}>
        {children}
      </main>
    </div>
  );
}

export const studentTabs = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'complaints', label: 'My Complaints', icon: <FileText className="h-4 w-4" /> },
  { id: 'new', label: 'New Complaint', icon: <PlusCircle className="h-4 w-4" /> },
];

export const adminTabs = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'complaints', label: 'All Complaints', icon: <FileText className="h-4 w-4" /> },
  { id: 'categories', label: 'Categories', icon: <FolderOpen className="h-4 w-4" /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'activity', label: 'Activity Log', icon: <History className="h-4 w-4" /> },
];
