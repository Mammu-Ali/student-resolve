import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area, RadialBarChart, RadialBar, ComposedChart, Line } from 'recharts';
import { Download, Users, FileText, CheckCircle, Filter, TrendingUp, Clock, Calendar, Target, Zap, ArrowUpRight, ArrowDownRight, Minus, RefreshCw, BarChart3, PieChartIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

interface CategoryStats {
  name: string;
  count: number;
  fill: string;
}

interface StatusStats {
  name: string;
  value: number;
  color: string;
  fill: string;
}

interface Category {
  id: string;
  name: string;
}

interface TrendData {
  date: string;
  submitted: number;
  resolved: number;
  cumulative: number;
}

interface ResolutionTimeData {
  category: string;
  avgDays: number;
  count: number;
  fill: string;
}

interface PriorityData {
  name: string;
  value: number;
  color: string;
  fill: string;
}

interface PerformanceMetric {
  label: string;
  value: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

const CHART_COLORS = [
  'hsl(217, 91%, 60%)',
  'hsl(173, 58%, 39%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 65%, 60%)',
  'hsl(340, 75%, 55%)',
  'hsl(190, 70%, 50%)',
];

const PRIORITY_COLORS = {
  low: 'hsl(142, 71%, 45%)',
  medium: 'hsl(38, 92%, 50%)',
  high: 'hsl(25, 95%, 53%)',
  critical: 'hsl(0, 84%, 60%)',
};

const STATUS_COLORS = {
  submitted: 'hsl(215, 14%, 45%)',
  in_review: 'hsl(38, 92%, 50%)',
  resolved: 'hsl(142, 71%, 45%)',
};

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
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d' | '90d'>('7d');
  
  // Export filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const dateRangeDays = useMemo(() => {
    switch (dateRange) {
      case '7d': return 7;
      case '14d': return 14;
      case '30d': return 30;
      case '90d': return 90;
      default: return 7;
    }
  }, [dateRange]);

  useEffect(() => {
    fetchReportData();
    fetchCategories();
  }, [dateRange]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name').order('name');
    if (data) setCategories(data);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReportData();
    setRefreshing(false);
    toast.success('Data refreshed');
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
          { name: 'Pending', value: statusCounts.submitted, color: STATUS_COLORS.submitted, fill: STATUS_COLORS.submitted },
          { name: 'In Review', value: statusCounts.in_review, color: STATUS_COLORS.in_review, fill: STATUS_COLORS.in_review },
          { name: 'Resolved', value: statusCounts.resolved, color: STATUS_COLORS.resolved, fill: STATUS_COLORS.resolved },
        ]);

        const rate = complaints.length > 0 
          ? Math.round((statusCounts.resolved / complaints.length) * 100) 
          : 0;
        setResolutionRate(rate);

        // Priority stats
        const priorityCounts = {
          low: complaints.filter(c => c.priority === 'low').length,
          medium: complaints.filter(c => c.priority === 'medium').length,
          high: complaints.filter(c => c.priority === 'high').length,
          critical: complaints.filter(c => c.priority === 'critical').length,
        };

        setPriorityData([
          { name: 'Low', value: priorityCounts.low, color: PRIORITY_COLORS.low, fill: PRIORITY_COLORS.low },
          { name: 'Medium', value: priorityCounts.medium, color: PRIORITY_COLORS.medium, fill: PRIORITY_COLORS.medium },
          { name: 'High', value: priorityCounts.high, color: PRIORITY_COLORS.high, fill: PRIORITY_COLORS.high },
          { name: 'Critical', value: priorityCounts.critical, color: PRIORITY_COLORS.critical, fill: PRIORITY_COLORS.critical },
        ]);

        // Calculate average resolution time
        const resolvedComplaints = complaints.filter(c => c.status === 'resolved' && c.resolved_at);
        let avgDays = 0;
        if (resolvedComplaints.length > 0) {
          const totalDays = resolvedComplaints.reduce((acc, c) => {
            const created = new Date(c.created_at);
            const resolved = new Date(c.resolved_at!);
            const days = Math.ceil((resolved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
            return acc + Math.max(0, days);
          }, 0);
          avgDays = Math.round((totalDays / resolvedComplaints.length) * 10) / 10;
          setAvgResolutionTime(avgDays);
        }

        // Performance metrics
        setPerformanceMetrics([
          { label: 'Resolution Rate', value: rate, target: 80, unit: '%', trend: rate >= 70 ? 'up' : 'down', trendValue: 5 },
          { label: 'Avg. Resolution', value: avgDays, target: 3, unit: 'days', trend: avgDays <= 3 ? 'up' : 'down', trendValue: avgDays <= 3 ? 0.5 : -0.3 },
          { label: 'Active Cases', value: statusCounts.submitted + statusCounts.in_review, target: 10, unit: '', trend: 'stable', trendValue: 0 },
          { label: 'This Week', value: complaints.filter(c => {
            const created = new Date(c.created_at);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return created >= weekAgo;
          }).length, target: 20, unit: 'new', trend: 'stable', trendValue: 2 },
        ]);

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
            .map(([category, data], index) => ({
              category,
              avgDays: Math.round((data.total / data.count) * 10) / 10,
              count: data.count,
              fill: CHART_COLORS[index % CHART_COLORS.length],
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
            .map(([name, count], index) => ({ name, count, fill: CHART_COLORS[index % CHART_COLORS.length] }))
            .sort((a, b) => b.count - a.count)
        );

        // Generate trend data based on selected range
        const trendDays: TrendData[] = [];
        let cumulativeTotal = 0;
        
        for (let i = dateRangeDays - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          const dayLabel = dateRangeDays <= 14 
            ? date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
            : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          
          const dayComplaints = complaints.filter(c => {
            const createdDate = new Date(c.created_at).toISOString().split('T')[0];
            return createdDate === dateStr;
          });
          
          const dayResolved = complaints.filter(c => {
            if (!c.resolved_at) return false;
            const resolvedDate = new Date(c.resolved_at).toISOString().split('T')[0];
            return resolvedDate === dateStr;
          });

          cumulativeTotal += dayComplaints.length;

          trendDays.push({
            date: dayLabel,
            submitted: dayComplaints.length,
            resolved: dayResolved.length,
            cumulative: cumulativeTotal,
          });
        }
        setTrendData(trendDays);
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
          id, subject, description, status, priority, admin_response, created_at, updated_at, resolved_at,
          category:categories(name),
          user_id
        `)
        .order('created_at', { ascending: false });

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

      const userIds = [...new Set(complaints.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const headers = ['ID', 'Subject', 'Category', 'Status', 'Priority', 'Student Name', 'Student Email', 'Created At', 'Resolved At', 'Resolution Days', 'Admin Response'];
      const rows = complaints.map((c: any) => {
        const profile = profileMap.get(c.user_id);
        const resolutionDays = c.resolved_at 
          ? Math.ceil((new Date(c.resolved_at).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : '';
        return [
          c.id,
          `"${(c.subject || '').replace(/"/g, '""')}"`,
          c.category?.name || '',
          c.status,
          c.priority,
          profile?.full_name || '',
          profile?.email || '',
          new Date(c.created_at).toLocaleString(),
          c.resolved_at ? new Date(c.resolved_at).toLocaleString() : '',
          resolutionDays,
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

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    if (trend === 'up') return <ArrowUpRight className="h-4 w-4 text-status-resolved" />;
    if (trend === 'down') return <ArrowDownRight className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const LoadingSkeleton = ({ height = "h-64" }: { height?: string }) => (
    <div className={`${height} space-y-3`}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-full w-full rounded-xl" />
    </div>
  );

  const summaryCards = [
    { label: 'Total Complaints', value: totalComplaints, icon: FileText, color: 'text-primary', bgColor: 'bg-primary/10', gradient: 'from-primary/20 to-primary/5' },
    { label: 'Active Students', value: totalStudents, icon: Users, color: 'text-accent', bgColor: 'bg-accent/10', gradient: 'from-accent/20 to-accent/5' },
    { label: 'Resolution Rate', value: `${resolutionRate}%`, icon: Target, color: 'text-status-resolved', bgColor: 'bg-status-resolved/10', gradient: 'from-status-resolved/20 to-status-resolved/5' },
    { label: 'Avg. Resolution', value: `${avgResolutionTime}d`, icon: Zap, color: 'text-status-in-review', bgColor: 'bg-status-in-review/10', gradient: 'from-status-in-review/20 to-status-in-review/5' },
  ];

  const radialData = [
    { name: 'Resolution Rate', value: resolutionRate, fill: 'hsl(142, 71%, 45%)' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">Comprehensive insights into complaint management performance</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="14d">Last 14 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((stat, index) => (
          <Card 
            key={stat.label} 
            className={`relative overflow-hidden border-0 shadow-lg animate-scale-in bg-gradient-to-br ${stat.gradient}`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl md:text-3xl font-display font-bold">{loading ? '—' : stat.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl ${stat.bgColor} flex items-center justify-center shrink-0`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Metrics */}
      <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Performance Metrics
          </CardTitle>
          <CardDescription>Key performance indicators and targets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {performanceMetrics.map((metric, index) => (
              <div key={metric.label} className="p-4 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
                  <TrendIcon trend={metric.trend} />
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl font-display font-bold">{metric.value}</span>
                  <span className="text-xs text-muted-foreground">{metric.unit}</span>
                </div>
                <Progress value={Math.min((metric.value / metric.target) * 100, 100)} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-1">Target: {metric.target}{metric.unit}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Charts */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="trends" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Trends</span>
          </TabsTrigger>
          <TabsTrigger value="distribution" className="gap-2">
            <PieChartIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Distribution</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Categories</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Complaint Activity
              </CardTitle>
              <CardDescription>Daily submissions and resolutions over the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingSkeleton height="h-80" />
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
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
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickLine={false}
                      />
                      <YAxis 
                        allowDecimals={false} 
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                          boxShadow: '0 10px 40px -10px hsl(var(--foreground) / 0.1)'
                        }} 
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Area 
                        type="monotone" 
                        dataKey="submitted" 
                        name="Submitted"
                        stroke="hsl(217, 91%, 60%)" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorSubmitted)" 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="resolved" 
                        name="Resolved"
                        stroke="hsl(142, 71%, 45%)" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorResolved)" 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="cumulative" 
                        name="Cumulative"
                        stroke="hsl(280, 65%, 60%)" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Status Distribution */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="font-display">Status Overview</CardTitle>
                <CardDescription>Current distribution of complaint statuses</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <LoadingSkeleton />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusStats}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {statusStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '12px'
                          }} 
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Priority Distribution */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="font-display">Priority Breakdown</CardTitle>
                <CardDescription>Distribution by urgency level</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <LoadingSkeleton />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={priorityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {priorityData.map((entry, index) => (
                            <Cell key={`cell-priority-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '12px'
                          }} 
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Resolution Gauge */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-status-resolved" />
                Resolution Performance
              </CardTitle>
              <CardDescription>Overall complaint resolution efficiency</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <div className="h-48 w-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart 
                      cx="50%" 
                      cy="50%" 
                      innerRadius="60%" 
                      outerRadius="100%" 
                      barSize={12} 
                      data={radialData}
                      startAngle={180}
                      endAngle={0}
                    >
                      <RadialBar
                        background={{ fill: 'hsl(var(--muted))' }}
                        dataKey="value"
                        cornerRadius={10}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="text-center -mt-20">
                    <span className="text-4xl font-display font-bold">{resolutionRate}%</span>
                    <p className="text-sm text-muted-foreground">Resolved</p>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-4">
                  {statusStats.map(stat => (
                    <div key={stat.name} className="text-center p-4 rounded-xl bg-muted/50">
                      <div className="h-3 w-3 rounded-full mx-auto mb-2" style={{ backgroundColor: stat.fill }} />
                      <p className="text-2xl font-display font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Category Distribution */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="font-display">Complaints by Category</CardTitle>
                <CardDescription>Volume distribution across categories</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <LoadingSkeleton height="h-72" />
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryStats} layout="vertical" margin={{ left: 10, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={100} 
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '12px'
                          }} 
                        />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resolution Time by Category */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Clock className="h-5 w-5 text-status-in-review" />
                  Resolution Time
                </CardTitle>
                <CardDescription>Average days to resolve by category</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <LoadingSkeleton height="h-72" />
                ) : resolutionTimeData.length === 0 ? (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No resolved complaints yet</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={resolutionTimeData} layout="vertical" margin={{ left: 10, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                        <XAxis 
                          type="number" 
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                          tickFormatter={(v) => `${v}d`}
                        />
                        <YAxis 
                          dataKey="category" 
                          type="category" 
                          width={100} 
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip 
                          formatter={(value: number, name: string, props: any) => [
                            `${value} days (${props.payload.count} complaints)`, 
                            'Avg. Resolution'
                          ]}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '12px'
                          }} 
                        />
                        <Bar dataKey="avgDays" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Export Section */}
      <Card className="shadow-lg border-0 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Export Data
          </CardTitle>
          <CardDescription>Download filtered complaint data as CSV</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="filter-status" className="text-xs font-medium">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="filter-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="submitted">Pending</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="filter-category" className="text-xs font-medium">Category</Label>
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
              <Label htmlFor="date-from" className="text-xs font-medium">From Date</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date-to" className="text-xs font-medium">To Date</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            
            <Button onClick={exportToCSV} disabled={exporting} className="gap-2 h-10">
              <Download className="h-4 w-4" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
