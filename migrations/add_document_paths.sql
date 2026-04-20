-- Add document path columns to applicants table
ALTER TABLE applicants
ADD COLUMN IF NOT EXISTS id_document_path VARCHAR(255) AFTER id_number,
ADD COLUMN IF NOT EXISTS photo_path VARCHAR(255) AFTER id_document_path;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_applicants_documents ON applicants(id_document_path, photo_path); 