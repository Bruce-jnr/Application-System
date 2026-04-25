// Global variables
let currentPage = 1;
let totalPages = 1;
let currentFilters = {
  status: 'all',
  dateFrom: '',
  dateTo: '',
  search: '',
};

// Check if Bootstrap is loaded
if (typeof bootstrap === 'undefined') {
  console.error(
    'Bootstrap is not loaded! Please make sure bootstrap.bundle.min.js is included in your HTML.'
  );
  showAlert(
    'danger',
    'Error: Bootstrap is not loaded. Please contact the administrator.'
  );
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function () {
  // Redirect to login if token missing
  if (!getAdminToken()) {
    window.location.href = '/admin-login';
    return;
  }
  // Load initial data
  loadDashboardStats();
  loadApplications();

  // Set up event listeners
  document
    .getElementById('searchInput')
    .addEventListener('input', debounce(handleSearch, 300));
  document
    .getElementById('statusFilter')
    .addEventListener('change', handleFilterChange);
  document
    .getElementById('dateFrom')
    .addEventListener('change', handleFilterChange);
  document
    .getElementById('dateTo')
    .addEventListener('change', handleFilterChange);
  document.getElementById('exportBtn').addEventListener('click', handleExport);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
});

function getAdminToken() {
  return localStorage.getItem('admin_token');
}

async function adminFetch(url, options = {}) {
  const token = getAdminToken();
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  return fetch(url, { ...options, headers });
}

// Load dashboard statistics
async function loadDashboardStats() {
  try {
    const response = await adminFetch('/api/admin/statistics');
    const data = await response.json();

    if (data.success) {
      document.getElementById('totalApplications').textContent =
        data.total || 0;
      document.getElementById('approvedApplications').textContent =
        data.approved || 0;
      document.getElementById('pendingApplications').textContent =
        data.pending || 0;
      document.getElementById('rejectedApplications').textContent =
        data.rejected || 0;
    } else {
      console.error('Failed to load dashboard stats:', data.message);
    }
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
  }
}

// Load applications with pagination and filters
async function loadApplications(page = 1) {
  try {
    const searchTerm = document.getElementById('searchInput')?.value || '';
    const statusFilter =
      document.getElementById('statusFilter')?.value || 'all';
    const dateFrom = document.getElementById('dateFrom')?.value || '';
    const dateTo = document.getElementById('dateTo')?.value || '';

    // Build query parameters
    const params = new URLSearchParams({
      page: page,
      limit: 10,
      search: searchTerm,
      status: statusFilter,
      dateFrom: dateFrom,
      dateTo: dateTo,
    });

    console.log('Fetching applications with params:', params.toString());

    const response = await adminFetch(
      `/api/admin/applications?${params.toString()}`
    );
    const data = await response.json();

    console.log('API Response:', data);

    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch applications');
    }

    const applicationsTable = document.getElementById('applicationsTable');
    if (!applicationsTable) {
      console.error('Applications table not found');
      return;
    }

    const tbody = applicationsTable.querySelector('tbody');
    if (!tbody) {
      console.error('Table body not found');
      return;
    }

    // Clear existing rows
    tbody.innerHTML = '';

    if (!data.applications || data.applications.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
                <td colspan="5" class="text-center">No applications found</td>
            `;
      tbody.appendChild(tr);
      return;
    }

    // Add each application to the table
    data.applications.forEach((app) => {
      console.log('Raw application data:', app);

      const row = document.createElement('tr');
      console.log('Created row element:', row);

      // Format date properly
      const createdAt = app.createdAt
        ? new Date(app.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'N/A';

      // Use the fullName directly from the API
      const fullName = app.fullName || 'N/A';

      // Get reference number from the API response
      const refNumber = app.referenceNumber || 'N/A';
      const status = app.status || 'pending';

      // Create the row content
      row.innerHTML = `
        <td>${refNumber}</td>
        <td>${fullName}</td>
        <td>${createdAt}</td>
        <td>
          <span class="badge ${getBadgeClass(status)}">${status.toUpperCase()}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-info view-btn" data-id="${app.applicant_id}">
            <i class="fas fa-eye"></i> View
          </button>
          ${
            status === 'pending'
              ? `
              <button class="btn btn-sm btn-success approve-btn" data-id="${app.applicant_id}">
                <i class="fas fa-check"></i> Approve
              </button>
              <button class="btn btn-sm btn-danger reject-btn" data-id="${app.applicant_id}">
                <i class="fas fa-times"></i> Reject
              </button>
            `
              : ''
          }
        </td>
      `;

      // Add event listeners to the buttons
      const viewBtn = row.querySelector('.view-btn');
      if (viewBtn) {
        viewBtn.addEventListener('click', () => viewApplication(app.applicant_id));
      }

      const approveBtn = row.querySelector('.approve-btn');
      if (approveBtn) {
        approveBtn.addEventListener('click', () => approveApplication(app.applicant_id));
      }

      const rejectBtn = row.querySelector('.reject-btn');
      if (rejectBtn) {
        rejectBtn.addEventListener('click', () => rejectApplication(app.applicant_id));
      }

      tbody.appendChild(row);
    });

    // Update pagination if available
    if (data.pagination) {
      updatePagination(data.pagination);
    }
  } catch (error) {
    console.error('Error loading applications:', error);
    // Show error in the table
    const tbody = document.querySelector('#applicationsTable tbody');
    if (tbody) {
      tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-danger">
                        Error loading applications: ${error.message}
                    </td>
                </tr>
            `;
    }
  }
}

// Helper function to create status badge
function getStatusBadge(status) {
  const badges = {
    pending: '<span class="badge bg-warning">Pending</span>',
    approved: '<span class="badge bg-success">Approved</span>',
    rejected: '<span class="badge bg-danger">Rejected</span>',
  };
  return badges[status] || '<span class="badge bg-secondary">Unknown</span>';
}

// Update pagination controls
function updatePagination(pagination) {
  const paginationContainer = document.getElementById('pagination');
  if (!paginationContainer) return;

  let html = '';

  // Previous button
  const prevButton = document.createElement('li');
  prevButton.className = `page-item ${
    pagination.currentPage === 1 ? 'disabled' : ''
  }`;
  const prevLink = document.createElement('a');
  prevLink.className = 'page-link';
  prevLink.href = '#';
  prevLink.textContent = 'Previous';
  prevLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (pagination.currentPage > 1) {
      loadApplications(pagination.currentPage - 1);
    }
  });
  prevButton.appendChild(prevLink);
  html += prevButton.outerHTML;

  // Page numbers
  for (let i = 1; i <= pagination.totalPages; i++) {
    const pageItem = document.createElement('li');
    pageItem.className = `page-item ${
      i === pagination.currentPage ? 'active' : ''
    }`;
    const pageLink = document.createElement('a');
    pageLink.className = 'page-link';
    pageLink.href = '#';
    pageLink.textContent = i;
    pageLink.addEventListener('click', (e) => {
      e.preventDefault();
      loadApplications(i);
    });
    pageItem.appendChild(pageLink);
    html += pageItem.outerHTML;
  }

  // Next button
  const nextButton = document.createElement('li');
  nextButton.className = `page-item ${
    pagination.currentPage === pagination.totalPages ? 'disabled' : ''
  }`;
  const nextLink = document.createElement('a');
  nextLink.className = 'page-link';
  nextLink.href = '#';
  nextLink.textContent = 'Next';
  nextLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (pagination.currentPage < pagination.totalPages) {
      loadApplications(pagination.currentPage + 1);
    }
  });
  nextButton.appendChild(nextLink);
  html += nextButton.outerHTML;

  paginationContainer.innerHTML = html;
}

// Event listeners for filters
document.addEventListener('DOMContentLoaded', function () {
  // Initial load
  loadApplications();

  // Add event listeners for filters
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');

  if (searchInput) {
    searchInput.addEventListener(
      'input',
      debounce(() => loadApplications(1), 500)
    );
  }
  if (statusFilter) {
    statusFilter.addEventListener('change', () => loadApplications(1));
  }
  if (dateFrom) {
    dateFrom.addEventListener('change', () => loadApplications(1));
  }
  if (dateTo) {
    dateTo.addEventListener('change', () => loadApplications(1));
  }
});

// Debounce helper function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Create a comprehensive preview and print modal
function createApplicationModal(application, mode = 'preview') {
  // Ensure academic records are properly initialized
  application.core_subjects = application.core_subjects || [];
  application.elective_subjects = application.elective_subjects || [];

  // Log the application data being used to create the modal
  console.log('Creating modal with application data:', application);
  console.log('Academic records:', {
    core_subjects: application.core_subjects,
    elective_subjects: application.elective_subjects
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const modal = document.createElement('div');
  modal.className = 'modal fade';
  modal.setAttribute('tabindex', '-1');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-hidden', 'true');
  modal.id = mode === 'print' ? 'printModal' : 'previewModal';

  // Create modal content
  modal.innerHTML = `
        <div class="modal-dialog modal-xl modal-dialog-scrollable" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${
                      mode === 'print'
                        ? 'Print Application'
                        : 'Application Details'
                    }</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="preview-modal-content">
                        <div class="preview-header">
                            <img src="/public/images/logo1.png" alt="NSACoE Logo" class="preview-logo">
                            <h1>Nsawkaw College of Education</h1>
                            <h2>Application Details</h2>
                            <div class="application-status">
                                <span class="badge bg-${
                                  application.status === 'approved'
                                    ? 'success'
                                    : application.status === 'rejected'
                                    ? 'danger'
                                    : 'warning'
                                }">${application.status}</span>
                                <p class="submission-date">Submitted on: ${formatDate(
                                  application.created_at
                                )}</p>
                            </div>
                        </div>

                        <!-- Personal Information Section -->
                        <div class="preview-section">
                            <h3>Personal Information</h3>
                            <div class="preview-grid">
                                <div class="preview-photo-serial">
                                    <div class="preview-photo">
                                        <img src="${
                                          application.photo_url ||
                                          '/public/images/default-photo.png'
                                        }" 
                                             alt="Student Photo" 
                                             class="document-thumbnail">
                                    </div>
                                    <div class="preview-serial">
                                        <div class="preview-item">
                                            <label>Serial Number:</label>
                                            <span>${
                                              application.serial_number ||
                                              'Not provided'
                                            }</span>
                                        </div>
                                        <div class="preview-item">
                                            <label>Reference Number:</label>
                                            <span>${
                                              application.reference_number ||
                                              'Not provided'
                                            }</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="preview-details-grid">
                                    <div class="preview-item">
                                        <label>Title:</label>
                                        <span>${
                                          application.title || 'Not provided'
                                        }</span>
                                    </div>
                                    <div class="preview-item">
                                        <label>Full Name:</label>
                                        <span>${application.first_name} ${
    application.middle_name || ''
  } ${application.last_name}</span>
                                    </div>
                                    <div class="preview-item">
                                        <label>Date of Birth:</label>
                                        <span>${formatDate(
                                          application.date_of_birth
                                        )}</span>
                                    </div>
                                    <div class="preview-item">
                                        <label>Gender:</label>
                                        <span>${
                                          application.gender || 'Not provided'
                                        }</span>
                                    </div>
                                    <div class="preview-item">
                                        <label>Place of Birth:</label>
                                        <span>${
                                          application.place_of_birth ||
                                          'Not provided'
                                        }</span>
                                    </div>
                                    <div class="preview-item">
                                        <label>Region of Birth:</label>
                                        <span>${
                                          application.birth_region ||
                                          'Not provided'
                                        }</span>
                                    </div>
                                    <div class="preview-item">
                                        <label>Nationality:</label>
                                        <span>${
                                          application.nationality ||
                                          'Not provided'
                                        }</span>
                                    </div>
                                    <div class="preview-item">
                                        <label>Place of Residence:</label>
                                        <span>${
                                          application.residence ||
                                          'Not provided'
                                        }</span>
                                    </div>
                                    <div class="preview-item">
                                        <label>Region of Residence:</label>
                                        <span>${
                                          application.residence_region ||
                                          'Not provided'
                                        }</span>
                                    </div>
                                    <div class="preview-item">
                                        <label>Religion:</label>
                                        <span>${
                                          application.religion || 'Not provided'
                                        }</span>
                                    </div>
                                    <div class="preview-item">
                                        <label>Ghanaian Languages:</label>
                                        <span>${
                                          application.languages
                                            ? application.languages.join(', ')
                                            : 'Not provided'
                                        }</span>
                                    </div>
                                    <div class="preview-item">
                                        <label>ID Type:</label>
                                        <span>${
                                          application.id_type || 'Not provided'
                                        }</span>
                                    </div>
                                    <div class="preview-item">
                                        <label>ID Number:</label>
                                        <span>${
                                          application.id_number ||
                                          'Not provided'
                                        }</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Contact Information Section -->
                        <div class="preview-section">
                            <h3>Contact Information</h3>
                            <div class="preview-grid">
                                <div class="preview-item">
                                    <label>Address:</label>
                                    <span>${
                                      application.address || 'Not provided'
                                    }</span>
                                </div>
                                <div class="preview-item">
                                    <label>City:</label>
                                    <span>${
                                      application.city || 'Not provided'
                                    }</span>
                                </div>
                                <div class="preview-item">
                                    <label>Region:</label>
                                    <span>${
                                      application.region || 'Not provided'
                                    }</span>
                                </div>
                                <div class="preview-item">
                                    <label>District:</label>
                                    <span>${
                                      application.district || 'Not provided'
                                    }</span>
                                </div>
                                <div class="preview-item">
                                    <label>Country:</label>
                                    <span>${
                                      application.country || 'Not provided'
                                    }</span>
                                </div>
                                <div class="preview-item">
                                    <label>Phone Numbers:</label>
                                    <span>${
                                      application.phone
                                        ? application.phone.join(', ')
                                        : 'Not provided'
                                    }</span>
                                </div>
                                <div class="preview-item">
                                    <label>GPS Address:</label>
                                    <span>${
                                      application.gps_code || 'Not provided'
                                    }</span>
                                </div>
                                <div class="preview-item">
                                    <label>Email:</label>
                                    <span>${
                                      application.email || 'Not provided'
                                    }</span>
                                </div>
                            </div>
                        </div>

                        <!-- Academic Information Section -->
                        <div class="preview-section">
                            <h3>Academic Information</h3>
                            <div class="preview-grid">
                                <div class="preview-item">
                                    <label>Core Subjects:</label>
                                    <table class="preview-table">
                                        <thead>
                                            <tr>
                                                <th>Subject</th>
                                                <th>Index Number</th>
                                                <th>Grade</th>
                                                <th>Exam Type</th>
                                                <th>Year</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${application.core_subjects.length > 0
                                                ? application.core_subjects.map(subject => `
                                                    <tr>
                                                        <td>${subject.subject_name || 'N/A'}</td>
                                                        <td>${subject.index_number || 'N/A'}</td>
                                                        <td>${subject.grade || 'N/A'}</td>
                                                        <td>${subject.exam_type || 'WASSCE'}</td>
                                                        <td>${subject.exam_year || new Date().getFullYear()}</td>
                                                    </tr>
                                                `).join('')
                                                : '<tr><td colspan="5">No core subjects found</td></tr>'
                                            }
                                        </tbody>
                                    </table>
                                </div>
                                <div class="preview-item">
                                    <label>Elective Subjects:</label>
                                    <table class="preview-table">
                                        <thead>
                                            <tr>
                                                <th>Subject</th>
                                                <th>Index Number</th>
                                                <th>Grade</th>
                                                <th>Exam Type</th>
                                                <th>Year</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${application.elective_subjects.length > 0
                                                ? application.elective_subjects.map(subject => `
                                                    <tr>
                                                        <td>${subject.subject_name || 'N/A'}</td>
                                                        <td>${subject.index_number || 'N/A'}</td>
                                                        <td>${subject.grade || 'N/A'}</td>
                                                        <td>${subject.exam_type || 'WASSCE'}</td>
                                                        <td>${subject.exam_year || new Date().getFullYear()}</td>
                                                    </tr>
                                                `).join('')
                                                : '<tr><td colspan="5">No elective subjects found</td></tr>'
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- Parent/Guardian Information Section -->
                        <div class="preview-section">
                            <h3>Parent/Guardian Information</h3>
                            <div class="preview-grid">
                                <div class="preview-item">
                                    <label>Parent/Guardian 1:</label>
                                    <div class="parent-info">
                                        <p><strong>Name:</strong> ${
                                          application.parent1_name ||
                                          'Not provided'
                                        }</p>
                                        <p><strong>Relationship:</strong> ${
                                          application.parent1_relation ||
                                          'Not provided'
                                        }</p>
                                        <p><strong>Occupation:</strong> ${
                                          application.parent1_occupation ||
                                          'Not provided'
                                        }</p>
                                        <p><strong>Phone:</strong> ${
                                          application.parent1_phone ||
                                          'Not provided'
                                        }</p>
                                        <p><strong>Email:</strong> ${
                                          application.parent1_email ||
                                          'Not provided'
                                        }</p>
                                    </div>
                                </div>
                                ${
                                  application.parent2_name
                                    ? `
                                    <div class="preview-item">
                                        <label>Parent/Guardian 2:</label>
                                        <div class="parent-info">
                                            <p><strong>Name:</strong> ${
                                              application.parent2_name
                                            }</p>
                                            <p><strong>Relationship:</strong> ${
                                              application.parent2_relation ||
                                              'Not provided'
                                            }</p>
                                            <p><strong>Occupation:</strong> ${
                                              application.parent2_occupation ||
                                              'Not provided'
                                            }</p>
                                            <p><strong>Phone:</strong> ${
                                              application.parent2_phone ||
                                              'Not provided'
                                            }</p>
                                            <p><strong>Email:</strong> ${
                                              application.parent2_email ||
                                              'Not provided'
                                            }</p>
                                        </div>
                                    </div>
                                `
                                    : ''
                                }
                            </div>
                        </div>

                        <!-- Emergency Contact Section -->
                        <div class="preview-section">
                            <h3>Emergency Contact</h3>
                            <div class="preview-grid">
                                <div class="preview-item">
                                    <label>Name:</label>
                                    <span>${
                                      application.emergency_contact ||
                                      'Not provided'
                                    }</span>
                                </div>
                                <div class="preview-item">
                                    <label>Phone:</label>
                                    <span>${
                                      application.emergency_phone ||
                                      'Not provided'
                                    }</span>
                                </div>
                                <div class="preview-item">
                                    <label>Relationship:</label>
                                    <span>${
                                      application.emergency_relation ||
                                      'Not provided'
                                    }</span>
                                </div>
                                <div class="preview-item">
                                    <label>Disability Status:</label>
                                    <span>${
                                      application.disability_status ||
                                      'Not provided'
                                    }</span>
                                </div>
                                ${
                                  application.disability_status === 'yes'
                                    ? `
                                    <div class="preview-item">
                                        <label>Disability Type:</label>
                                        <span>${
                                          application.disability_type ||
                                          'Not provided'
                                        }</span>
                                    </div>
                                `
                                    : ''
                                }
                            </div>
                        </div>

                        <!-- Additional Information Section -->
                        <div class="preview-section">
                            <h3>Additional Information</h3>
                            <div class="preview-grid">
                                <div class="preview-item">
                                    <label>How did you hear about us?</label>
                                    <span>${
                                      application.hear_about || 'Not provided'
                                    }</span>
                                </div>
                                <div class="preview-item">
                                    <label>Questions/Comments:</label>
                                    <span>${
                                      application.question || 'Not provided'
                                    }</span>
                                </div>
                            </div>
                        </div>

                        <!-- Documents Section -->
                        <div class="preview-section">
                            <h3>Submitted Documents</h3>
                            <div class="preview-grid">
                                <div class="preview-item">
                                    <label>Photo:</label>
                                    <div class="document-preview">
                                        <div class="photo-preview">
                                            <h4>Photo</h4>
                                            <img src="${application.photo_path || '/images/logo1.png'}" 
                                                 alt="Applicant Photo" 
                                                 style="max-width: 200px; max-height: 200px; object-fit: contain;">
                                            ${application.photo_path ? 
                                                `<a href="${application.photo_path}" target="_blank" class="view-link">View Full Size</a>` : 
                                                ''}
                                        </div>
                                    </div>
                                </div>
                                ${
                                    application.id_document_path
                                        ? `
                                        <div class="preview-item">
                                            <label>ID Document:</label>
                                            <div class="document-link">
                                                <a href="${application.id_document_path}" target="_blank" class="btn btn-sm btn-info">View Document</a>
                                            </div>
                                        </div>
                                    `
                                        : ''
                                }
                                ${
                                    application.birth_certificate_url
                                        ? `
                                        <div class="preview-item">
                                            <label>Birth Certificate:</label>
                                            <div class="document-link">
                                                <a href="${application.birth_certificate_url}" target="_blank" class="btn btn-sm btn-info">View Document</a>
                                            </div>
                                        </div>
                                    `
                                        : ''
                                }
                                ${
                                    application.academic_certificate_url
                                        ? `
                                        <div class="preview-item">
                                            <label>Academic Certificate:</label>
                                            <div class="document-link">
                                                <a href="${application.academic_certificate_url}" target="_blank" class="btn btn-sm btn-info">View Document</a>
                                            </div>
                                        </div>
                                    `
                                        : ''
                                }
                                ${
                                    application.other_documents_url && application.other_documents_url.length > 0
                                        ? `
                                        <div class="preview-item">
                                            <label>Other Documents:</label>
                                            <div class="document-links">
                                                ${application.other_documents_url.map((url, index) => `
                                                    <a href="${url}" target="_blank" class="btn btn-sm btn-info">View Document ${index + 1}</a>
                                                `).join('')}
                                            </div>
                                        </div>
                                    `
                                        : ''
                                }
                            </div>
                        </div>

                        <div class="preview-actions">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            ${
                              mode === 'preview' &&
                              application.status === 'pending'
                                ? `
                                <button type="button" class="btn btn-success" onclick="approveApplication(${application.applicant_id})">Approve</button>
                                <button type="button" class="btn btn-danger" onclick="rejectApplication(${application.applicant_id})">Reject</button>
                            `
                                : ''
                            }
                            <button type="button" class="btn btn-primary" onclick="printApplication(${
                              application.applicant_id
                            })">Print</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

  return modal;
}

// Helper function to format subjects with index numbers
function formatSubjectsWithIndex(subjects, indexNumbers, grades) {
  if (!subjects) return '<tr><td colspan="3">Not provided</td></tr>';

  const subjectArray = Array.isArray(subjects) ? subjects : subjects.split(',');
  const indexArray = Array.isArray(indexNumbers)
    ? indexNumbers
    : (indexNumbers || '').split(',');
  const gradeArray = Array.isArray(grades) ? grades : (grades || '').split(',');

  return subjectArray
    .map(
      (subject, index) => `
        <tr>
            <td>${indexArray[index] || 'N/A'}</td>
            <td>${subject.trim()}</td>
            <td>${gradeArray[index] || 'N/A'}</td>
        </tr>
    `
    )
    .join('');
}

// Update the viewApplication function to use the correct path
async function viewApplication(id) {
  try {
    // Update the URL to use the correct format for preview
    window.location.href = `/api/admin/application-preview/${id}`;
  } catch (error) {
    console.error('Error:', error);
    showAlert('danger', `Error loading application details: ${error.message}`);
  }
}

// Helper function to format dates
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Add print functionality
async function printApplication(id) {
  try {
    const response = await adminFetch(`/api/admin/applications/${id}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to load application details');
    }

    const application = data.application;
    if (!application) {
      throw new Error('No application data received');
    }

    // Create print modal
    const modal = createApplicationModal(application, 'print');
    document.body.appendChild(modal);

    // Initialize Bootstrap modal
    const modalInstance = new bootstrap.Modal(modal);

    // Show modal
    modalInstance.show();

    // Add print-specific styles
    const style = document.createElement('style');
    style.textContent = `
            @media print {
                body * {
                    visibility: hidden;
                }
                #printModal, #printModal * {
                    visibility: visible;
                }
                #printModal {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                }
                .modal-dialog {
                    max-width: 100%;
                    margin: 0;
                    padding: 0;
                }
                .modal-content {
                    border: none;
                    box-shadow: none;
                }
                .preview-actions {
                    display: none;
                }
            }
        `;
    document.head.appendChild(style);

    // Trigger print
    window.print();

    // Clean up
    modal.addEventListener('hidden.bs.modal', () => {
      modal.remove();
      style.remove();
    });
  } catch (error) {
    console.error('Error printing application:', error);
    showAlert('danger', `Error printing application: ${error.message}`);
  }
}

// Show styled confirmation dialog
function showConfirmDialog(message, onConfirm, onCancel) {
  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'modal fade';
  modal.setAttribute('tabindex', '-1');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-hidden', 'true');

  // Create modal content
  modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Confirm Action</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary confirm-btn">Confirm</button>
                </div>
            </div>
        </div>
    `;

  // Add modal to body
  document.body.appendChild(modal);

  // Initialize Bootstrap modal
  const modalInstance = new bootstrap.Modal(modal);

  // Handle confirm button click
  const confirmBtn = modal.querySelector('.confirm-btn');
  confirmBtn.addEventListener('click', () => {
    modalInstance.hide();
    if (onConfirm) onConfirm();
  });

  // Handle cancel
  modal.addEventListener('hidden.bs.modal', () => {
    if (onCancel) onCancel();
    modal.remove();
  });

  // Show modal
  modalInstance.show();
}

// Add this function to handle application approval
function approveApplication(id) {
  showConfirmDialog(
    'Are you sure you want to approve this application?',
    () => {
      fetch(`/api/admin/applications/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            showAlert('success', 'Application approved successfully!');
            loadApplications(); // Refresh the applications list
          } else {
            showAlert(
              'danger',
              data.message || 'Failed to approve application'
            );
          }
        })
        .catch((error) => {
          console.error('Error:', error);
          showAlert(
            'danger',
            'An error occurred while approving the application'
          );
        });
    }
  );
}

async function rejectApplication(id) {
  if (!confirm('Are you sure you want to reject this application?')) return;

  try {
    const response = await fetch(`/api/admin/applications/${id}/reject`, {
      method: 'POST',
    });
    const data = await response.json();

    if (data.success) {
      loadApplications(); // Refresh the table
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Error rejecting application:', error);
    alert('Error rejecting application');
  }
}

// Handle search
function handleSearch(e) {
  currentFilters.search = e.target.value;
  currentPage = 1;
  loadApplications();
}

// Handle filter changes
function handleFilterChange() {
  currentFilters.status = document.getElementById('statusFilter').value;
  currentFilters.dateFrom = document.getElementById('dateFrom').value;
  currentFilters.dateTo = document.getElementById('dateTo').value;
  currentPage = 1;
  loadApplications();
}

// Handle export
async function handleExport() {
  try {
    const queryParams = new URLSearchParams(currentFilters);
    const response = await adminFetch(
      `/api/admin/applications/export?${queryParams}`,
      {
        // Authorization header injected by adminFetch
      }
    );

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `applications-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } else {
      const errorData = await response.json();
      showAlert(errorData.message || 'Error exporting applications', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('Error exporting applications', 'danger');
  }
}

// Show alert message
function showAlert(type, message) {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

  const mainContent = document.querySelector('main');
  if (mainContent) {
    mainContent.insertBefore(alertDiv, mainContent.firstChild);
  } else {
    // If main content is not found, append to body
    document.body.insertBefore(alertDiv, document.body.firstChild);
  }

  // Auto dismiss after 5 seconds
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}

// Handle logout
async function handleLogout() {
  try {
    localStorage.removeItem('admin_token');
    const response = await fetch('/api/admin/logout', { method: 'POST' });

    if (!response.ok) {
      throw new Error('Logout failed');
    }

    const data = await response.json();
    if (data.success) {
      window.location.href = '/admin-login';
    } else {
      showAlert('danger', 'Error logging out');
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('danger', 'Error logging out');
  }
}

// Helper function to get badge class based on status
function getBadgeClass(status) {
  switch (status) {
    case 'approved':
      return 'bg-success';
    case 'rejected':
      return 'bg-danger';
    default:
      return 'bg-warning';
  }
}
