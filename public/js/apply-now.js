document.addEventListener('DOMContentLoaded', async function () {
  // Check for valid voucher session
  try {
    const response = await fetch('/api/auth/check-voucher-session');
    const data = await response.json();
    
    if (!data.success) {
      window.location.href = '/apply-now-login';
      return;
    }
  } catch (error) {
    window.location.href = '/apply-now-login';
    return;
  }

  const sections = document.querySelectorAll('.form-section');
  const nextBtns = document.querySelectorAll('.next-btn');
  const prevBtns = document.querySelectorAll('.prev-btn');
  const progressBar = document.getElementById('progressBar');
  const steps = document.querySelectorAll('.step');

  let currentSection = 0;

  // Show first section initially
  showSection(currentSection);

  // Next button click handler
  nextBtns.forEach((btn) => {
    btn.addEventListener('click', function () {
      if (validateSection(currentSection)) {
        currentSection++;
        showSection(currentSection);
        updateProgress();
      }
    });
  });

  // Previous button click handler
  prevBtns.forEach((btn) => {
    btn.addEventListener('click', function () {
      currentSection--;
      showSection(currentSection);
      updateProgress();
    });
  });

  // Show specific section
  function showSection(index) {
    sections.forEach((section, i) => {
      section.classList.toggle('active', i === index);
    });

    // Update step indicators
    steps.forEach((step, i) => {
      step.classList.remove('active', 'completed');
      if (i < index) {
        step.classList.add('completed');
      } else if (i === index) {
        step.classList.add('active');
      }
    });
  }

  // Validate current section before proceeding
  function validateSection(index) {
    const currentSection = sections[index];
    const requiredFields = currentSection.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach((field) => {
      if (!field.value.trim()) {
        field.classList.add('invalid');
        isValid = false;
      } else {
        field.classList.remove('invalid');
      }
    });

    if (!isValid) {
      showPopup('Please fill in all required fields before proceeding.');
    }

    return isValid;
  }

  // Update progress bar
  function updateProgress() {
    const progress = ((currentSection + 1) / sections.length) * 100;
    progressBar.style.width = progress + '%';
  }

  // Initialize progress bar
  updateProgress();
});

// Example: Validate GPS code format
document.getElementById('gpsCode').addEventListener('blur', function () {
  const gpsPattern = /^[A-Za-z]{2}-\d{3}-\d{4}$/;
  
});

// ==============Courses===================
document.addEventListener('DOMContentLoaded', function () {
  const electiveContainer = document.getElementById('electiveContainer');
  const addElectiveBtn = document.getElementById('addElectiveBtn');
  let electiveCount = 1;
  const maxElectives = 4;

  addElectiveBtn.addEventListener('click', function () {
    if (electiveCount >= maxElectives) {
      alert('Maximum of 4 elective subjects allowed');
      return;
    }

    electiveCount++;
    const newRow = document.createElement('div');
    newRow.className = 'subject-row elective-row';
    newRow.innerHTML = `
          <div class="form-group">
              <label>Elective Subject ${electiveCount}</label>
              <select name="electiveSubjects[]" class="form-control" required>
                  <option value="">Select Subject</option>
                  <optgroup label="Science">
                      <option value="Physics">Physics</option>
                      <option value="Chemistry">Chemistry</option>
                      <option value="Biology">Biology</option>
                      <option value="Elective Maths">Elective Maths</option>
                  </optgroup>
                  <optgroup label="Arts">
                      <option value="Literature">Literature in English</option>
                      <option value="Ghanaian Language">Ghanaian Language</option>
                      <option value="French">French</option>
                      <option value="CRS">Christian Religious Studies</option>
                      <option value="History">History</option>
                      <option value="Geography">Geography</option>
                      <option value="Economics">Economics</option>
                  </optgroup>
                  <optgroup label="Vocational">
                      <option value="Agriculture">Agriculture</option>
                      <option value="Food & Nutrition">Food & Nutrition</option>
                      <option value="Visual Arts">Visual Arts</option>
                  </optgroup>
                  <optgroup label="Business">
                      <option value="Accounting">Financial Accounting</option>
                      <option value="Business Mgmt">Business Management</option>
                      <option value="Cost Accounting">Cost Accounting</option>
                  </optgroup>
              </select>
          </div>
          <div class="form-group">
              <label>Index Number</label>
              <input type="text" name="electiveIndexNumbers[]" class="form-control" placeholder="Ex: 0123456789" required>
          </div>
          <div class="form-group">
              <label>Grade</label>
              <select name="electiveGrades[]" class="form-control" required>
                  <option value="">Select Grade</option>
                  <option value="A1">A1</option>
                  <option value="B2">B2</option>
                  <option value="B3">B3</option>
                  <option value="C4">C4</option>
                  <option value="C5">C5</option>
                  <option value="C6">C6</option>
                  <option value="D7">D7</option>
                  <option value="E8">E8</option>
                  <option value="F9">F9</option>
              </select>
          </div>
      `;

    electiveContainer.appendChild(newRow);
  });

  // Validate index number format
  document.addEventListener(
    'blur',
    function (e) {
      if (e.target.classList.contains('index-input')) {
        const indexPattern = /^\d{10}$/;
        if (e.target.value && !indexPattern.test(e.target.value)) {
          alert('Please enter a valid 10-digit index number');
          e.target.focus();
        }
      }
    },
    true
  );
});

document.getElementById('admissionForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);

  try {
    const response = await fetch('/api/applications', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Submission failed');
    }

    if (data.success && data.redirectUrl) {
      window.location.href = data.redirectUrl;
    } else {
      throw new Error('Invalid server response');
    }
  } catch (error) {
    alert(error.message || 'An error occurred while submitting your application. Please try again.');
  }
});

// Custom Popup Functionality
const customPopup = document.getElementById('customPopup');
const popupMessage = document.getElementById('popupMessage');
const closePopup = document.getElementById('closePopup');

// Show popup with custom message
function showPopup(message) {
  popupMessage.textContent = message;
  customPopup.style.display = 'flex';
}

// Close popup
closePopup.addEventListener('click', () => {
  customPopup.style.display = 'none';
});

// Validate form on submission
document
  .getElementById('admissionForm')
  .addEventListener('submit', function (e) {
    // Get all required fields
    const requiredFields = this.querySelectorAll('.required');
    let isValid = true;
    let firstInvalidField = null;

    requiredFields.forEach((field) => {
      const inputElement = field.querySelector('input, select, textarea');
      if (inputElement && !inputElement.value.trim()) {
        if (!firstInvalidField) {
          firstInvalidField = inputElement;
        }
        isValid = false;
        inputElement.classList.add('invalid');
        field.classList.add('invalid-label');
      } else {
        inputElement?.classList.remove('invalid');
        field.classList.remove('invalid-label');
      }
    });

    if (!isValid) {
      e.preventDefault();
      showPopup('Please fill in all required fields before proceeding.');
      if (firstInvalidField) {
        firstInvalidField.focus();
      }
    }
  });

// Add validation on field blur
document.querySelectorAll('[required]').forEach((field) => {
  field.addEventListener('blur', function () {
    if (!this.value.trim()) {
      this.classList.add('invalid');
    } else {
      this.classList.remove('invalid');
    }
  });
});

// Add logout functionality
document.addEventListener('DOMContentLoaded', function() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function() {
      try {
        const response = await fetch('/api/auth/applicant-logout', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();
        if (data.success) {
          // Redirect to login page
          window.location.href = '/apply-now-login';
        }
      } catch (error) {
        
      }
    });
  }
});
