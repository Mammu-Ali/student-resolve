-- Create priority enum
CREATE TYPE public.complaint_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Add priority column to complaints
ALTER TABLE public.complaints 
ADD COLUMN priority complaint_priority NOT NULL DEFAULT 'medium';

-- Create complaint_comments table for back-and-forth messaging
CREATE TABLE public.complaint_comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.complaint_comments ENABLE ROW LEVEL SECURITY;

-- Comments policies: admins can do everything
CREATE POLICY "Admins can view all comments"
ON public.complaint_comments
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert comments"
ON public.complaint_comments
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Students can view comments on their own complaints
CREATE POLICY "Students can view comments on their complaints"
ON public.complaint_comments
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.complaints
        WHERE complaints.id = complaint_comments.complaint_id
        AND complaints.user_id = auth.uid()
    )
);

-- Students can add comments to their own complaints
CREATE POLICY "Students can add comments to their complaints"
ON public.complaint_comments
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.complaints
        WHERE complaints.id = complaint_comments.complaint_id
        AND complaints.user_id = auth.uid()
    )
    AND is_admin = false
);

-- Create index for faster queries
CREATE INDEX idx_complaint_comments_complaint_id ON public.complaint_comments(complaint_id);
CREATE INDEX idx_complaints_priority ON public.complaints(priority);