-- Create database
DROP DATABASE IF EXISTS nsacoe_admissions;
SELECT 'Checking database connection...';
CREATE DATABASE IF NOT EXISTS nsacoe_admissions 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;
USE nsacoe_admissions;

-- Create tables (as shown in previous schema)
-- Include all CREATE TABLE statements from earlier

-- 1. Create vouchers table first
CREATE TABLE IF NOT EXISTS vouchers (
    voucher_id INT AUTO_INCREMENT PRIMARY KEY,
    serial_number VARCHAR(20) UNIQUE NOT NULL,
    pin_hash VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    batch_number VARCHAR(20),
    purchaser_email VARCHAR(100),
    created_by INT,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 2. Now create applicants table (with FK to vouchers)
CREATE TABLE IF NOT EXISTS applicants (
    applicant_id INT AUTO_INCREMENT PRIMARY KEY,
    voucher_id INT UNIQUE,
    title VARCHAR(10),
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    last_name VARCHAR(50) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender ENUM('male', 'female', 'other'),
    place_of_birth VARCHAR(100),
    birth_region VARCHAR(50),
    nationality VARCHAR(50) NOT NULL,
    residence_address VARCHAR(255) NOT NULL,
    address VARCHAR(255),           -- Added: for permanent/home address
    city VARCHAR(100),              -- Added: for city/town
    residence_region VARCHAR(50) NOT NULL,
    residence_district VARCHAR(50),
    country VARCHAR(50) NOT NULL,
    gps_code VARCHAR(20),
    phone_number VARCHAR(20) NOT NULL,
    phone_number2 VARCHAR(20),
    email VARCHAR(100),
    religion VARCHAR(50),
    disability_status ENUM('yes', 'no'),
    id_type VARCHAR(50) NOT NULL,
    id_number VARCHAR(50) NOT NULL,
    id_document_path VARCHAR(255),
    photo_path VARCHAR(255),
    how_heard VARCHAR(50),
    questions TEXT,
    agreed_to_terms BOOLEAN NOT NULL DEFAULT FALSE,
    agreed_to_policy BOOLEAN NOT NULL DEFAULT FALSE,
    application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('draft', 'submitted', 'under_review', 'accepted', 'rejected') DEFAULT 'draft',
    current_step TINYINT DEFAULT 1,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(voucher_id)
);

-- Add missing tables before creating indexes

CREATE TABLE IF NOT EXISTS academic_records (
    record_id INT AUTO_INCREMENT PRIMARY KEY,
    applicant_id INT NOT NULL,
    subject_type ENUM('core', 'elective') NOT NULL,
    subject_name VARCHAR(50) NOT NULL,
    index_number VARCHAR(20) NOT NULL,
    grade VARCHAR(2) NOT NULL,
    exam_type VARCHAR(20),
    exam_year YEAR,
    FOREIGN KEY (applicant_id) REFERENCES applicants(applicant_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parents_guardians (
    parent_id INT AUTO_INCREMENT PRIMARY KEY,
    applicant_id INT NOT NULL,
    relation ENUM('mother', 'father', 'guardian', 'other') NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    occupation VARCHAR(100),
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    is_primary BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (applicant_id) REFERENCES applicants(applicant_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
    contact_id INT AUTO_INCREMENT PRIMARY KEY,
    applicant_id INT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    relationship VARCHAR(50) NOT NULL,
    FOREIGN KEY (applicant_id) REFERENCES applicants(applicant_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS applicant_languages (
    language_id INT AUTO_INCREMENT PRIMARY KEY,
    applicant_id INT NOT NULL,
    language_name VARCHAR(50) NOT NULL,
    FOREIGN KEY (applicant_id) REFERENCES applicants(applicant_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS application_documents (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    applicant_id INT NOT NULL,
    document_type ENUM('id_document', 'photo', 'certificate', 'other') NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_data LONGBLOB NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (applicant_id) REFERENCES applicants(applicant_id) ON DELETE CASCADE
);

-- Now create indexes
CREATE INDEX idx_academic_records_applicant_id ON academic_records(applicant_id);
CREATE INDEX idx_parents_guardians_applicant_id ON parents_guardians(applicant_id);
CREATE INDEX idx_emergency_contacts_applicant_id ON emergency_contacts(applicant_id);
CREATE INDEX idx_applicant_languages_applicant_id ON applicant_languages(applicant_id);
CREATE INDEX idx_application_documents_applicant_id ON application_documents(applicant_id);

-- Create users table for admin and vendor authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_type ENUM('admin', 'vendor') NOT NULL DEFAULT 'vendor',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

-- Create initial admin user (password: admin123)
INSERT INTO users (username, password_hash, user_type) 
VALUES ('admin', '$2b$10$B.5OfWz9q7QeCV.8l1FmG.4ntF85LArUWTpugEFZNZ3hJLEF7dSvy', 'admin')
ON DUPLICATE KEY UPDATE user_type = 'admin';

-- Create initial vendor user (password: vendor123)
INSERT INTO users (username, password_hash, user_type)
VALUES ('vendor', '$2b$10$XbCl5kWmd7D/1W3IlMblF.466AVoTKeIAVLtS9fbeMhi0MgGZ9fGm', 'vendor')
ON DUPLICATE KEY UPDATE user_type = 'vendor';

-- Vendor API Keys table
CREATE TABLE IF NOT EXISTS vendor_api_keys (
    id INT PRIMARY KEY AUTO_INCREMENT,
    vendor_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    api_key VARCHAR(64) NOT NULL,
    api_key_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    FOREIGN KEY (vendor_id) REFERENCES users(id),
    UNIQUE KEY unique_api_key (api_key_hash)
);
