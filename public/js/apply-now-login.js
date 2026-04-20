document.addEventListener('DOMContentLoaded', function () {
  const loginForm = document.getElementById('voucher-login-form');
  const errorMessage = document.getElementById('error-message');

  // Check if already logged in
  async function checkLoginStatus() {
    try {
      const response = await fetch('/api/auth/check-applicant');
      const data = await response.json();
      
      if (data.success) {
        window.location.href = '/apply-now';
      }
    } catch (error) {
      console.error('Error checking login status:', error);
    }
  }

  // Check login status on page load
  checkLoginStatus();

  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const serial = document.getElementById('serial').value.trim();
      const pin = document.getElementById('pin').value.trim();

      // Clear previous error message
      errorMessage.textContent = '';
      errorMessage.style.display = 'none';

      // Validate input
      if (!serial || !pin) {
        errorMessage.textContent = 'Please enter both serial number and PIN';
        errorMessage.style.display = 'block';
        return;
      }

      try {
        const response = await fetch('/api/auth/voucher-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ serial, pin }),
        });

        const data = await response.json();

        if (data.success) {
          // Store voucher info in session storage
          sessionStorage.setItem('voucherId', data.voucher.id);
          sessionStorage.setItem('serialNumber', data.voucher.serial_number);
          
          // Redirect to the application page
          window.location.href = '/apply-now';
        } else {
          // Display error message
          errorMessage.textContent = data.message || 'Login failed. Please try again.';
          errorMessage.style.display = 'block';
        }
      } catch (error) {
        console.error('Login error:', error);
        errorMessage.textContent = 'An error occurred during login. Please try again.';
        errorMessage.style.display = 'block';
      }
    });
  } else {
    console.error('Login form not found');
  }
});
