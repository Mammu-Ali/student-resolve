import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FileText, Search, Filter, Eye, Loader2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';

interface Complaint {
  id: string;
  subject: string;
  description: string;
  status: 'submitted' | 'in_review' | 'resolved';
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  category: { id: string; name: string };
  profile: { full_name: string; email: string };
}

export default function AdminComplaints() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filteredComplaints, setFilteredComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [adminResponse, setAdminResponse] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchComplaints();
    fetchCategories();
  }, []);

  useEffect(() => {
    filterComplaints();
  }, [complaints, searchQuery, statusFilter, categoryFilter]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name').order('name');
    setCategories(data || []);
  };

  const fetchComplaints = async () => {
    try {
      // Fetch complaints with categories
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          *,
          category:categories(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for all users
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, { full_name: p.full_name, email: p.email }]) || []);
        
        const complaintsWithProfiles = data.map(c => ({
          ...c,
          profile: profileMap.get(c.user_id) || { full_name: 'Unknown', email: 'Unknown' }
        }));
        
        setComplaints(complaintsWithProfiles as unknown as Complaint[]);
      } else {
        setComplaints([]);
      }
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterComplaints = () => {
    let filtered = [...complaints];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.subject.toLowerCase().includes(query) ||
          c.description.toLowerCase().includes(query) ||
          c.profile?.full_name?.toLowerCase().includes(query) ||
          c.profile?.email?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((c) => c.category?.id === categoryFilter);
    }

    setFilteredComplaints(filtered);
  };

  const openComplaint = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setNewStatus(complaint.status);
    setAdminResponse(complaint.admin_response || '');
  };

  const handleUpdateComplaint = async () => {
    if (!selectedComplaint) return;

    setUpdating(true);

    try {
      const updates: any = {
        status: newStatus,
        admin_response: adminResponse.trim() || null,
      };

      if (newStatus === 'resolved' && selectedComplaint.status !== 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('complaints')
        .update(updates)
        .eq('id', selectedComplaint.id);

      if (updateError) throw updateError;

      // Log the action
      await supabase.from('complaint_logs').insert([{
        complaint_id: selectedComplaint.id,
        action: `Status changed from ${selectedComplaint.status} to ${newStatus}`,
        old_status: selectedComplaint.status as 'submitted' | 'in_review' | 'resolved',
        new_status: newStatus as 'submitted' | 'in_review' | 'resolved',
        notes: adminResponse.trim() || null,
        performed_by: user!.id,
      }]);

      toast.success('Complaint updated successfully');
      setSelectedComplaint(null);
      fetchComplaints();
    } catch (error: any) {
      console.error('Error updating complaint:', error);
      toast.error(error.message || 'Failed to update complaint');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">All Complaints</h1>
        <p className="text-muted-foreground mt-1">Review and manage student complaints</p>
      </div>

      {/* Filters */}
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by subject, description, student name or email..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Complaints List */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Complaints ({filteredComplaints.length})</CardTitle>
          <CardDescription>Click on a complaint to view and update</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No complaints found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredComplaints.map((complaint, index) => (
                <div
                  key={complaint.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer animate-slide-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                  onClick={() => openComplaint(complaint)}
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{complaint.subject}</p>
                      <StatusBadge status={complaint.status} />
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{complaint.description}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">{complaint.profile?.full_name || 'Unknown'}</span>
                      {' • '}{complaint.category?.name}
                      {' • '}{new Date(complaint.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 ml-4">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Dialog */}
      <Dialog open={!!selectedComplaint} onOpenChange={() => setSelectedComplaint(null)}>
        <DialogContent className="max-w-2xl">
          {selectedComplaint && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <DialogTitle className="font-display">{selectedComplaint.subject}</DialogTitle>
                  <StatusBadge status={selectedComplaint.status} />
                </div>
                <DialogDescription>
                  Submitted by <span className="font-medium">{selectedComplaint.profile?.full_name}</span> ({selectedComplaint.profile?.email})
                  <br />
                  {selectedComplaint.category?.name} • {new Date(selectedComplaint.created_at).toLocaleString()}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 mt-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                  <p className="text-foreground bg-muted/50 p-4 rounded-lg">{selectedComplaint.description}</p>
                </div>

                <div className="space-y-2">
                  <Label>Update Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Admin Response</Label>
                  <Textarea
                    placeholder="Add your response or resolution notes..."
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setSelectedComplaint(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateComplaint} disabled={updating}>
                  {updating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Complaint'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
