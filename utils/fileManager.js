const fs = require('fs');
const path = require('path');

// Base uploads directory
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Create directory structure
const createDirectoryStructure = (applicantId) => {
    const applicantDir = path.join(UPLOADS_DIR, `applicant_${applicantId}`);
    const subDirs = ['photos', 'id_documents', 'birth_certificates', 'academic_certificates', 'other_documents'];

    // Create main applicant directory if it doesn't exist
    if (!fs.existsSync(applicantDir)) {
        fs.mkdirSync(applicantDir, { recursive: true });
    }

    // Create subdirectories
    subDirs.forEach(dir => {
        const subDir = path.join(applicantDir, dir);
        if (!fs.existsSync(subDir)) {
            fs.mkdirSync(subDir, { recursive: true });
        }
    });

    return applicantDir;
};

// Generate a unique filename
const generateUniqueFilename = (originalFilename, documentType) => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = path.extname(originalFilename);
    return `${timestamp}-${randomString}-${documentType}${extension}`;
};

// Get the appropriate subdirectory for a document type
const getDocumentSubdirectory = (documentType) => {
    const typeMap = {
        'photo': 'photos',
        'id_document': 'id_documents',
        'birth_certificate': 'birth_certificates',
        'academic_certificate': 'academic_certificates',
        'other': 'other_documents'
    };
    return typeMap[documentType] || 'other_documents';
};

// Save a file with proper organization
const saveFile = async (file, applicantId, documentType) => {
    try {
        // Create directory structure
        const applicantDir = createDirectoryStructure(applicantId);
        
        // Get appropriate subdirectory
        const subDir = getDocumentSubdirectory(documentType);
        const targetDir = path.join(applicantDir, subDir);
        
        // Generate unique filename
        const filename = generateUniqueFilename(file.originalname, documentType);
        const filepath = path.join(targetDir, filename);
        
        // Move the file
        await fs.promises.rename(file.path, filepath);
        
        // Return the relative path for database storage
        return path.join('uploads', `applicant_${applicantId}`, subDir, filename);
    } catch (error) {
        console.error('Error saving file:', error);
        throw error;
    }
};

// Delete files for an applicant
const deleteApplicantFiles = async (applicantId) => {
    try {
        const applicantDir = path.join(UPLOADS_DIR, `applicant_${applicantId}`);
        if (fs.existsSync(applicantDir)) {
            await fs.promises.rm(applicantDir, { recursive: true });
        }
    } catch (error) {
        console.error('Error deleting applicant files:', error);
        throw error;
    }
};

// Get file URL for web access
const getFileUrl = (filepath) => {
    if (!filepath) return null;
    // Convert Windows path to URL format
    return filepath.replace(/\\/g, '/');
};

module.exports = {
    saveFile,
    deleteApplicantFiles,
    getFileUrl,
    UPLOADS_DIR
}; 