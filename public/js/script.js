// Initialize news counter functionality
function initializeNewsCounter() {
  const allPostBtn = document.querySelector('.allpost');
  const generalBtn = document.querySelector('.general');
  const staffBtn = document.querySelector('.staff');
  const studentBtn = document.querySelector('.student');

  const updateCounters = () => {
    const generalNewsItems = document.querySelectorAll('.general-news').length;
    const staffNewsItems = document.querySelectorAll('.staff-news').length;
    const studentNewsItems = document.querySelectorAll('.student-news').length;

    const generalCountSpan = document.querySelector('.general-count');
    const staffCountSpan = document.querySelector('.staff-count');
    const studentCountSpan = document.querySelector('.student-count');
    const allPostCountSpan = document.querySelector('.allpost-count');

    if (generalCountSpan) generalCountSpan.textContent = generalNewsItems;
    if (staffCountSpan) staffCountSpan.textContent = staffNewsItems;
    if (studentCountSpan) studentCountSpan.textContent = studentNewsItems;
    if (allPostCountSpan)
      allPostCountSpan.textContent =
        generalNewsItems + staffNewsItems + studentNewsItems;
  };

  const getGeneral = () => {
    const generalNews = document.querySelectorAll('.general-news');
    const staffNews = document.querySelectorAll('.staff-news');
    const studentNews = document.querySelectorAll('.student-news');

    generalNews.forEach((news) => (news.style.display = 'flex'));
    staffNews.forEach((news) => (news.style.display = 'none'));
    studentNews.forEach((news) => (news.style.display = 'none'));
    updateCounters();
  };

  const getAllPost = () => {
    const generalNews = document.querySelectorAll('.general-news');
    const staffNews = document.querySelectorAll('.staff-news');
    const studentNews = document.querySelectorAll('.student-news');

    generalNews.forEach((news) => (news.style.display = 'flex'));
    staffNews.forEach((news) => (news.style.display = 'flex'));
    studentNews.forEach((news) => (news.style.display = 'flex'));
    updateCounters();
  };

  const getStaff = () => {
    const generalNews = document.querySelectorAll('.general-news');
    const staffNews = document.querySelectorAll('.staff-news');
    const studentNews = document.querySelectorAll('.student-news');

    generalNews.forEach((news) => (news.style.display = 'none'));
    staffNews.forEach((news) => (news.style.display = 'flex'));
    studentNews.forEach((news) => (news.style.display = 'none'));
    updateCounters();
  };

  const getStudent = () => {
    const generalNews = document.querySelectorAll('.general-news');
    const staffNews = document.querySelectorAll('.staff-news');
    const studentNews = document.querySelectorAll('.student-news');

    generalNews.forEach((news) => (news.style.display = 'none'));
    staffNews.forEach((news) => (news.style.display = 'none'));
    studentNews.forEach((news) => (news.style.display = 'flex'));
    updateCounters();
  };

  if (allPostBtn) allPostBtn.addEventListener('click', getAllPost);
  if (generalBtn) generalBtn.addEventListener('click', getGeneral);
  if (staffBtn) staffBtn.addEventListener('click', getStaff);
  if (studentBtn) studentBtn.addEventListener('click', getStudent);

  // Initial counter update
  updateCounters();
}

// Initialize mobile menu
function initializeMobileMenu() {
  const menu = document.querySelector('.nav_menu');
  const menuBtn = document.querySelector('#open-menu-btn');
  const closeBtn = document.querySelector('#close-menu-btn');

  if (!menu || !menuBtn || !closeBtn) return;

  const openMenu = () => {
    menu.style.display = 'flex';
    menuBtn.style.display = 'none';
    closeBtn.style.display = 'inline-block';
  };

  const closeMenu = () => {
    menu.style.display = 'none';
    menuBtn.style.display = 'inline-block';
    closeBtn.style.display = 'none';
  };

  menuBtn.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', closeMenu);
}

// Initialize notice board swiper if it exists
function initializeNoticeBoard() {
  const swiperElement = document.querySelector('.mySwiper');
  if (swiperElement) {
    const swiper = new Swiper('.mySwiper', {
      spaceBetween: 30,
      centeredSlides: true,
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
      navigation: {
        nextEl: '.next-btn',
        prevEl: '.prev-btn',
      },
      loop: true,
      autoplay: {
        delay: 5000,
        disableOnInteraction: false,
      },
    });
  }
}

// Update copyright year
function updateCopyrightYear() {
  const yearElement = document.getElementById('currentYear');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
  initializeNewsCounter();
  initializeMobileMenu();
  initializeNoticeBoard();
  updateCopyrightYear();



  // Populate Latest News (dynamic, with categories)
  fetch('/api/public/news?limit=12')
    .then(r => r.json())
    .then(data => {
      if (!data.success) return;
      const container = document.querySelector('.news-cards');
      if (!container) return;
      container.innerHTML = (data.items || []).map(n => {
        const cat = (n.category || 'General').toLowerCase();
        const catClass = cat.includes('staff') ? 'staff-news' : cat.includes('student') ? 'student-news' : 'general-news';
        const dateStr = new Date(n.published_at).toLocaleDateString('en-GB');
        return `
        <div class="news-tab ${catClass}">
          ${n.image_url ? `<img src="${n.image_url}" alt="news-image" class="news-image"/>` : ''}
          <div class="news-content">
            <p class="news-tab-catergories">${n.category || 'General'}</p>
            <p class="news-tab-catergories date">${dateStr}</p>
            <a href="#" class="news-header" target="_blank">${n.title}</a>
            <p>${n.excerpt || (n.content || '').slice(0,180)}...</p>
          </div>
        </div>`;
      }).join('');
      initializeNewsCounter();
    }).catch(() => {});
});
