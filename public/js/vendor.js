// Check vendor session on page load
async function checkVendorSession() {
    try {
        console.log('Checking vendor session...');
        const response = await fetch('/api/vendor/check-session', {
            method: 'GET',
            credentials: 'include'
        });
        
        const data = await response.json();
        console.log('Session check response:', data);
        
        if (!data.isVendor) {
            console.log('Not a vendor user, redirecting to login');
            window.location.href = '/vendor-login';
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error checking vendor session:', error);
        window.location.href = '/vendor-login';
        return false;
    }
}

// Generate vouchers function
async function generateVouchers(count) {
    try {
        console.log('Attempting to generate vouchers...');
        
        // Check session before proceeding
        const isVendor = await checkVendorSession();
        if (!isVendor) {
            console.log('Vendor check failed, aborting voucher generation');
            return;
        }

        const response = await fetch('/api/vendor/vouchers/generate', {
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
                window.location.href = '/vendor-login';
                return;
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate vouchers');
        }

        const data = await response.json();
        console.log('Voucher generation response:', data);
        
        if (data.success) {
            displayGeneratedVouchers(data.vouchers);
        } else {
            throw new Error(data.error || 'Failed to generate vouchers');
        }
    } catch (error) {
        console.error('Error generating vouchers:', error);
        const errorMessage = document.createElement('div');
        errorMessage.className = 'alert alert-danger';
        errorMessage.textContent = error.message;
        document.querySelector('.voucher-list').prepend(errorMessage);
        
        setTimeout(() => {
            errorMessage.remove();
        }, 5000);
    }
}

function displayGeneratedVouchers(vouchers) {
    // Show the first voucher in the print modal
    if (vouchers.length > 0) {
        const firstVoucher = vouchers[0];
        document.getElementById('modalSerial').textContent = firstVoucher.serialNumber;
        document.getElementById('modalPin').textContent = firstVoucher.pin;
        
        // Show the print modal
        const printModal = new bootstrap.Modal(document.getElementById('printModal'));
        printModal.show();
    }
    
    // Refresh the vouchers list
    loadVouchers();
}

// Load vouchers list
async function loadVouchers() {
    try {
        const response = await fetch('/api/vendor/vouchers', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('vouchersList');
            tbody.innerHTML = data.vouchers.map(voucher => `
                <tr>
                    <td>${voucher.serial_number}</td>
                    <td>${voucher.status}</td>
                    <td>${voucher.created_by}</td>
                    <td>${voucher.created_at}</td>
                    <td>${voucher.used_at || '-'}</td>
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
    console.log('Vendor page loaded, checking session...');
    
    // Check vendor session on page load
    const isVendor = await checkVendorSession();
    if (!isVendor) {
        console.log('Initial vendor check failed');
        return;
    }
    
    console.log('Vendor session valid, setting up event listeners');
    
    // Initialize modal
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    const voucherCountInput = document.getElementById('voucherCount');
    const voucherCountDisplay = document.getElementById('voucherCountDisplay');
    const generateBtn = document.getElementById('generateVoucher');
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

    // Handle logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/vendor/logout', {
                    method: 'GET',
                    credentials: 'include'
                });
                if (response.ok) {
                    window.location.href = '/vendor-login';
                }
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }

    // Initial load of vouchers
    loadVouchers();
}); 