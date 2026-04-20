const pool = require('../config/db');
const bcrypt = require('bcrypt');

module.exports = {
  async createApplicant(applicantData) {
    try {
      const [result] = await pool.query(
        'INSERT INTO applicants SET ?',
        applicantData
      );
      return result.insertId;
    } catch (error) {
      console.error('Error creating applicant:', error);
      throw new Error('Failed to create applicant record');
    }
  },

  async addAcademicRecords(applicantId, records) {
    try {
      await pool.query(
        `INSERT INTO academic_records 
         (applicant_id, subject_type, subject_name, index_number, grade) 
         VALUES ?`,
        [
          records.map((r) => [
            applicantId,
            r.subject_type,
            r.subject_name,
            r.index_number,
            r.grade,
          ]),
        ]
      );
    } catch (error) {
      console.error('Error adding academic records:', error);
      throw new Error('Failed to add academic records');
    }
  },

  async addParentGuardians(applicantId, parents) {
    try {
      await pool.query(
        `INSERT INTO parents_guardians 
         (applicant_id, relation, full_name, occupation, phone_number, email, is_primary) 
         VALUES ?`,
        [
          parents.map((p) => [
            applicantId,
            p.relation,
            p.full_name,
            p.occupation,
            p.phone_number,
            p.email,
            p.is_primary,
          ]),
        ]
      );
    } catch (error) {
      console.error('Error adding parent/guardian records:', error);
      throw new Error('Failed to add parent/guardian records');
    }
  },

  async addEmergencyContact(applicantId, contact) {
    try {
      await pool.query(
        `INSERT INTO emergency_contacts 
         (applicant_id, full_name, phone_number, relationship) 
         VALUES (?, ?, ?, ?)`,
        [applicantId, contact.full_name, contact.phone_number, contact.relationship]
      );
    } catch (error) {
      console.error('Error adding emergency contact:', error);
      throw new Error('Failed to add emergency contact');
    }
  },

  async addLanguages(applicantId, languages) {
    try {
      if (!Array.isArray(languages) || languages.length === 0) return;
      
      await pool.query(
        `INSERT INTO applicant_languages 
         (applicant_id, language_name) 
         VALUES ?`,
        [languages.map(lang => [applicantId, lang])]
      );
    } catch (error) {
      console.error('Error adding languages:', error);
      throw new Error('Failed to add languages');
    }
  },

  async addDocuments(applicantId, documents) {
    try {
      if (!Array.isArray(documents) || documents.length === 0) return;
      
      await pool.query(
        `INSERT INTO application_documents 
         (applicant_id, document_type, file_path) 
         VALUES ?`,
        [documents.map(doc => [applicantId, doc.type, doc.path])]
      );
    } catch (error) {
      console.error('Error adding documents:', error);
      throw new Error('Failed to add documents');
    }
  },

  async verifyVoucher(serial, pin) {
    try {
      const [vouchers] = await pool.query(
        `SELECT * FROM vouchers 
         WHERE serial_number = ? 
         AND expires_at > NOW() 
         AND is_used = FALSE`,
        [serial]
      );

      if (vouchers.length === 0) return null;

      const voucher = vouchers[0];
      const pinValid = await bcrypt.compare(pin, voucher.pin_hash);

      return pinValid ? voucher : null;
    } catch (error) {
      console.error('Error verifying voucher:', error);
      throw new Error('Failed to verify voucher');
    }
  },

  async markVoucherUsed(voucherId) {
    try {
      await pool.query(
        `UPDATE vouchers SET is_used = TRUE, used_at = NOW()
         WHERE id = ?`,
        [voucherId]
      );
    } catch (error) {
      console.error('Error marking voucher as used:', error);
      throw new Error('Failed to mark voucher as used');
    }
  }
};
