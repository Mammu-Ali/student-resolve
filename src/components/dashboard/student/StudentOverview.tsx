import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Clock, CheckCircle, PlusCircle, ArrowRight } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';

interface ComplaintStats {
  total: number;
  submitted: number;
  inReview: number;
  resolved: number;
}

interface RecentComplaint {
  id: string;
  subject: string;
  status: 'submitted' | 'in_review' | 'resolved';
  created_at: string;
  category: { name: string };
}

export default function StudentOverview({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { user } = useAuth();
  const [stats, setStats] = useState<ComplaintStats>({ total: 0, submitted: 0, inReview: 0, resolved: 0 });
  const [recentComplaints, setRecentComplaints] = useState<RecentComplaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch ALL complaints for accurate stats
      const { data: allComplaints } = await supabase
        .from('complaints')
        .select('id, subject, status, created_at, category:categories(name)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (allComplaints) {
        // Use only first 5 for recent display
        setRecentComplaints(allComplaints.slice(0, 5) as unknown as RecentComplaint[]);
        
        // Count from ALL complaints
        const total = allComplaints.length;
        const submitted = allComplaints.filter(c => c.status === 'submitted').length;
        const inReview = allComplaints.filter(c => c.status === 'in_review').length;
        const resolved = allComplaints.filter(c => c.status === 'resolved').length;
        
        setStats({
          total,
          submitted,
          inReview,
          resolved,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Complaints', value: stats.total, icon: FileText, color: 'text-primary' },
    { label: 'Submitted', value: stats.submitted, icon: Clock, color: 'text-status-submitted' },
    { label: 'In Review', value: stats.inReview, icon: Clock, color: 'text-status-in-review' },
    { label: 'Resolved', value: stats.resolved, icon: CheckCircle, color: 'text-status-resolved' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Welcome Back</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Here's an overview of your complaints</p>
        </div>
        <Button onClick={() => onNavigate('new')} className="gap-2 w-full sm:w-auto">
          <PlusCircle className="h-4 w-4" />
          New Complaint
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={stat.label} className="shadow-card hover:shadow-elevated transition-shadow animate-scale-in" style={{ animationDelay: `${index * 50}ms` }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-display font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`h-12 w-12 rounded-xl bg-muted flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Complaints */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-display">Recent Complaints</CardTitle>
            <CardDescription>Your latest submitted complaints</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('complaints')} className="gap-2">
            View All
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : recentComplaints.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No complaints yet</p>
              <Button variant="outline" className="mt-4" onClick={() => onNavigate('new')}>
                Submit Your First Complaint
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentComplaints.map((complaint, index) => (
                <div
                  key={complaint.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors animate-slide-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="space-y-1">
                    <p className="font-medium">{complaint.subject}</p>
                    <p className="text-sm text-muted-foreground">
                      {complaint.category?.name} • {new Date(complaint.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={complaint.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
