const axios = require('axios');
require('dotenv').config();

class SMSService {
    constructor() {
        this.apiKey = process.env.ARKSEL_APIKEY;
        this.senderId = process.env.ARKSEL_SENDER_ID;
        this.baseUrl = 'https://sms.arkesel.com/api/v2/sms';
    }

    async sendSMS(phoneNumber, message) {
        try {
            // Format phone number to international format if not already
            const formattedPhone = this.formatPhoneNumber(phoneNumber);

            const data = {
                sender: this.senderId,
                message: message,
                recipients: [formattedPhone]
            };

            const config = {
                method: 'post',
                url: `${this.baseUrl}/send`,
                headers: {
                    'api-key': this.apiKey
                },
                data: data
            };

            const response = await axios(config);

            if (response.data.status === 'success') {
                console.log('SMS sent successfully:', {
                    messageId: response.data.message_id,
                    recipient: formattedPhone
                });
                return {
                    success: true,
                    data: response.data
                };
            } else {
                console.error('SMS sending failed:', response.data);
                return {
                    success: false,
                    error: response.data.message || 'Failed to send SMS'
                };
            }
        } catch (error) {
            console.error('SMS sending failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    async checkBalance() {
        try {
            const config = {
                method: 'get',
                url: `${this.baseUrl}/balance`,
                headers: {
                    'api-key': this.apiKey
                }
            };

            const response = await axios(config);

            if (response.data.status === 'success') {
                return {
                    success: true,
                    balance: response.data.balance
                };
            } else {
                return {
                    success: false,
                    error: response.data.message || 'Failed to check balance'
                };
            }
        } catch (error) {
            console.error('Balance check failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    async checkMessageStatus(messageId) {
        try {
            const config = {
                method: 'get',
                url: `${this.baseUrl}/status/${messageId}`,
                headers: {
                    'api-key': this.apiKey
                }
            };

            const response = await axios(config);

            if (response.data.status === 'success') {
                return {
                    success: true,
                    status: response.data.message_status
                };
            } else {
                return {
                    success: false,
                    error: response.data.message || 'Failed to check message status'
                };
            }
        } catch (error) {
            console.error('Status check failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    formatPhoneNumber(phone) {
        // Remove any non-digit characters
        let cleaned = phone.replace(/\D/g, '');
        
        // If number starts with 0, replace with 233
        if (cleaned.startsWith('0')) {
            cleaned = '233' + cleaned.substring(1);
        }
        
        // If number doesn't start with 233, add it
        if (!cleaned.startsWith('233')) {
            cleaned = '233' + cleaned;
        }
        
        return cleaned;
    }

    // Template for application received notification
    getApplicationReceivedMessage(applicantName, serialNumber) {
        return `Dear ${applicantName}, Thank you for submitting your application to NSAWKAW College of Education. Your application has been received and is being processed. Your Serial Number is ${serialNumber}. You will be notified of the status of your application in due course. Best regards, NSACoE`;
    }

    // Template for application approval notification
    getApplicationApprovedMessage(applicantName, serialNumber) {
        return `Dear ${applicantName}, Congratulations! Your application to NSAWKAW College of Education has been approved. Your Serial Number is ${serialNumber}. Please you will be contacted for further instructions on how to proceed with your admission. Best regards, NSACoE`;
    }

    // Template for application rejection notification
    getApplicationRejectedMessage(applicantName, serialNumber) {
        return `Dear ${applicantName}, We regret to inform you that your application to NSA College of Education has not been successful at this time. Your Serial Number is ${serialNumber}. We thank you for your interest in our institution. Best regards, NSAWKAW College of Education`;
    }
}

// Create a single instance of SMSService
const smsService = new SMSService();

// Export the instance
module.exports = smsService; 