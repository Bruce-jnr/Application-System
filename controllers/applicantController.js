const Applicant = require('../models/applicant');
const smsService = require('../services/smsService');

exports.submitApplication = async (req, res) => {
    try {
        const applicantData = req.body;
        
        // Create new applicant
        const applicant = await Applicant.create(applicantData);
        
        // Send confirmation SMS
        const message = smsService.getApplicationConfirmationMessage(
            applicant.fullName,
            applicant.applicationId
        );
        
        const smsResult = await smsService.sendSms(applicant.phoneNumber, message);
        
        if (!smsResult.success) {
            console.error('Failed to send SMS:', smsResult.error);
            // Continue with the response even if SMS fails
        }

        res.status(201).json({
            success: true,
            message: 'Application submitted successfully',
            data: {
                applicant,
                smsSent: smsResult.success
            }
        });
    } catch (error) {
        console.error('Error submitting application:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit application',
            error: error.message
        });
    }
}; 