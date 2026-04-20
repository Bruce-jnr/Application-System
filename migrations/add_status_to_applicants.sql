-- Add status column to applicants table
ALTER TABLE applicants
ADD COLUMN status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending';

-- Create index for better performance
CREATE INDEX idx_applicants_status ON applicants(status);

-- Update existing records to have 'pending' status
UPDATE applicants SET status = 'pending' WHERE status IS NULL; 