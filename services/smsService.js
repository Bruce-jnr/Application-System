const axios = require('axios');
require('dotenv').config();

class SmsService {
    constructor() {
        this.clientId = process.env.HUBTEL_CLIENT_ID;
        this.clientSecret = process.env.HUBTEL_CLIENT_SECRET;
        this.senderId = process.env.HUBTEL_SENDER_ID;
        this.baseUrl = 'https://sms.hubtel.com/v1/messages/send';
    }

    async sendSms(recipient, message) {
        try {
            const response = await axios.post(
                this.baseUrl,
                {
                    From: this.senderId,
                    To: recipient,
                    Content: message,
                    RegisteredDelivery: true
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
                    }
                }
            );

            return {
                success: true,
                messageId: response.data.MessageId,
                status: response.data.Status
            };
        } catch (error) {
            console.error('SMS sending failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.Message || error.message
            };
        }
    }

    // Template for application confirmation message
    getApplicationConfirmationMessage(applicantName, applicationId) {
        return `Dear ${applicantName},\n\nThank you for submitting your application to NSA CoE. Your application ID is ${applicationId}. We will review your application and contact you soon.\n\nBest regards,\nNSA CoE Admissions Team`;
    }

    // Template for payment confirmation message
    getPaymentConfirmationMessage(applicantName, amount, reference) {
        return `Dear ${applicantName},\n\nPayment of GHS ${amount} has been received. Reference: ${reference}. Thank you for your payment.\n\nBest regards,\nNSA CoE Admissions Team`;
    }
}

module.exports = new SmsService(); 