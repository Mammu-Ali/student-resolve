-- Create storage bucket for complaint attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'complaint-attachments',
  'complaint-attachments',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- Policy: Students can upload files to their own folder
CREATE POLICY "Students can upload their own attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'complaint-attachments' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Students can view their own attachments
CREATE POLICY "Students can view their own attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'complaint-attachments' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Students can delete their own attachments
CREATE POLICY "Students can delete their own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'complaint-attachments' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Admins can view all attachments
CREATE POLICY "Admins can view all attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'complaint-attachments' 
  AND public.has_role(auth.uid(), 'admin')
);