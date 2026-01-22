import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, Users, FileText, CheckCircle, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface CategoryStats {
  name: string;
  count: number;
}

interface StatusStats {
  name: string;
  value: number;
  color: string;
}

interface Category {
  id: string;
  name: string;
}

export default function AdminReports() {
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [statusStats, setStatusStats] = useState<StatusStats[]>([]);
  const [totalComplaints, setTotalComplaints] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [resolutionRate, setResolutionRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Export filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchReportData();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name').order('name');
    if (data) setCategories(data);
  };

  const fetchReportData = async () => {
    try {
      // Fetch all complaints with categories
      const { data: complaints } = await supabase
        .from('complaints')
        .select('status, category:categories(name)');

      if (complaints) {
        setTotalComplaints(complaints.length);

        // Status stats
        const statusCounts = {
          submitted: complaints.filter(c => c.status === 'submitted').length,
          in_review: complaints.filter(c => c.status === 'in_review').length,
          resolved: complaints.filter(c => c.status === 'resolved').length,
        };

        setStatusStats([
          { name: 'Submitted', value: statusCounts.submitted, color: 'hsl(215, 14%, 45%)' },
          { name: 'In Review', value: statusCounts.in_review, color: 'hsl(38, 92%, 50%)' },
          { name: 'Resolved', value: statusCounts.resolved, color: 'hsl(142, 71%, 45%)' },
        ]);

        setResolutionRate(
          complaints.length > 0 
            ? Math.round((statusCounts.resolved / complaints.length) * 100) 
            : 0
        );

        // Category stats
        const catCounts: Record<string, number> = {};
        complaints.forEach((c: any) => {
          const catName = c.category?.name || 'Unknown';
          catCounts[catName] = (catCounts[catName] || 0) + 1;
        });

        setCategoryStats(
          Object.entries(catCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
        );
      }

      // Fetch unique students count
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      setTotalStudents(count || 0);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      let query = supabase
        .from('complaints')
        .select(`
          id, subject, description, status, admin_response, created_at, updated_at, resolved_at,
          category:categories(name),
          user_id
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus as 'submitted' | 'in_review' | 'resolved');
      }
      if (filterCategory !== 'all') {
        query = query.eq('category_id', filterCategory);
      }
      if (dateFrom) {
        query = query.gte('created_at', new Date(dateFrom).toISOString());
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data: complaints, error } = await query;

      if (error) throw error;
      if (!complaints || complaints.length === 0) {
        toast.error('No complaints found with the selected filters');
        return;
      }

      // Fetch profiles for user info
      const userIds = [...new Set(complaints.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const headers = ['ID', 'Subject', 'Category', 'Status', 'Student Name', 'Student Email', 'Created At', 'Resolved At', 'Admin Response'];
      const rows = complaints.map((c: any) => {
        const profile = profileMap.get(c.user_id);
        return [
          c.id,
          `"${(c.subject || '').replace(/"/g, '""')}"`,
          c.category?.name || '',
          c.status,
          profile?.full_name || '',
          profile?.email || '',
          new Date(c.created_at).toLocaleString(),
          c.resolved_at ? new Date(c.resolved_at).toLocaleString() : '',
          `"${(c.admin_response || '').replace(/"/g, '""')}"`,
        ];
      });

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `complaints_report_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      toast.success(`Exported ${complaints.length} complaints to CSV`);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const summaryCards = [
    { label: 'Total Complaints', value: totalComplaints, icon: FileText, color: 'text-primary' },
    { label: 'Total Students', value: totalStudents, icon: Users, color: 'text-accent' },
    { label: 'Resolution Rate', value: `${resolutionRate}%`, icon: CheckCircle, color: 'text-status-resolved' },
  ];

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">View complaint statistics and export data</p>
        </div>
        
        {/* Export Filters */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Export Filters
            </CardTitle>
            <CardDescription>Apply filters before exporting to CSV</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="filter-status">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger id="filter-status">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="filter-category">Category</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger id="filter-category">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="date-from">From Date</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="date-to">To Date</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              
              <Button onClick={exportToCSV} disabled={exporting} className="gap-2">
                <Download className="h-4 w-4" />
                {exporting ? 'Exporting...' : 'Export CSV'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaryCards.map((stat, index) => (
          <Card key={stat.label} className="shadow-card animate-scale-in" style={{ animationDelay: `${index * 50}ms` }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-display font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`h-12 w-12 rounded-xl bg-muted flex items-center justify-center`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display">Status Distribution</CardTitle>
            <CardDescription>Breakdown of complaints by current status</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 bg-muted animate-pulse rounded-lg" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display">Complaints by Category</CardTitle>
            <CardDescription>Number of complaints per category</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 bg-muted animate-pulse rounded-lg" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryStats} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(217, 91%, 25%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data Table Summary */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Quick Stats</CardTitle>
          <CardDescription>Summary of complaint statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-display font-bold text-status-submitted">
                {statusStats.find(s => s.name === 'Submitted')?.value || 0}
              </p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-display font-bold text-status-in-review">
                {statusStats.find(s => s.name === 'In Review')?.value || 0}
              </p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-display font-bold text-status-resolved">
                {statusStats.find(s => s.name === 'Resolved')?.value || 0}
              </p>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-display font-bold text-primary">
                {totalComplaints}
              </p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
