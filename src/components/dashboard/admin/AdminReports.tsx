import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area } from 'recharts';
import { Download, Users, FileText, CheckCircle, Filter, TrendingUp, Clock } from 'lucide-react';
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

interface TrendData {
  date: string;
  submitted: number;
  resolved: number;
  total: number;
}

interface ResolutionTimeData {
  category: string;
  avgDays: number;
}

interface PriorityData {
  name: string;
  value: number;
  color: string;
}

export default function AdminReports() {
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [statusStats, setStatusStats] = useState<StatusStats[]>([]);
  const [totalComplaints, setTotalComplaints] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [resolutionRate, setResolutionRate] = useState(0);
  const [avgResolutionTime, setAvgResolutionTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [resolutionTimeData, setResolutionTimeData] = useState<ResolutionTimeData[]>([]);
  const [priorityData, setPriorityData] = useState<PriorityData[]>([]);
  
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
        .select('status, priority, created_at, resolved_at, category:categories(name)');

      if (complaints) {
        setTotalComplaints(complaints.length);

        // Status stats
        const statusCounts = {
          submitted: complaints.filter(c => c.status === 'submitted').length,
          in_review: complaints.filter(c => c.status === 'in_review').length,
          resolved: complaints.filter(c => c.status === 'resolved').length,
        };

        setStatusStats([
          { name: 'Submitted', value: statusCounts.submitted, color: 'hsl(var(--status-submitted))' },
          { name: 'In Review', value: statusCounts.in_review, color: 'hsl(var(--status-in-review))' },
          { name: 'Resolved', value: statusCounts.resolved, color: 'hsl(var(--status-resolved))' },
        ]);

        setResolutionRate(
          complaints.length > 0 
            ? Math.round((statusCounts.resolved / complaints.length) * 100) 
            : 0
        );

        // Priority stats
        const priorityCounts = {
          low: complaints.filter(c => c.priority === 'low').length,
          medium: complaints.filter(c => c.priority === 'medium').length,
          high: complaints.filter(c => c.priority === 'high').length,
          critical: complaints.filter(c => c.priority === 'critical').length,
        };

        setPriorityData([
          { name: 'Low', value: priorityCounts.low, color: 'hsl(142, 71%, 45%)' },
          { name: 'Medium', value: priorityCounts.medium, color: 'hsl(38, 92%, 50%)' },
          { name: 'High', value: priorityCounts.high, color: 'hsl(25, 95%, 53%)' },
          { name: 'Critical', value: priorityCounts.critical, color: 'hsl(0, 84%, 60%)' },
        ]);

        // Calculate average resolution time
        const resolvedComplaints = complaints.filter(c => c.status === 'resolved' && c.resolved_at);
        if (resolvedComplaints.length > 0) {
          const totalDays = resolvedComplaints.reduce((acc, c) => {
            const created = new Date(c.created_at);
            const resolved = new Date(c.resolved_at!);
            const days = Math.ceil((resolved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
            return acc + Math.max(0, days);
          }, 0);
          setAvgResolutionTime(Math.round(totalDays / resolvedComplaints.length));
        }

        // Calculate resolution time by category
        const catResolutionTimes: Record<string, { total: number; count: number }> = {};
        resolvedComplaints.forEach((c: any) => {
          const catName = c.category?.name || 'Unknown';
          const created = new Date(c.created_at);
          const resolved = new Date(c.resolved_at!);
          const days = Math.ceil((resolved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          
          if (!catResolutionTimes[catName]) {
            catResolutionTimes[catName] = { total: 0, count: 0 };
          }
          catResolutionTimes[catName].total += Math.max(0, days);
          catResolutionTimes[catName].count += 1;
        });

        setResolutionTimeData(
          Object.entries(catResolutionTimes)
            .map(([category, data]) => ({
              category,
              avgDays: Math.round(data.total / data.count),
            }))
            .sort((a, b) => b.avgDays - a.avgDays)
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

        // Generate trend data (last 7 days)
        const last7Days: TrendData[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          
          const dayComplaints = complaints.filter(c => {
            const createdDate = new Date(c.created_at).toISOString().split('T')[0];
            return createdDate === dateStr;
          });
          
          const dayResolved = complaints.filter(c => {
            if (!c.resolved_at) return false;
            const resolvedDate = new Date(c.resolved_at).toISOString().split('T')[0];
            return resolvedDate === dateStr;
          });

          last7Days.push({
            date: dayLabel,
            submitted: dayComplaints.length,
            resolved: dayResolved.length,
            total: complaints.filter(c => new Date(c.created_at) <= date).length,
          });
        }
        setTrendData(last7Days);
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
    { label: 'Total Complaints', value: totalComplaints, icon: FileText, color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Total Students', value: totalStudents, icon: Users, color: 'text-accent', bgColor: 'bg-accent/10' },
    { label: 'Resolution Rate', value: `${resolutionRate}%`, icon: CheckCircle, color: 'text-status-resolved', bgColor: 'bg-status-resolved/10' },
    { label: 'Avg. Resolution Time', value: `${avgResolutionTime} days`, icon: Clock, color: 'text-status-in-review', bgColor: 'bg-status-in-review/10' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">View complaint statistics, trends, and export data</p>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((stat, index) => (
          <Card key={stat.label} className="shadow-card animate-scale-in" style={{ animationDelay: `${index * 50}ms` }}>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-xl md:text-3xl font-display font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`h-10 w-10 md:h-12 md:w-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`h-5 w-5 md:h-6 md:w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Complaint Trends Chart */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Complaint Trends (Last 7 Days)
          </CardTitle>
          <CardDescription>Daily submitted and resolved complaints over the past week</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-72 bg-muted animate-pulse rounded-lg" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSubmitted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="submitted" 
                    name="Submitted"
                    stroke="hsl(217, 91%, 60%)" 
                    fillOpacity={1} 
                    fill="url(#colorSubmitted)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="resolved" 
                    name="Resolved"
                    stroke="hsl(142, 71%, 45%)" 
                    fillOpacity={1} 
                    fill="url(#colorResolved)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Priority and Resolution Time Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Distribution */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display">Priority Distribution</CardTitle>
            <CardDescription>Breakdown of complaints by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 bg-muted animate-pulse rounded-lg" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={priorityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {priorityData.map((entry, index) => (
                        <Cell key={`cell-priority-${index}`} fill={entry.color} />
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

        {/* Resolution Time by Category */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Avg. Resolution Time by Category
            </CardTitle>
            <CardDescription>Average days to resolve complaints per category</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 bg-muted animate-pulse rounded-lg" />
            ) : resolutionTimeData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <p>No resolved complaints yet</p>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resolutionTimeData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" unit=" days" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="category" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [`${value} days`, 'Avg. Resolution Time']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="avgDays" fill="hsl(38, 92%, 50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Summary */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Quick Stats</CardTitle>
          <CardDescription>Summary of complaint statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-status-submitted/10 text-center">
              <p className="text-2xl font-display font-bold text-status-submitted">
                {statusStats.find(s => s.name === 'Submitted')?.value || 0}
              </p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
            <div className="p-4 rounded-lg bg-status-in-review/10 text-center">
              <p className="text-2xl font-display font-bold text-status-in-review">
                {statusStats.find(s => s.name === 'In Review')?.value || 0}
              </p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
            <div className="p-4 rounded-lg bg-status-resolved/10 text-center">
              <p className="text-2xl font-display font-bold text-status-resolved">
                {statusStats.find(s => s.name === 'Resolved')?.value || 0}
              </p>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </div>
            <div className="p-4 rounded-lg bg-primary/10 text-center">
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
