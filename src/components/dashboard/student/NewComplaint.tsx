import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Send, FileText } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description: string;
}

export default function NewComplaint({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCategories, setFetchingCategories] = useState(true);
  
  const [categoryId, setCategoryId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setFetchingCategories(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId || !subject.trim() || !description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (subject.trim().length < 5) {
      toast.error('Subject must be at least 5 characters');
      return;
    }

    if (description.trim().length < 20) {
      toast.error('Description must be at least 20 characters');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('complaints').insert({
        user_id: user!.id,
        category_id: categoryId,
        subject: subject.trim(),
        description: description.trim(),
      });

      if (error) throw error;

      toast.success('Complaint submitted successfully!');
      onSuccess();
    } catch (error: any) {
      console.error('Error submitting complaint:', error);
      toast.error(error.message || 'Failed to submit complaint');
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Submit New Complaint</h1>
        <p className="text-muted-foreground mt-1">Fill out the form below to submit your complaint</p>
      </div>

      <Card className="shadow-elevated">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="font-display">Complaint Details</CardTitle>
              <CardDescription>Provide as much detail as possible</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={fetchingCategories}>
                <SelectTrigger>
                  <SelectValue placeholder={fetchingCategories ? 'Loading...' : 'Select a category'} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCategory && (
                <p className="text-sm text-muted-foreground">{selectedCategory.description}</p>
              )}
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                placeholder="Brief summary of your complaint"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground text-right">{subject.length}/100</p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Provide detailed information about your complaint. Include relevant dates, locations, people involved, and any other details that might help us address your concern."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">{description.length}/2000</p>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-4 pt-4">
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit Complaint
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-accent/5 border-accent/20">
        <CardContent className="p-6">
          <h3 className="font-medium text-accent mb-2">What happens next?</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Your complaint will be reviewed by our administrative team</li>
            <li>• You can track the status of your complaint in the "My Complaints" section</li>
            <li>• You'll see the admin's response once they review your complaint</li>
            <li>• Average resolution time is 3-5 business days</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
