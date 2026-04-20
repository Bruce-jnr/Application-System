console.log('Preview modal script loaded');

// Add direct event listener to verify button functionality
document.addEventListener('DOMContentLoaded', () => {
    const previewBtn = document.getElementById('previewBtn');
    console.log('Preview button found on DOMContentLoaded:', previewBtn);
    
    if (previewBtn) {
        previewBtn.addEventListener('click', (e) => {
            console.log('Preview button clicked directly');
            e.preventDefault();
        });
    }
});

class ApplicationPreview {
    constructor() {
        console.log('Initializing ApplicationPreview');
        this.modal = document.getElementById('preview-modal');
        if (!this.modal) {
            console.error('Preview modal element not found!');
            return;
        }
        this.formData = {};
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        console.log('Setting up event listeners');
        
        // Close modal when clicking outside
        this.modal.addEventListener('click', (e) => {
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

        // Add event listener for the preview button
        const previewButton = document.getElementById('previewBtn');
        console.log('Preview button found:', previewButton);
        
        if (previewButton) {
            previewButton.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Preview button clicked');
                await this.generatePreview();
            });
        } else {
            console.error('Preview button not found!');
        }
    }

    collectFormData() {
        console.log('Collecting form data');
        const form = document.getElementById('admissionForm');
        if (!form) {
            console.error('Form not found!');
            return {};
        }
        
        const formData = new FormData(form);
        
        // Convert FormData to object
        this.formData = {};
        for (let [key, value] of formData.entries()) {
            if (this.formData[key]) {
                if (!Array.isArray(this.formData[key])) {
                    this.formData[key] = [this.formData[key]];
                }
                this.formData[key].push(value);
            } else {
                this.formData[key] = value;
            }
        }
        
        console.log('Collected form data:', this.formData);
        return this.formData;
    }

    async generatePreview() {
        try {
            console.log('Generating preview');
            const data = this.collectFormData();
            
            if (!data || Object.keys(data).length === 0) {
                console.error('No form data collected');
                alert('Please fill out the form before previewing');
                return;
            }

            // Get serial number from session storage
            const serialNumber = sessionStorage.getItem('serialNumber') || 'Not provided';
            console.log('Serial number from session storage:', serialNumber);

            // Get phone numbers from form data
            const phoneNumbers = data['phone[]'] || [];
            const phone1 = phoneNumbers[0] || 'Not provided';
            const phone2 = phoneNumbers[1] || 'Not provided';

            // Get Ghanaian languages from form data and ensure it's an array
            let languages = data['languages[]'];
            if (!languages) {
                languages = [];
            } else if (!Array.isArray(languages)) {
                languages = [languages];
            }
            const languagesList = languages.length > 0 ? languages.join(', ') : 'Not provided';
            console.log('Languages:', languages, 'Languages List:', languagesList);

            // Safely get photo
            const photoElement = document.getElementById('photo');
            let photoUrl = '';
            if (photoElement && photoElement.files[0]) {
                const reader = new FileReader();
                photoUrl = await new Promise((resolve) => {
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(photoElement.files[0]);
                });
            }

            const previewHTML = `
                <div class="preview-modal-content">
                    <div class="preview-header">
                        <img src="/public/images/logo1.png" alt="NSACoE Logo" class="preview-logo">
                        <h1>Nsawkaw College of Education</h1>
                        <h2>Application Form Preview</h2>
                    </div>
                    <div class="preview-section">
                        <h3>Personal Information</h3>
                        <div class="preview-grid">
                            <div class="preview-photo-serial">
                                <div class="preview-photo">
                                    <img src="${photoUrl}" 
                                         alt="Student Photo" 
                                         style="width: 300px; height: 300px; object-fit: cover;">
                                </div>
                                <div class="preview-serial">
                                    <div class="preview-item">
                                        <label>Serial Number:</label>
                                        <span>${serialNumber}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="preview-details-grid">
                                <div class="preview-item">
                                    <label>Title:</label>
                                    <span>${data.title || 'Not provided'}</span>
                                </div>
                                <div class="preview-item">
                                    <label>Full Name:</label>
                                    <span>${data.firstName} ${data.middleName || ''} ${data.lastName}</span>
                                </div>
                                <div class="preview-item">
                                    <label>Date of Birth:</label>
                                    <span>${data.dob || 'Not provided'}</span>
                                </div>
                                <div class="preview-item">
                                    <label>Gender:</label>
                                    <span>${data.gender || 'Not provided'}</span>
                                </div>
                                <div class="preview-item">
                                    <label>Nationality:</label>
                                    <span>${data.nationality || 'Not provided'}</span>
                                </div>
                                <div class="preview-item">
                                    <label>ID Type:</label>
                                    <span>${data.idType || 'Not provided'}</span>
                                </div>
                                <div class="preview-item">
                                    <label>ID Number:</label>
                                    <span>${data.idNumber || 'Not provided'}</span>
                                </div>
                                <div class="preview-item">
                                    <label>Place of Birth:</label>
                                    <span>${data['place-of-birth'] || 'Not provided'}</span>
                                </div>
                                <div class="preview-item">
                                    <label>Region of Birth:</label>
                                    <span>${data['birth-region'] || 'Not provided'}</span>
                                </div>
                                <div class="preview-item">
                                    <label>Place of Residence:</label>
                                    <span>${data.residence || 'Not provided'}</span>
                                </div>
                                <div class="preview-item">
                                    <label>Region of Residence:</label>
                                    <span>${data['residence-region'] || 'Not provided'}</span>
                                </div>
                                <div class="preview-item">
                                    <label>Religion:</label>
                                    <span>${data.religion || 'Not provided'}</span>
                                </div>
                                <div class="preview-item">
                                    <label>Ghanaian Languages:</label>
                                    <span>${languagesList}</span>
                                </div>
                                <div class="preview-item">
                                    <label>Marital Status:</label>
                                    <span>${data['marital-status'] || 'Not provided'}</span>
                                </div>
                                <div class="preview-item">
                                    <label>Number of Children:</label>
                                    <span>${data['number-of-children'] || 'Not provided'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="preview-section">
                        <h3>Contact Information</h3>
                        <div class="preview-grid">
                            <div class="preview-item">
                                <label>Address:</label>
                                <span>${data.address || 'Not provided'}</span>
                            </div>
                            <div class="preview-item">
                                <label>City:</label>
                                <span>${data.city || 'Not provided'}</span>
                            </div>
                            <div class="preview-item">
                                <label>Region:</label>
                                <span>${data.region || 'Not provided'}</span>
                            </div>
                            <div class="preview-item">
                                <label>District:</label>
                                <span>${data.district || 'Not provided'}</span>
                            </div>
                            <div class="preview-item">
                                <label>Country:</label>
                                <span>${data.country || 'Not provided'}</span>
                            </div>
                            <div class="preview-item">
                                <label>Phone Number 1:</label>
                                <span>${phone1}</span>
                            </div>
                            <div class="preview-item">
                                <label>Phone Number 2:</label>
                                <span>${phone2}</span>
                            </div>
                            <div class="preview-item">
                                <label>GPS Address:</label>
                                <span>${data.gpsCode || 'Not provided'}</span>
                            </div>
                            <div class="preview-item">
                                <label>Email:</label>
                                <span>${data.email || 'Not provided'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="preview-section">
                        <h3>Academic Performance</h3>
                        <div class="preview-grid">
                            <div class="preview-item">
                                <label>Core Subjects:</label>
                                <table class="preview-table">
                                    <thead>
                                        <tr>
                                            <th>Index Number</th>
                                            <th>Subject</th>
                                            <th>Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${this.formatSubjectsWithIndex(data['coreSubjects[]'], data['coreIndexNumbers[]'], data['coreGrades[]'])}
                                    </tbody>
                                </table>
                            </div>
                            <div class="preview-item">
                                <label>Elective Subjects:</label>
                                <table class="preview-table">
                                    <thead>
                                        <tr>
                                            <th>Index Number</th>
                                            <th>Subject</th>
                                            <th>Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${this.formatSubjectsWithIndex(data['electiveSubjects[]'], data['electiveIndexNumbers[]'], data['electiveGrades[]'])}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div class="preview-section">
                        <h3>Parent/Guardian Information</h3>
                        <div class="preview-grid">
                            <div class="preview-item">
                                <label>Parent/Guardian 1:</label>
                                <span>${data.parent1Name || 'Not provided'} (${data.parent1Relation || 'Not provided'})</span>
                                <p>Occupation: ${data.parent1Occupation || 'Not provided'}</p>
                                <p>Phone: ${data.parent1Phone || 'Not provided'}</p>
                                <p>Email: ${data.parent1Email || 'Not provided'}</p>
                            </div>
                            ${data.parent2Name ? `
                                <div class="preview-item">
                                    <label>Parent/Guardian 2:</label>
                                    <span>${data.parent2Name} (${data.parent2Relation || 'Not provided'})</span>
                                    <p>Occupation: ${data.parent2Occupation || 'Not provided'}</p>
                                    <p>Phone: ${data.parent2Phone || 'Not provided'}</p>
                                    <p>Email: ${data.parent2Email || 'Not provided'}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="preview-section">
                        <h3>Emergency Contact</h3>
                        <div class="preview-grid">
                            <div class="preview-item">
                                <label>Name:</label>
                                <span>${data.emergencyContact || 'Not provided'}</span>
                            </div>
                            <div class="preview-item">
                                <label>Relationship:</label>
                                <span>${data.emergencyRelation || 'Not provided'}</span>
                            </div>
                            <div class="preview-item">
                                <label>Phone:</label>
                                <span>${data.emergencyPhone || 'Not provided'}</span>
                            </div>
                            <div class="preview-item">
                                <label>Disability Status:</label>
                                <span>${data['disability-status'] || 'Not provided'}</span>
                            </div>
                            ${data['disability-status'] === 'yes' ? `
                                <div class="preview-item">
                                    <label>Disability Type:</label>
                                    <span>${data['disability-type'] || 'Not provided'}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="preview-actions">
                        <button type="button" class="btn btn-secondary" id="backToEditBtn">Back to Edit</button>
                        <button type="button" class="btn btn-info" id="printPreviewBtn">Print Preview</button>
                        <button type="button" class="btn btn-primary" id="submitApplicationBtn">Submit Application</button>
                    </div>
                </div>
            `;

            this.modal.innerHTML = previewHTML;
            this.showModal();

            // Add event listeners to the new buttons
            document.getElementById('backToEditBtn').addEventListener('click', () => this.closeModal());
            document.getElementById('printPreviewBtn').addEventListener('click', () => this.printPreview());
            document.getElementById('submitApplicationBtn').addEventListener('click', () => this.submitApplication());
        } catch (error) {
            console.error('Error generating preview:', error);
            alert('An error occurred while generating the preview. Please try again.');
        }
    }

    formatSubjectsWithIndex(subjects, indexNumbers, grades) {
        if (!subjects || !grades) return '<tr><td colspan="3">Not provided</td></tr>';
        const subjectArray = Array.isArray(subjects) ? subjects : [subjects];
        const indexArray = Array.isArray(indexNumbers) ? indexNumbers : [indexNumbers];
        const gradeArray = Array.isArray(grades) ? grades : [grades];
        
        return subjectArray.map((subject, index) => `
            <tr>
                <td>${indexArray[index] || 'N/A'}</td>
                <td>${subject}</td>
                <td>${gradeArray[index] || 'N/A'}</td>
            </tr>
        `).join('');
    }

    showModal() {
        console.log('Showing modal');
        this.modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    closeModal() {
        console.log('Closing modal');
        this.modal.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
    }

    printPreview() {
        console.log('Printing preview');
        window.print();
    }

    async submitApplication() {
        try {
            console.log('Submitting application');
            const form = document.getElementById('admissionForm');
            const formData = new FormData(form);
            
            const response = await fetch('/api/applications', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {

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

// Initialize preview when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM loaded, initializing preview');
        window.preview = new ApplicationPreview();
    });
} else {
    console.log('DOM already loaded, initializing preview');
    window.preview = new ApplicationPreview();
} 