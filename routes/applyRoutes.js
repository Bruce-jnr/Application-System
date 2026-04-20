// Submit application
router.post('/api/applications', upload.single('photo'), async (req, res) => {
    const pool = req.app.get('mysqlPool');
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Get voucher_id from serial number
        const [voucherResult] = await connection.query(
            'SELECT id FROM vouchers WHERE serial_number = ?',
            [req.body.serialNumber]
        );
        
        if (!voucherResult.length) {
            throw new Error('Invalid serial number');
        }
        
        const voucherId = voucherResult[0].id;
        
        // Insert applicant data
        const [result] = await connection.query(
            `INSERT INTO applicants (
                voucher_id, first_name, last_name, middle_name, title,
                dob, gender, nationality, id_type, id_number,
                disability_status, disability_type, email, phone, address,
                photo_path, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                voucherId,
                req.body.firstName,
                req.body.lastName,
                req.body.middleName || null,
                req.body.title,
                req.body.dob,
                req.body.gender,
                req.body.nationality,
                req.body.idType,
                req.body.idNumber,
                req.body.disabilityStatus || 'No',
                req.body.disabilityType || null,
                req.body.email,
                req.body.phone,
                req.body.address,
                req.file ? req.file.filename : null
            ]
        );
        
        // ... rest of the existing code for academic records, parents, etc ...
        
        await connection.commit();
        res.json({ success: true, message: 'Application submitted successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Error submitting application:', error);
        res.status(500).json({ success: false, message: 'Error submitting application' });
    } finally {
        connection.release();
    }
});

// Render application form
router.get('/apply-now', isAuthenticated, async (req, res) => {
    try {
        // Get the serial number from the session
        const serialNumber = req.session.serialNumber;
        
        if (!serialNumber) {
            return res.redirect('/login');
        }

        // Log the serial number for debugging
        console.log('Serial number from session:', serialNumber);

        res.render('apply-now', {
            title: 'Apply Now - NSACoE',
            serialNumber: serialNumber // Pass the actual serial number
        });
    } catch (error) {
        console.error('Error rendering application form:', error);
        res.status(500).send('Error loading application form');
    }
}); 