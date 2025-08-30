(function () {
  'use strict';

  function v(v) { return (v ?? '').toString().trim(); }

  function onlyDigits(s) { return (s || '').replace(/\D+/g, ''); }
  function formatPhoneKR(s) {
    const d = onlyDigits(s).slice(0, 11); // 최대 11자리 제한
    if (!d.startsWith('01')) return s;
    const head = d.slice(0, 3);
    const rest = d.slice(3);
    if (rest.length <= 3) return `${head}-${rest}`.replace(/-$/, '');
    if (rest.length <= 7) return `${head}-${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
    return `${head}-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
  }
  function isValidKRMobile(s) {
    if (!s) return false;
    const d = onlyDigits(s);
    // 허용: 010/011/016/017/018/019 + 7~8자리
    return /^01(0|1|[6-9])\d{7,8}$/.test(d);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const el = (id) => document.getElementById(id);
    const feedback = document.querySelector('.form-feedback');
    const data = {
      grade: Number(v(el('grade').value)),
      classNo: Number(v(el('classNo').value)),
      studentNo: Number(v(el('studentNo').value)),
      name: v(el('name').value),
      nickname: v(el('nickname').value),
      phone: v(el('phone').value),
    };
    // 필수값 검증
    if (!(data.grade && data.classNo && data.studentNo && data.name && data.nickname && data.phone)) {
      feedback.textContent = '모든 필드를 빠짐없이 입력해 주세요.';
      return;
    }
    if (!isValidKRMobile(data.phone)) {
      feedback.textContent = '전화번호 형식을 확인해 주세요. 예: 010-1234-5678';
      const p = el('phone');
      p.focus();
      p.setSelectionRange(p.value.length, p.value.length);
      return;
    }
    data.phone = formatPhoneKR(data.phone);
    try {
      const ok = await window.firebaseData?.saveMyProfile?.(data);
      if (!ok) throw new Error('save failed');
      window.showToast && window.showToast('프로필이 저장되었습니다.', 'success');
      window.location.href = 'index.html';
    } catch (err) {
      feedback.textContent = '저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
      window.showToast && window.showToast('저장에 실패했습니다.', 'error');
    }
  }

  window.addEventListener('load', () => {
    // 인증되지 않은 상태에서 접근 시 안내 후 메인으로 이동
    (async () => {
      try {
        const authed = await window.firebaseData?.isAuthenticated?.();
        if (!authed) {
          window.showToast && window.showToast('로그인 후 다시 시도해 주세요.', 'error');
          setTimeout(() => { window.location.href = 'index.html'; }, 1000);
          return;
        }
      } catch {}
    })();

    const form = document.getElementById('profileForm');
    form?.addEventListener('submit', onSubmit);
    const phone = document.getElementById('phone');
    if (phone) {
      phone.addEventListener('input', (e) => {
        const pos = phone.selectionStart || 0;
        const before = phone.value;
        phone.value = formatPhoneKR(before);
        // 커서 위치 보정(간단)
        try { phone.setSelectionRange(phone.value.length, phone.value.length); } catch {}
      });
      phone.addEventListener('blur', () => { phone.value = formatPhoneKR(phone.value); });
      // 모바일 숫자패드 유도
      phone.setAttribute('pattern', "[0-9\\-]{10,13}");
    }
    // 기존 프로필 채우기
    (async () => {
      try {
        const authed = await window.firebaseData?.isAuthenticated?.();
        if (!authed) return; // 비로그인 상태에서는 조회 시도하지 않음
        const prof = await window.firebaseData?.getMyProfile?.();
        if (prof) {
          const el = (id) => document.getElementById(id);
          if (prof.grade) el('grade').value = prof.grade;
          if (prof.classNo) el('classNo').value = prof.classNo;
          if (prof.studentNo) el('studentNo').value = prof.studentNo;
          if (prof.name) el('name').value = prof.name;
          if (prof.nickname) el('nickname').value = prof.nickname;
          if (prof.phone) el('phone').value = formatPhoneKR(prof.phone);
        }
      } catch {}
    })();
  });
})();


