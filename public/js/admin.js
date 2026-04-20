// Check admin session on page load
async function checkAdminSession() {
    try {
        console.log('Checking admin session...');
        const response = await fetch('/api/admin/check-session', {
            method: 'GET',
            credentials: 'include' // Important: include credentials
        });
        
        const data = await response.json();
        console.log('Session check response:', data);
        
        if (!data.isAdmin) {
            console.log('Not an admin user, redirecting to login');
            window.location.href = '/admin-login';
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error checking admin session:', error);
        window.location.href = '/admin-login';
        return false;
    }
}

// Generate vouchers function
async function generateVouchers(count) {
    try {
        console.log('Attempting to generate vouchers...');
        
        // Check session before proceeding
        const isAdmin = await checkAdminSession();
        if (!isAdmin) {
            console.log('Admin check failed, aborting voucher generation');
            return;
        }

        const response = await fetch('/api/admin/vouchers/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ count })
        });

        console.log('Voucher generation response status:', response.status);
        
        if (!response.ok) {
            if (response.status === 403) {
                console.log('Session expired or unauthorized, redirecting to login');
                window.location.href = '/admin-login';
                return;
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate vouchers');
        }

        const data = await response.json();
        console.log('Voucher generation response:', data);
        
        if (data.success) {
            // Show success message
            const successMessage = document.createElement('div');
            successMessage.className = 'alert alert-success';
            successMessage.textContent = 'Vouchers generated successfully!';
            document.querySelector('.card-body').prepend(successMessage);
            
            // Show the first voucher in print modal
            if (data.vouchers.length > 0) {
                const firstVoucher = data.vouchers[0];
                document.getElementById('modalSerial').textContent = firstVoucher.serialNumber;
                document.getElementById('modalPin').textContent = firstVoucher.pin;
                
                const printModal = new bootstrap.Modal(document.getElementById('printModal'));
                printModal.show();
            }
            
            // Refresh the voucher list
            await loadVouchers();
            
            // Remove success message after 5 seconds
            setTimeout(() => {
                successMessage.remove();
            }, 5000);
        } else {
            throw new Error(data.error || 'Failed to generate vouchers');
        }
    } catch (error) {
        console.error('Error generating vouchers:', error);
        const errorMessage = document.createElement('div');
        errorMessage.className = 'alert alert-danger';
        errorMessage.textContent = error.message;
        document.querySelector('.card-body').prepend(errorMessage);
        
        setTimeout(() => {
            errorMessage.remove();
        }, 5000);
    }
}

// Load vouchers list
async function loadVouchers() {
    try {
        const response = await fetch('/api/admin/vouchers', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('vouchersList');
            if (!tbody) {
                console.error('Vouchers list table body not found');
                return;
            }
            
            tbody.innerHTML = data.vouchers.map(voucher => `
                <tr>
                    <td>${voucher.serial_number}</td>
                    <td>${voucher.is_used ? 'Used' : 'Available'}</td>
                    <td>${voucher.created_by || 'System'}</td>
                    <td>${new Date(voucher.created_at).toLocaleString()}</td>
                    <td>${voucher.used_at ? new Date(voucher.used_at).toLocaleString() : '-'}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading vouchers:', error);
        const errorMessage = document.createElement('div');
        errorMessage.className = 'alert alert-danger';
        errorMessage.textContent = 'Failed to load vouchers. Please try again.';
        document.querySelector('.card-body').prepend(errorMessage);
        
        setTimeout(() => {
            errorMessage.remove();
        }, 5000);
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Admin page loaded, checking session...');
    
    // Check admin session on page load
    const isAdmin = await checkAdminSession();
    if (!isAdmin) {
        console.log('Initial admin check failed');
        return;
    }
    
    console.log('Admin session valid, setting up event listeners');
    
    // Initialize modal
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    const voucherCountInput = document.getElementById('voucherCount');
    const voucherCountDisplay = document.getElementById('voucherCountDisplay');
    const generateBtn = document.getElementById('generateBtn');
    const confirmGenerateBtn = document.getElementById('confirmGenerate');

    // Update voucher count display when input changes
    if (voucherCountInput) {
        voucherCountInput.addEventListener('input', () => {
            const count = voucherCountInput.value || 1;
            voucherCountDisplay.textContent = count;
        });
    }

    // Show confirmation modal when generate button is clicked
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const count = voucherCountInput.value || 1;
            voucherCountDisplay.textContent = count;
            confirmModal.show();
        });
    }

    // Handle confirmation
    if (confirmGenerateBtn) {
        confirmGenerateBtn.addEventListener('click', () => {
            const count = voucherCountInput.value || 1;
            confirmModal.hide();
            generateVouchers(count);
        });
    }

    // Handle print button
    const printBtn = document.getElementById('printVoucher');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }

    // Handle modal events for accessibility
    const modalElement = document.getElementById('confirmModal');
    if (modalElement) {
        modalElement.addEventListener('shown.bs.modal', () => {
            // When modal is shown, focus the confirm button
            confirmGenerateBtn.focus();
        });

        modalElement.addEventListener('hidden.bs.modal', () => {
            // When modal is hidden, return focus to the generate button
            generateBtn.focus();
        });
    }

    // Initial load of vouchers
    loadVouchers();
});

// Load voucher statistics
async function loadVoucherStats() {
    try {
        const response = await fetch('/api/admin/vouchers/statistics');
        const data = await response.json();

        if (data.success) {
            const stats = data.statistics;
            document.getElementById('totalVouchers').textContent = stats.total_vouchers;
            document.getElementById('usedVouchers').textContent = stats.used_vouchers;
            document.getElementById('unusedVouchers').textContent = stats.unused_vouchers;
        } else {
            showAlert('Error loading voucher statistics', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error loading voucher statistics', 'danger');
    }
}

// Handle voucher generation
async function handleGenerateVoucher() {
    if (!confirm('Are you sure you want to generate a new voucher?')) return;

    try {
        const response = await fetch('/api/admin/vouchers/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ count: 1 })
        });
        const data = await response.json();

        if (data.success) {
            showAlert('Voucher generated successfully', 'success');
            loadVoucherStats();
            loadVouchers();
        } else {
            showAlert('Error generating voucher', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error generating voucher', 'danger');
    }
}

// Handle logout
async function handleLogout() {
    try {
        const response = await fetch('/api/admin/logout', {
            method: 'POST'
        });
        const data = await response.json();

        if (data.success) {
            window.location.href = '/admin-login';
        } else {
            showAlert('Error logging out', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error logging out', 'danger');
    }
}

// Show alert message
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const mainContent = document.querySelector('.container-fluid');
    mainContent.insertBefore(alertDiv, mainContent.firstChild);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
} 