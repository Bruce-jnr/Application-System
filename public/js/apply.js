// Function to save form data to localStorage
function saveFormData() {
    const formData = {
        // Personal Information
        fullName: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        dateOfBirth: document.getElementById('dateOfBirth').value,
        gender: document.getElementById('gender').value,
        address: document.getElementById('address').value,
        
        // Academic Records
        subjects: document.getElementById('subjects').value,
        
        // Parents/Guardians
        parentName: document.getElementById('parentName').value,
        parentPhone: document.getElementById('parentPhone').value,
        parentEmail: document.getElementById('parentEmail').value,
        
        // Emergency Contacts
        emergencyName: document.getElementById('emergencyName').value,
        emergencyPhone: document.getElementById('emergencyPhone').value,
        emergencyEmail: document.getElementById('emergencyEmail').value,
        
        // Voucher Information
        voucherSerial: document.getElementById('voucherSerial').value,
        voucherPin: document.getElementById('voucherPin').value
    };
    
    localStorage.setItem('applicationFormData', JSON.stringify(formData));
    console.log('Form data saved to localStorage');
}

// Function to load form data from localStorage
function loadFormData() {
    const savedData = localStorage.getItem('applicationFormData');
    if (savedData) {
        const formData = JSON.parse(savedData);
        
        // Personal Information
        document.getElementById('fullName').value = formData.fullName || '';
        document.getElementById('email').value = formData.email || '';
        document.getElementById('phone').value = formData.phone || '';
        document.getElementById('dateOfBirth').value = formData.dateOfBirth || '';
        document.getElementById('gender').value = formData.gender || '';
        document.getElementById('address').value = formData.address || '';
        
        // Academic Records
        document.getElementById('subjects').value = formData.subjects || '';
        
        // Parents/Guardians
        document.getElementById('parentName').value = formData.parentName || '';
        document.getElementById('parentPhone').value = formData.parentPhone || '';
        document.getElementById('parentEmail').value = formData.parentEmail || '';
        
        // Emergency Contacts
        document.getElementById('emergencyName').value = formData.emergencyName || '';
        document.getElementById('emergencyPhone').value = formData.emergencyPhone || '';
        document.getElementById('emergencyEmail').value = formData.emergencyEmail || '';
        
        // Voucher Information
        document.getElementById('voucherSerial').value = formData.voucherSerial || '';
        document.getElementById('voucherPin').value = formData.voucherPin || '';
        
        console.log('Form data loaded from localStorage');
    }
}

// Add event listeners to save form data on input
document.addEventListener('DOMContentLoaded', function() {
    // Load saved data when page loads
    loadFormData();
    
    // Add input event listeners to all form fields
    const formFields = document.querySelectorAll('input, select, textarea');
    formFields.forEach(field => {
        field.addEventListener('input', saveFormData);
    });
    
    // Modify the form submission to clear localStorage after successful submission
    document.getElementById('applicationForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(this);
            const response = await fetch('/api/applications', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Clear localStorage after successful submission
                localStorage.removeItem('applicationFormData');
                alert('Application submitted successfully!');
                this.reset();
            } else {
                alert(data.message || 'Error submitting application');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error submitting application');
        }
    });
});

// Add a clear form button
const clearFormButton = document.createElement('button');
clearFormButton.type = 'button';
clearFormButton.className = 'btn btn-secondary';
clearFormButton.textContent = 'Clear Saved Data';
clearFormButton.onclick = function() {
    if (confirm('Are you sure you want to clear all saved form data?')) {
        localStorage.removeItem('applicationFormData');
        document.getElementById('applicationForm').reset();
        alert('Saved form data has been cleared');
    }
};
document.getElementById('applicationForm').appendChild(clearFormButton); 