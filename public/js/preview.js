document.addEventListener('DOMContentLoaded', async () => {
    // Get application ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const applicationId = window.location.pathname.split('/').pop();

    try {
        // Fetch application details
        const response = await fetch(`/api/admin/applications/${applicationId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch application details');
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Failed to load application');
        }

        const application = data.application;

        // Display personal information
        const personalInfo = document.getElementById('personal-info');
        personalInfo.innerHTML = `
            <div class="info-group">
                <div class="info-item">
                    <div class="info-label">Full Name</div>
                    <div class="info-value">${application.title} ${application.first_name} ${application.middle_name || ''} ${application.last_name}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Date of Birth</div>
                    <div class="info-value">${new Date(application.date_of_birth).toLocaleDateString()}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Gender</div>
                    <div class="info-value">${application.gender}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Phone Number</div>
                    <div class="info-value">${application.phone_number}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Email</div>
                    <div class="info-value">${application.email}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Address</div>
                    <div class="info-value">${application.address}</div>
                </div>
            </div>
        `;

        // Display academic records
        const academicRecords = document.getElementById('academic-records');
        if (application.academic_records && application.academic_records.length > 0) {
            const recordsHtml = application.academic_records.map(record => `
                <div class="info-group">
                    <div class="info-item">
                        <div class="info-label">Subject</div>
                        <div class="info-value">${record.subject_name}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Type</div>
                        <div class="info-value">${record.subject_type}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Grade</div>
                        <div class="info-value">${record.grade}</div>
                    </div>
                </div>
            `).join('');
            academicRecords.innerHTML = recordsHtml;
        }

        // Display parent/guardian information
        const parentInfo = document.getElementById('parent-info');
        if (application.parents_guardians && application.parents_guardians.length > 0) {
            const parentsHtml = application.parents_guardians.map(parent => `
                <div class="info-group">
                    <div class="info-item">
                        <div class="info-label">Name</div>
                        <div class="info-value">${parent.full_name}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Relationship</div>
                        <div class="info-value">${parent.relation}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Phone</div>
                        <div class="info-value">${parent.phone_number}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Occupation</div>
                        <div class="info-value">${parent.occupation || 'N/A'}</div>
                    </div>
                </div>
            `).join('');
            parentInfo.innerHTML = parentsHtml;
        }

        // Display emergency contact
        const emergencyContact = document.getElementById('emergency-contact');
        if (application.emergency_contacts && application.emergency_contacts.length > 0) {
            const contact = application.emergency_contacts[0];
            emergencyContact.innerHTML = `
                <div class="info-group">
                    <div class="info-item">
                        <div class="info-label">Name</div>
                        <div class="info-value">${contact.full_name}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Relationship</div>
                        <div class="info-value">${contact.relationship}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Phone</div>
                        <div class="info-value">${contact.phone_number}</div>
                    </div>
                </div>
            `;
        }

        // Display documents
        const documents = document.getElementById('documents');
        if (application.documents && application.documents.length > 0) {
            const documentsHtml = application.documents.map(doc => `
                <div class="document-preview">
                    ${doc.document_type === 'photo' ? 
                        `<img src="${doc.file_path}" alt="Photo">` :
                        `<a href="${doc.file_path}" target="_blank">View ${doc.document_type}</a>`
                    }
                </div>
            `).join('');
            documents.innerHTML = documentsHtml;
        }

        // Handle approve button
        document.getElementById('approve-btn').addEventListener('click', async () => {
            try {
                const response = await fetch(`/api/admin/applications/${applicationId}/approve`, {
                    method: 'POST'
                });
                const data = await response.json();
                if (data.success) {
                    alert('Application approved successfully');
                    window.location.href = '/admin/applications';
                } else {
                    throw new Error(data.message || 'Failed to approve application');
                }
            } catch (error) {
                alert(error.message);
            }
        });

        // Handle reject button
        document.getElementById('reject-btn').addEventListener('click', async () => {
            try {
                const response = await fetch(`/api/admin/applications/${applicationId}/reject`, {
                    method: 'POST'
                });
                const data = await response.json();
                if (data.success) {
                    alert('Application rejected successfully');
                    window.location.href = '/admin/applications';
                } else {
                    throw new Error(data.message || 'Failed to reject application');
                }
            } catch (error) {
                alert(error.message);
            }
        });

        // Handle back button
        document.getElementById('back-btn').addEventListener('click', () => {
            window.location.href = '/admin/applications';
        });

    } catch (error) {
        console.error('Error:', error);
        alert('Failed to load application details');
    }
}); 