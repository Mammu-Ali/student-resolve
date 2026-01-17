import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Clock, CheckCircle, AlertCircle, ArrowRight, TrendingUp } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';

interface Stats {
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
  profile: { full_name: string };
}

export default function AdminOverview({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [stats, setStats] = useState<Stats>({ total: 0, submitted: 0, inReview: 0, resolved: 0 });
  const [recentComplaints, setRecentComplaints] = useState<RecentComplaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all complaints for stats
      const { data: allComplaints, error: allError } = await supabase
        .from('complaints')
        .select('status');

      if (allError) throw allError;

      if (allComplaints) {
        setStats({
          total: allComplaints.length,
          submitted: allComplaints.filter(c => c.status === 'submitted').length,
          inReview: allComplaints.filter(c => c.status === 'in_review').length,
          resolved: allComplaints.filter(c => c.status === 'resolved').length,
        });
      }

      // Fetch recent complaints with user info
      const { data: recent, error: recentError } = await supabase
        .from('complaints')
        .select(`
          id, subject, status, created_at,
          category:categories(name),
          profile:profiles!complaints_user_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) throw recentError;
      setRecentComplaints(recent as unknown as RecentComplaint[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Complaints', value: stats.total, icon: FileText, color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Pending Review', value: stats.submitted, icon: AlertCircle, color: 'text-status-submitted', bgColor: 'bg-status-submitted/10' },
    { label: 'In Progress', value: stats.inReview, icon: Clock, color: 'text-status-in-review', bgColor: 'bg-status-in-review/10' },
    { label: 'Resolved', value: stats.resolved, icon: CheckCircle, color: 'text-status-resolved', bgColor: 'bg-status-resolved/10' },
  ];

  const resolutionRate = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage and resolve student complaints</p>
        </div>
        <Button onClick={() => onNavigate('complaints')} className="gap-2">
          View All Complaints
          <ArrowRight className="h-4 w-4" />
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
                <div className={`h-12 w-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Resolution Rate Card */}
      <Card className="shadow-card bg-gradient-primary text-primary-foreground">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary-foreground/80">Resolution Rate</p>
              <p className="text-4xl font-display font-bold mt-1">{resolutionRate}%</p>
              <p className="text-sm text-primary-foreground/60 mt-2">
                {stats.resolved} out of {stats.total} complaints resolved
              </p>
            </div>
            <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center">
              <TrendingUp className="h-8 w-8" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Complaints */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-display">Recent Complaints</CardTitle>
            <CardDescription>Latest complaints requiring attention</CardDescription>
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
              <CheckCircle className="h-12 w-12 text-status-resolved mx-auto mb-4" />
              <p className="text-muted-foreground">No complaints to display</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentComplaints.map((complaint, index) => (
                <div
                  key={complaint.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer animate-slide-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => onNavigate('complaints')}
                >
                  <div className="space-y-1">
                    <p className="font-medium">{complaint.subject}</p>
                    <p className="text-sm text-muted-foreground">
                      {complaint.profile?.full_name || 'Unknown'} • {complaint.category?.name} • {new Date(complaint.created_at).toLocaleDateString()}
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
