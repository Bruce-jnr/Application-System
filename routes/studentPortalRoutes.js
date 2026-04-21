const express = require('express');
const router = express.Router();
const path = require('path');
const { isAdmittedStudent } = require('../middleware/studentAuth');

// Student login page
router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'student-login.html'));
});

// Student login handler
router.post('/login', async (req, res) => {
    const { serialNumber, pin } = req.body;
    const pool = req.app.get('mysqlPool');

    try {
        const [rows] = await pool.query(
            `SELECT a.id, a.first_name, a.last_name, a.status 
             FROM applicants a 
             JOIN vouchers v ON a.voucher_id = v.id 
             WHERE v.serial_number = ? AND a.admission_pin = ?`,
            [serialNumber, pin]
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid Serial Number or PIN' });
        }

        const student = rows[0];

        if (student.status !== 'approved') {
            return res.status(403).json({ success: false, message: 'Your application has not been approved yet.' });
        }

        // Set student session
        req.session.isStudent = true;
        req.session.studentId = student.id;
        req.session.studentName = `${student.first_name} ${student.last_name}`;

        res.json({ success: true });
    } catch (error) {
        console.error('Student login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});

// Student dashboard / download page
router.get('/dashboard', isAdmittedStudent, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'student-dashboard.html'));
});

// Get student data for dashboard
router.get('/api/me', isAdmittedStudent, async (req, res) => {
    const pool = req.app.get('mysqlPool');
    try {
        const [rows] = await pool.query(
            `SELECT a.*, v.serial_number 
             FROM applicants a 
             JOIN vouchers v ON a.voucher_id = v.id 
             WHERE a.id = ?`,
            [req.session.studentId]
        );
        res.json({ success: true, student: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch student data' });
    }
});

module.exports = router;
