# NSACoE Admission Portal

A comprehensive, secure, and user-friendly web portal for the NSACoE (College of Education) admission process. This system utilizes a voucher-based authentication mechanism for applicants and provides a robust administrative dashboard for managing applications and vouchers.

## 🚀 Features

### For Applicants
- **Voucher Authentication**: Secure login using serial numbers and PINs.
- **Guided Application Form**: Multi-step form covering personal details, academic records, guardian information, and document uploads.
- **Document Upload**: Support for photos, ID documents, and certificates (PDF, JPEG, PNG, DOC).
- **SMS Notifications**: Automated SMS confirmation upon successful application submission.
- **Responsive Design**: Optimized for both mobile and desktop browsers.

### For Administrators
- **Dashboard Overview**: Real-time statistics on applications and vouchers.
- **Application Management**: View, filter, and review submitted applications.
- **Voucher Management**:
    - Serial and PIN generation.
    - Bulk upload via CSV.
    - Export voucher lists.
    - Track usage status.
- **Vendor Integration**: API endpoints for third-party vendors to sell and verify vouchers.
- **Security & Logging**: Role-based access control, request rate limiting, and detailed logging.

## 🛠️ Tech Stack

- **Backend**: Node.js & Express.js
- **Database**: MySQL (using `mysql2/promise` for async/await)
- **Session Management**: `express-session` with `express-mysql-session` for persistence.
- **Security**: 
    - `helmet` for HTTP header security.
    - `express-rate-limit` to prevent brute-force attacks.
    - `bcrypt` for secure administrative password hashing.
    - CORS protection.
- **File Handling**: `multer` for memory-stored file uploads.
- **Messaging**: Custom SMS service integration.

## 📋 Prerequisites

- **Node.js**: v18.0.0 or higher.
- **MySQL**: 8.0 or higher.
- **SMS Gateway Credentials**: (e.g., for Ghana SMS or similar providers).

## ⚙️ Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd nsacoe-admission-portal
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and populate it with the following:
   ```ini
   # Server Configuration
   PORT=3000
 

   # Database Configuration
   DB_HOST=localhost
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=nsacoe_admissions


   # Session Configuration
   SESSION_SECRET=your_secret_key
   SESSION_COOKIE_NAME=nsacoe_admin_session

   # SMS Configuration (if applicable)
   SMS_API_KEY=your_sms_api_key
   SMS_SENDER_ID=NSACoE

   ```

4. **Initialize Database**:
   The application is configured to initialize the database schema automatically on startup if `FORCE_DB_INIT=true` is set initially.

5. **Start the server**:
   ```bash
   # Development mode with hot-reload
   npm run dev

   # Production mode
   npm start
   ```

## 📂 Project Structure

- `/config`: Database and initialization settings.
- `/controllers`: Request handling logic.
- `/models`: Database schemas and models.
- `/public`: Static assets (CSS, JS, Images).
- `/routes`: API and Page route definitions.
- `/utils`: Helper functions, logging, and SMS service.
- `/views`: HTML templates.

## 🛡️ Security Best Practices

- Always use `NODE_ENV=production` in live environments.
- Ensure `SESSION_SECURE=true` and HTTPS is enabled in production.
- Keep the `SESSION_SECRET` confidential.
- Regularly rotate administrative passwords.

## 📄 License

This project is licensed under the ISC License.
