const applicantRepo = require('../repositories/applicantRepository');
const fs = require('fs');
const path = require('path');

module.exports = {
  async processApplication(formData, files) {
    const idDocumentPath = this._saveFile(files.idUpload?.[0]);
    const photoPath = this._saveFile(files.photo?.[0]);

    try {
      const applicantId = await applicantRepo.createApplicant({
        voucher_id: formData.voucherId,
        first_name: formData.firstName,
        last_name: formData.lastName,
        date_of_birth: formData.dob,
        gender: formData.gender,
        nationality: formData.nationality,
        residence_address: formData.residence,
        residence_region: formData.residenceRegion,
        phone_number: formData.phone,
        email: formData.email,
        id_type: formData.idType,
        id_number: formData.idNumber,
        id_document_path: idDocumentPath,
        photo_path: photoPath,
        status: 'submitted',
      });

      await applicantRepo.addAcademicRecords(
        applicantId,
        this._prepareAcademicRecords(formData)
      );

      await applicantRepo.addParentGuardians(
        applicantId,
        this._prepareParentInfo(formData)
      );

      await applicantRepo.markVoucherUsed(formData.voucherId);

      return applicantId;
    } catch (error) {
      [idDocumentPath, photoPath].forEach((filePath) => {
        if (filePath) fs.unlinkSync(path.join(__dirname, '../', filePath));
      });
      throw error;
    }
  },

  _prepareAcademicRecords(formData) {
    const coreSubjects = [
      'English Language',
      'Mathematics',
      'Integrated Science',
      'Social Studies',
    ];
    const records = coreSubjects.map((subject) => ({
      subject_type: 'core',
      subject_name: subject,
      index_number: formData[`coreIndexNumbers`][0],
      grade: formData[`coreGrades`][0],
    }));

    if (formData.electiveSubjects) {
      formData.electiveSubjects.forEach((subject, i) => {
        records.push({
          subject_type: 'elective',
          subject_name: subject,
          index_number: formData.electiveIndexNumbers[i],
          grade: formData.electiveGrades[i],
        });
      });
    }

    return records;
  },

  _prepareParentInfo(formData) {
    const parents = [
      {
        relation: formData.parent1Relation,
        full_name: formData.parent1Name,
        phone_number: formData.parent1Phone,
        is_primary: true,
      },
    ];

    if (formData.parent2Name) {
      parents.push({
        relation: formData.parent2Relation || 'other',
        full_name: formData.parent2Name,
        phone_number: formData.parent2Phone,
        is_primary: false,
      });
    }

    return parents;
  },

  _saveFile(file) {
    if (!file) return null;

    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, filename);

    fs.renameSync(file.path, filePath);
    return `/uploads/${filename}`;
  },
};
