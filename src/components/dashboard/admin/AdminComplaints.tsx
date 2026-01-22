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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { FileText, Search, Filter, Eye, Loader2, Paperclip, Download, CheckSquare, Send, MessageSquare, AlertTriangle, AlertCircle, Info, Flame } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

type Priority = 'low' | 'medium' | 'high' | 'critical';

interface Complaint {
  id: string;
  subject: string;
  description: string;
  status: 'submitted' | 'in_review' | 'resolved';
  priority: Priority;
  admin_response: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  category: { id: string; name: string };
  profile: { full_name: string; email: string };
  user_id: string;
}

interface Comment {
  id: string;
  content: string;
  is_admin: boolean;
  created_at: string;
  user_id: string;
}

const priorityConfig: Record<Priority, { label: string; color: string; icon: React.ElementType }> = {
  low: { label: 'Low', color: 'bg-muted text-muted-foreground', icon: Info },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: AlertCircle },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertTriangle },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: Flame },
};

function PriorityBadge({ priority }: { priority: Priority }) {
  const config = priorityConfig[priority];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`${config.color} gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
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
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [adminResponse, setAdminResponse] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [bulkPriority, setBulkPriority] = useState<string>('');
  
  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    fetchComplaints();
    fetchCategories();
  }, []);

  useEffect(() => {
    filterComplaints();
  }, [complaints, searchQuery, statusFilter, categoryFilter, priorityFilter]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name').order('name');
    setCategories(data || []);
  };

  const fetchComplaints = async () => {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select(`*, category:categories(id, name)`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, { full_name: p.full_name, email: p.email }]) || []);
        
        const complaintsWithProfiles = data.map(c => ({
          ...c,
          priority: (c as any).priority || 'medium',
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

    if (priorityFilter !== 'all') {
      filtered = filtered.filter((c) => c.priority === priorityFilter);
    }

    setFilteredComplaints(filtered);
  };

  const openComplaint = async (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setNewStatus(complaint.status);
    setNewPriority(complaint.priority);
    setAdminResponse(complaint.admin_response || '');
    setNewComment('');
    
    // Fetch comments
    const { data } = await supabase
      .from('complaint_comments')
      .select('*')
      .eq('complaint_id', complaint.id)
      .order('created_at', { ascending: true });
    setComments((data as Comment[]) || []);
  };

  const handleUpdateComplaint = async () => {
    if (!selectedComplaint) return;

    setUpdating(true);

    try {
      const updates: Record<string, unknown> = {
        status: newStatus,
        priority: newPriority,
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
        action: `Status: ${selectedComplaint.status} → ${newStatus}, Priority: ${selectedComplaint.priority} → ${newPriority}`,
        old_status: selectedComplaint.status as 'submitted' | 'in_review' | 'resolved',
        new_status: newStatus as 'submitted' | 'in_review' | 'resolved',
        notes: adminResponse.trim() || null,
        performed_by: user!.id,
      }]);

      toast.success('Complaint updated successfully');
      setSelectedComplaint(null);
      fetchComplaints();
    } catch (error: unknown) {
      console.error('Error updating complaint:', error);
      toast.error((error as Error).message || 'Failed to update complaint');
    } finally {
      setUpdating(false);
    }
  };

  const handleSendComment = async () => {
    if (!selectedComplaint || !newComment.trim()) return;

    setSendingComment(true);
    try {
      const { data, error } = await supabase
        .from('complaint_comments')
        .insert([{
          complaint_id: selectedComplaint.id,
          user_id: user!.id,
          content: newComment.trim(),
          is_admin: true,
        }])
        .select()
        .single();

      if (error) throw error;

      setComments([...comments, data as Comment]);
      setNewComment('');
      toast.success('Comment sent');
    } catch (error: unknown) {
      console.error('Error sending comment:', error);
      toast.error('Failed to send comment');
    } finally {
      setSendingComment(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredComplaints.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredComplaints.map(c => c.id)));
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;
    if (!bulkStatus && !bulkPriority) {
      toast.error('Select a status or priority to update');
      return;
    }

    setBulkUpdating(true);
    try {
      const updates: Record<string, unknown> = {};
      if (bulkStatus) updates.status = bulkStatus;
      if (bulkPriority) updates.priority = bulkPriority;
      if (bulkStatus === 'resolved') updates.resolved_at = new Date().toISOString();

      const { error } = await supabase
        .from('complaints')
        .update(updates)
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      // Log bulk action
      const logEntries = Array.from(selectedIds).map(id => ({
        complaint_id: id,
        action: `Bulk update: ${bulkStatus ? `Status → ${bulkStatus}` : ''}${bulkStatus && bulkPriority ? ', ' : ''}${bulkPriority ? `Priority → ${bulkPriority}` : ''}`,
        new_status: bulkStatus as 'submitted' | 'in_review' | 'resolved' | null || null,
        performed_by: user!.id,
      }));

      await supabase.from('complaint_logs').insert(logEntries);

      toast.success(`Updated ${selectedIds.size} complaints`);
      setSelectedIds(new Set());
      setBulkStatus('');
      setBulkPriority('');
      fetchComplaints();
    } catch (error) {
      console.error('Bulk update error:', error);
      toast.error('Failed to update complaints');
    } finally {
      setBulkUpdating(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">All Complaints</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">Review and manage student complaints</p>
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
              <SelectTrigger className="w-full lg:w-40">
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
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full lg:w-40">
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

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <Card className="shadow-card border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-primary" />
                <span className="font-medium">{selectedIds.size} selected</span>
              </div>
              <div className="flex flex-wrap gap-2 flex-1">
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Set status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={bulkPriority} onValueChange={setBulkPriority}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Set priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleBulkUpdate} disabled={bulkUpdating}>
                  {bulkUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Apply
                </Button>
                <Button variant="outline" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complaints List */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display">Complaints ({filteredComplaints.length})</CardTitle>
              <CardDescription>Click on a complaint to view and update</CardDescription>
            </div>
            {filteredComplaints.length > 0 && (
              <Button variant="outline" size="sm" onClick={toggleSelectAll} className="gap-2">
                <Checkbox
                  checked={selectedIds.size === filteredComplaints.length && filteredComplaints.length > 0}
                  className="pointer-events-none"
                />
                Select All
              </Button>
            )}
          </div>
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
                  className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors animate-slide-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <Checkbox
                    checked={selectedIds.has(complaint.id)}
                    onCheckedChange={() => toggleSelection(complaint.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div
                    className="flex items-center justify-between flex-1 min-w-0 cursor-pointer"
                    onClick={() => openComplaint(complaint)}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{complaint.subject}</p>
                        <StatusBadge status={complaint.status} />
                        <PriorityBadge priority={complaint.priority} />
                        {complaint.attachment_url && (
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Dialog */}
      <Dialog open={!!selectedComplaint} onOpenChange={() => setSelectedComplaint(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          {selectedComplaint && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 flex-wrap">
                  <DialogTitle className="font-display">{selectedComplaint.subject}</DialogTitle>
                  <StatusBadge status={selectedComplaint.status} />
                  <PriorityBadge priority={selectedComplaint.priority} />
                </div>
                <DialogDescription>
                  Submitted by <span className="font-medium">{selectedComplaint.profile?.full_name}</span> ({selectedComplaint.profile?.email})
                  <br />
                  {selectedComplaint.category?.name} • {new Date(selectedComplaint.created_at).toLocaleString()}
                </DialogDescription>
              </DialogHeader>
              
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6 mt-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                    <p className="text-foreground bg-muted/50 p-4 rounded-lg">{selectedComplaint.description}</p>
                  </div>

                  {selectedComplaint.attachment_url && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Attachment</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={async () => {
                          const { data } = await supabase.storage
                            .from('complaint-attachments')
                            .createSignedUrl(selectedComplaint.attachment_url!, 60);
                          if (data?.signedUrl) {
                            window.open(data.signedUrl, '_blank');
                          }
                        }}
                      >
                        <Download className="h-4 w-4" />
                        View Attachment
                      </Button>
                    </div>
                  )}

                  {/* Comments Section */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Comments ({comments.length})
                    </h4>
                    <div className="space-y-3 mb-4">
                      {comments.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No comments yet</p>
                      ) : (
                        comments.map((comment) => (
                          <div
                            key={comment.id}
                            className={`p-3 rounded-lg ${
                              comment.is_admin
                                ? 'bg-primary/10 border border-primary/20 ml-8'
                                : 'bg-muted mr-8'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium">
                                {comment.is_admin ? 'Admin' : 'Student'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(comment.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm">{comment.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendComment()}
                      />
                      <Button size="icon" onClick={handleSendComment} disabled={sendingComment || !newComment.trim()}>
                        {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <Label>Update Priority</Label>
                      <Select value={newPriority} onValueChange={(v) => setNewPriority(v as Priority)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
              </ScrollArea>

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
