// 내비게이션 토글 (모바일)
const navToggleButton = document.getElementById('navToggle');
const siteNav = document.getElementById('siteNav');
const loginBtn = document.getElementById('loginBtn');
const loginModal = document.getElementById('loginModal');

if (navToggleButton && siteNav) {
  navToggleButton.addEventListener('click', () => {
    const isOpen = siteNav.classList.toggle('open');
    navToggleButton.setAttribute('aria-expanded', String(isOpen));
  });
}

// 고정 헤더 높이 계산
function getHeaderHeight() {
  const header = document.querySelector('.site-header');
  if (header) {
    const rect = header.getBoundingClientRect();
    return Math.max(0, Math.round(rect.height));
  }
  return 64; // fallback
}

function isHttpContext() {
  return location.protocol === 'http:' || location.protocol === 'https:';
}

// 부드러운 스크롤 및 현재 섹션에 따른 메뉴 하이라이트
const navLinks = Array.from(document.querySelectorAll('#siteNav a'));

navLinks.forEach((link) => {
  link.addEventListener('click', (ev) => {
    const href = link.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    const target = document.querySelector(href);
    if (!target) return;
    ev.preventDefault();

    // 모바일에서 메뉴 닫기
    siteNav.classList.remove('open');
    navToggleButton?.setAttribute('aria-expanded', 'false');

    const yOffset = -(getHeaderHeight() - 8); // 고정 헤더 보정 + 여백
    const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  });
});

// 현재 섹션 감지하여 메뉴 활성화
const sectionIds = ['individual-study', 'mock-exam', 'favorites', 'lottery', 'feedback'];
const sectionMap = new Map(
  sectionIds.map((id) => [id, document.getElementById(id)])
);

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
      }
    });
  },
  { root: null, rootMargin: '-50% 0px -45% 0px', threshold: 0 }
);

sectionMap.forEach((el) => el && observer.observe(el));



// 푸터 연도 자동 반영
const yearSpan = document.getElementById('year');
if (yearSpan) {
  yearSpan.textContent = String(new Date().getFullYear());
}

// 해시로 진입했을 때 헤더에 가려지지 않도록 보정
window.addEventListener('load', () => {
  const hash = window.location.hash;
  if (!hash) return;
  const target = document.querySelector(hash);
  if (!target) return;
  const yOffset = -(getHeaderHeight() - 8);
  const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
  window.scrollTo({ top: y });
});

// 로그인 모달 열기/닫기 및 간단한 유효성 검사 + 가짜 로그인 처리
function openLogin() {
  if (!loginModal) return;
  loginModal.classList.add('open');
  loginModal.setAttribute('aria-hidden', 'false');
  const firstField = loginModal.querySelector('input');
  firstField?.focus();
}
function closeLogin() {
  if (!loginModal) return;
  loginModal.classList.remove('open');
  loginModal.setAttribute('aria-hidden', 'true');
  loginBtn?.focus();
}

loginBtn?.addEventListener('click', openLogin);
loginModal?.addEventListener('click', (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.matches('[data-close], .modal-backdrop')) {
    closeLogin();
  }
});

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const feedback = loginForm.querySelector('.form-feedback');
    if (!isHttpContext()) {
      if (feedback) feedback.textContent = '구글 로그인을 사용하려면 로컬 서버(http://localhost)에서 접속해야 합니다.';
      return;
    }
    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      const { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      const firebaseConfig = await window.loadFirebaseConfig();

      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
      } catch (popupErr) {
        if (popupErr && popupErr.code === 'auth/popup-blocked') {
          await signInWithRedirect(auth, provider);
          return; // 리디렉션 흐름으로 전환
        }
        throw popupErr;
      }
      if (feedback) feedback.textContent = '로그인 성공!';
      closeLogin();
      setupAuthUI(auth, onAuthStateChanged, signOut);
    } catch (err) {
      if (feedback) feedback.textContent = '로그인 실패: ' + (err?.message || '오류가 발생했습니다');
    }
  });
}

async function setupAuthUI(auth, onAuthStateChanged, signOut) {
  const loginBtnEl = document.getElementById('loginBtn');
  const navEl = document.getElementById('siteNav');
  if (!loginBtnEl || !navEl) return;

  const ensureLogoutBtn = () => {
    let logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) {
      logoutBtn = document.createElement('button');
      logoutBtn.id = 'logoutBtn';
      logoutBtn.className = 'btn ghost small';
      logoutBtn.textContent = '로그아웃';
      loginBtnEl.insertAdjacentElement('afterend', logoutBtn);
    }
    return logoutBtn;
  };

  const ensureProfileBtn = () => {
    let profileBtn = document.getElementById('profileBtn');
    if (!profileBtn) {
      profileBtn = document.createElement('button');
      profileBtn.id = 'profileBtn';
      profileBtn.className = 'btn ghost small';
      profileBtn.textContent = '프로필 수정';
      loginBtnEl.insertAdjacentElement('afterend', profileBtn);
      profileBtn.onclick = () => { window.location.href = 'profile.html?edit=1'; };
    }
    return profileBtn;
  };

  onAuthStateChanged(auth, (user) => {
    const protectedLinks = navEl.querySelectorAll('a');
    protectedLinks.forEach((a) => {
      a.classList.toggle('disabled', !user);
      a.setAttribute('aria-disabled', String(!user));
      if (!user) {
        a.addEventListener('click', blockIfNoAuth);
      } else {
        a.removeEventListener('click', blockIfNoAuth);
      }
    });

    if (user) {
      loginBtnEl.style.display = 'none';
      const profileBtn = ensureProfileBtn();
      const logoutBtn = ensureLogoutBtn();
      logoutBtn.onclick = async () => {
        try { await signOut(auth); } catch {}
      };
    } else {
      loginBtnEl.style.display = '';
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) logoutBtn.remove();
      const profileBtn = document.getElementById('profileBtn');
      if (profileBtn) profileBtn.remove();
    }
  });
}

function blockIfNoAuth(e) {
  const target = e.currentTarget;
  if (target && target.getAttribute('aria-disabled') === 'true') {
    e.preventDefault();
    openLogin();
  }
}

// 페이지 로드 시 인증 상태 연결 (리디렉션 처리 포함)
window.addEventListener('load', async () => {
  if (!isHttpContext()) return;
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { getAuth, onAuthStateChanged, signOut, getRedirectResult, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const firebaseConfig = await window.loadFirebaseConfig();
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    // 리디렉션 로그인 결과 처리
    try { await getRedirectResult(auth); } catch {}
    setupAuthUI(auth, onAuthStateChanged, signOut);

    
  } catch {}
});

// ===== Toast =====
function showToast(message, type = 'info', timeoutMs = 2400) {
  try {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.setAttribute('role', 'status');
    el.textContent = message;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 200);
    }, timeoutMs);
  } catch {}
}

// 전역 노출
window.showToast = showToast;



// ===== Hero Carousel =====
(function initCarousel() {
  const slides = Array.from(document.querySelectorAll('.carousel .slide'));
  const dots = Array.from(document.querySelectorAll('.carousel .dot'));
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  if (!slides.length || !dots.length || !prevBtn || !nextBtn) return;

  let index = 0;
  let timer = null;
  const INTERVAL = 5000;

  function show(i) {
    index = (i + slides.length) % slides.length;
    slides.forEach((s, si) => s.classList.toggle('active', si === index));
    dots.forEach((d, di) => {
      d.classList.toggle('active', di === index);
      d.setAttribute('aria-selected', String(di === index));
    });
    // 히어로 배경 테마 전환
    const hero = document.querySelector('.hero');
    if (hero) {
      hero.classList.remove('theme-1', 'theme-2', 'theme-3', 'theme-4');
      const themeId = slides[index].getAttribute('data-theme');
      if (themeId) hero.classList.add(`theme-${themeId}`);
    }
  }

  function next() { show(index + 1); }
  function prev() { show(index - 1); }

  function startAuto() {
    stopAuto();
    timer = setInterval(next, INTERVAL);
  }
  function stopAuto() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  nextBtn.addEventListener('click', () => { next(); startAuto(); });
  prevBtn.addEventListener('click', () => { prev(); startAuto(); });
  dots.forEach((d) => d.addEventListener('click', () => { const i = Number(d.dataset.index||0); show(i); startAuto(); }));

  // 슬라이드 클릭 시 해당 섹션으로 이동
  slides.forEach((s) => {
    s.addEventListener('click', (e) => {
      // 버튼 클릭은 기본 동작 유지
      if (e.target.closest('.btn')) return;
      const targetSel = s.getAttribute('data-target');
      const target = targetSel && document.querySelector(targetSel);
      if (target) {
        const yOffset = -(getHeaderHeight() - 8);
        const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });

  // 자동 재생 시작/정지 (가시성/포커스 고려)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAuto(); else startAuto();
  });
  window.addEventListener('focus', startAuto);
  window.addEventListener('blur', stopAuto);

  show(0);
  startAuto();
})();

