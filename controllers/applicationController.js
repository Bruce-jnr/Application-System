const applicationService = require('../services/applicationService');

module.exports = {
  async submitApplication(req, res) {
    try {
      const applicantId = await applicationService.processApplication(
        req.body,
        req.files
      );
      res.json({ success: true, applicantId });
    } catch (error) {
      console.error('Application error:', error);
      res.status(500).json({
        error: error.message || 'Application submission failed',
      });
    }
  },
};
