class ApplicationPreview {
    constructor() {
        this.modal = document.getElementById('preview-modal');
        this.formData = {};
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        // Close modal when pressing Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display === 'block') {
                this.closeModal();
            }
        });
    }

    collectFormData() {
        const form = document.getElementById('application-form');
        const formData = new FormData(form);
        
        // Convert FormData to object
        this.formData = {};
        for (let [key, value] of formData.entries()) {
            this.formData[key] = value;
        }
        
        return this.formData;
    }

    generatePreview() {
        const data = this.collectFormData();
        
        const previewHTML = `
            <div class="preview-modal-content">
                <div class="preview-section">
                    <h3>Personal Information</h3>
                    <div class="preview-grid">
                        <div class="preview-item">
                            <label>Full Name:</label>
                            <span>${data.fullName || 'Not provided'}</span>
                        </div>
                        <div class="preview-item">
                            <label>Date of Birth:</label>
                            <span>${data.dateOfBirth || 'Not provided'}</span>
                        </div>
                        <div class="preview-item">
                            <label>Gender:</label>
                            <span>${data.gender || 'Not provided'}</span>
                        </div>
                        <div class="preview-item">
                            <label>Phone Number:</label>
                            <span>${data.phoneNumber || 'Not provided'}</span>
                        </div>
                        <div class="preview-item">
                            <label>Email:</label>
                            <span>${data.email || 'Not provided'}</span>
                        </div>
                    </div>
                </div>

                <div class="preview-section">
                    <h3>Academic Information</h3>
                    <div class="preview-grid">
                        <div class="preview-item">
                            <label>Previous School:</label>
                            <span>${data.previousSchool || 'Not provided'}</span>
                        </div>
                        <div class="preview-item">
                            <label>Year of Completion:</label>
                            <span>${data.completionYear || 'Not provided'}</span>
                        </div>
                        <div class="preview-item">
                            <label>Program Applied For:</label>
                            <span>${data.program || 'Not provided'}</span>
                        </div>
                    </div>
                </div>

                <div class="preview-section">
                    <h3>Guardian Information</h3>
                    <div class="preview-grid">
                        <div class="preview-item">
                            <label>Guardian Name:</label>
                            <span>${data.guardianName || 'Not provided'}</span>
                        </div>
                        <div class="preview-item">
                            <label>Guardian Phone:</label>
                            <span>${data.guardianPhone || 'Not provided'}</span>
                        </div>
                        <div class="preview-item">
                            <label>Guardian Email:</label>
                            <span>${data.guardianEmail || 'Not provided'}</span>
                        </div>
                    </div>
                </div>

                <div class="preview-actions">
                    <button type="button" class="btn btn-secondary" onclick="preview.closeModal()">Back to Edit</button>
                    <button type="button" class="btn btn-info" onclick="preview.printPreview()">Print Preview</button>
                    <button type="button" class="btn btn-primary" onclick="preview.submitApplication()">Submit Application</button>
                </div>
            </div>
        `;

        this.modal.innerHTML = previewHTML;
        this.showModal();
    }

    showModal() {
        this.modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    closeModal() {
        this.modal.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
    }

    printPreview() {
        window.print();
    }

    async submitApplication() {
        try {
            const response = await fetch('/api/applicants', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.formData)
            });

            const result = await response.json();

            if (result.success) {
                alert('Application submitted successfully!');
                window.location.href = '/application-success';
            } else {
                alert('Failed to submit application: ' + result.message);
            }
        } catch (error) {
            console.error('Error submitting application:', error);
            alert('An error occurred while submitting your application. Please try again.');
        }
    }
}

// Initialize preview
const preview = new ApplicationPreview(); 