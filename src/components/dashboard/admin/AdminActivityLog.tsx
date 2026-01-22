import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, History, Filter } from 'lucide-react';

interface LogEntry {
  id: string;
  complaint_id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  notes: string | null;
  created_at: string;
  performed_by: string;
  admin_name?: string;
  complaint_subject?: string;
}

export default function AdminActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, searchQuery, actionFilter]);

  const fetchLogs = async () => {
    try {
      const { data: logsData, error } = await supabase
        .from('complaint_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      if (logsData && logsData.length > 0) {
        // Fetch admin names
        const adminIds = [...new Set(logsData.map(l => l.performed_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', adminIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        // Fetch complaint subjects
        const complaintIds = [...new Set(logsData.map(l => l.complaint_id))];
        const { data: complaints } = await supabase
          .from('complaints')
          .select('id, subject')
          .in('id', complaintIds);

        const complaintMap = new Map(complaints?.map(c => [c.id, c.subject]) || []);

        const enrichedLogs = logsData.map(log => ({
          ...log,
          admin_name: profileMap.get(log.performed_by) || 'Unknown',
          complaint_subject: complaintMap.get(log.complaint_id) || 'Unknown',
        }));

        setLogs(enrichedLogs);
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.action.toLowerCase().includes(query) ||
          l.admin_name?.toLowerCase().includes(query) ||
          l.complaint_subject?.toLowerCase().includes(query) ||
          l.notes?.toLowerCase().includes(query)
      );
    }

    if (actionFilter !== 'all') {
      if (actionFilter === 'status') {
        filtered = filtered.filter((l) => l.action.toLowerCase().includes('status'));
      } else if (actionFilter === 'priority') {
        filtered = filtered.filter((l) => l.action.toLowerCase().includes('priority'));
      } else if (actionFilter === 'bulk') {
        filtered = filtered.filter((l) => l.action.toLowerCase().includes('bulk'));
      }
    }

    setFilteredLogs(filtered);
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    const colors: Record<string, string> = {
      submitted: 'bg-muted text-muted-foreground',
      in_review: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    };
    return (
      <Badge variant="outline" className={colors[status] || ''}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <History className="h-8 w-8" />
          Activity Log
        </h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          Track all admin actions on complaints for accountability
        </p>
      </div>

      {/* Filters */}
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by action, admin, complaint..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="status">Status Changes</SelectItem>
                <SelectItem value="priority">Priority Changes</SelectItem>
                <SelectItem value="bulk">Bulk Updates</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Recent Activity ({filteredLogs.length})</CardTitle>
          <CardDescription>Last 500 admin actions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No activity logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Complaint</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status Change</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log, index) => (
                    <TableRow
                      key={log.id}
                      className="animate-slide-in"
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">{log.admin_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={log.complaint_subject}>
                        {log.complaint_subject}
                      </TableCell>
                      <TableCell className="text-sm">{log.action}</TableCell>
                      <TableCell>
                        {log.old_status && log.new_status && (
                          <div className="flex items-center gap-1">
                            {getStatusBadge(log.old_status)}
                            <span className="text-muted-foreground">→</span>
                            {getStatusBadge(log.new_status)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground" title={log.notes || ''}>
                        {log.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
