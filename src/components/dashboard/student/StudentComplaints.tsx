import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Search, Filter, Eye, Paperclip, Download, MessageSquare, Send, Loader2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';

interface Complaint {
  id: string;
  subject: string;
  description: string;
  status: 'submitted' | 'in_review' | 'resolved';
  admin_response: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  category: { id: string; name: string };
}

interface Comment {
  id: string;
  content: string;
  is_admin: boolean;
  created_at: string;
  user_id: string;
}

export default function StudentComplaints() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filteredComplaints, setFilteredComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    if (user) {
      fetchComplaints();
    }
  }, [user]);

  useEffect(() => {
    filterComplaints();
  }, [complaints, searchQuery, statusFilter]);

  const fetchComplaints = async () => {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*, category:categories(id, name)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComplaints(data as unknown as Complaint[]);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterComplaints = () => {
    let filtered = [...complaints];

    if (searchQuery) {
      filtered = filtered.filter(
        (c) =>
          c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    setFilteredComplaints(filtered);
  };

  const openComplaint = async (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setNewComment('');

    // Fetch comments
    const { data } = await supabase
      .from('complaint_comments')
      .select('*')
      .eq('complaint_id', complaint.id)
      .order('created_at', { ascending: true });
    setComments((data as Comment[]) || []);
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
          is_admin: false,
        }])
        .select()
        .single();

      if (error) throw error;

      setComments([...comments, data as Comment]);
      setNewComment('');
      toast.success('Message sent');
    } catch (error: unknown) {
      console.error('Error sending comment:', error);
      toast.error('Failed to send message');
    } finally {
      setSendingComment(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">My Complaints</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">View and track all your submitted complaints</p>
      </div>

      {/* Filters */}
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search complaints..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Complaints List */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Complaints ({filteredComplaints.length})</CardTitle>
          <CardDescription>Click on a complaint to view details</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
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
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{complaint.subject}</p>
                      <StatusBadge status={complaint.status} />
                      {complaint.attachment_url && (
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{complaint.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {complaint.category?.name} • {new Date(complaint.created_at).toLocaleDateString()}
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedComplaint} onOpenChange={() => setSelectedComplaint(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {selectedComplaint && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <DialogTitle className="font-display">{selectedComplaint.subject}</DialogTitle>
                  <StatusBadge status={selectedComplaint.status} />
                </div>
                <DialogDescription>
                  {selectedComplaint.category?.name} • Submitted on {new Date(selectedComplaint.created_at).toLocaleDateString()}
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

                  {selectedComplaint.admin_response && (
                    <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                      <h4 className="text-sm font-medium text-accent mb-2">Admin Response</h4>
                      <p className="text-foreground">{selectedComplaint.admin_response}</p>
                    </div>
                  )}

                  {/* Comments / Messages Section */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Messages ({comments.length})
                    </h4>
                    <div className="space-y-3 mb-4">
                      {comments.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No messages yet. Send a message to communicate with the admin.</p>
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
                                {comment.is_admin ? 'Admin' : 'You'}
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
                        placeholder="Type a message..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendComment()}
                      />
                      <Button size="icon" onClick={handleSendComment} disabled={sendingComment || !newComment.trim()}>
                        {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>Last updated: {new Date(selectedComplaint.updated_at).toLocaleString()}</span>
                    {selectedComplaint.resolved_at && (
                      <span>Resolved: {new Date(selectedComplaint.resolved_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}