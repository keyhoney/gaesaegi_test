/* eslint-disable */
(function(){
  'use strict';

  // 간단한 임베드 노트 초기화기: note.html의 구현을 재사용하지 않고, note.js의 로직을 부분 임포트하기 어렵기에
  // iframe으로 note.html을 로드하는 방식을 사용합니다. 정적 배포(GitHub Pages)에서도 동작합니다.
  // note.html은 동일 출처(/gsg/)이므로 로컬스토리지 공유, PNG/JSON 내보내기 모두 동작합니다.

  function ensureDock() {
    let dock = document.getElementById('noteDock');
    if (dock) return dock;
    dock = document.createElement('aside');
    dock.id = 'noteDock';
    dock.className = 'note-dock';
    dock.innerHTML = '<div class="note-dock-header"><div class="note-dock-title">필기 노트</div><button id="noteDockClose" class="note-dock-close" type="button">닫기</button></div>'+
      '<div class="note-embed-root">'+
        '<section class="note-preview-pane" aria-label="문항 미리보기">'+
          '<div class="note-preview-header">현재 문항</div>'+
          '<div class="note-preview-body">'+
            '<img id="notePreviewImg" alt="현재 문항 이미지" />'+
            '<div id="notePreviewPh" class="note-preview-placeholder" aria-hidden="true">현재 페이지에서 문항 이미지를 찾으면 여기에 표시됩니다.</div>'+
          '</div>'+
        '</section>'+
        '<iframe id="noteFrame" title="필기 노트" src="note.html?embed=1"></iframe>'+
      '</div>';
    document.body.appendChild(dock);
    const closeBtn = document.getElementById('noteDockClose');
    closeBtn?.addEventListener('click', () => dock.classList.remove('open'));
    return dock;
  }

  function ensureFab() {
    let fab = document.getElementById('noteFab');
    if (fab) return fab;
    fab = document.createElement('button');
    fab.id = 'noteFab';
    fab.className = 'note-fab';
    fab.type = 'button';
    fab.title = '필기 노트 열기';
    fab.setAttribute('aria-label', '필기 노트 열기');
    fab.textContent = '노트';
    document.body.appendChild(fab);
    fab.addEventListener('click', () => {
      const dock = ensureDock();
      dock.classList.toggle('open');
      if (dock.classList.contains('open')) updatePreviewImage();
    });
    return fab;
  }

  function findQuestionImageElement() {
    const byId = document.getElementById('examImage') || document.getElementById('questionImage');
    if (byId && byId.tagName === 'IMG') return byId;
    const q = document.querySelector('.question-view img, .question-content img, img[alt*="문제" i]');
    if (q && q.tagName === 'IMG') return q;
    return null;
  }

  function updatePreviewImage() {
    const imgEl = findQuestionImageElement();
    const preview = document.getElementById('notePreviewImg');
    const placeholder = document.getElementById('notePreviewPh');
    if (!preview) return;
    if (imgEl && imgEl.src) {
      preview.src = imgEl.src;
      preview.alt = imgEl.alt || '현재 문항 이미지';
      if (placeholder) placeholder.style.display = 'none';
    } else {
      preview.removeAttribute('src');
      preview.alt = '';
      if (placeholder) placeholder.style.display = '';
    }
  }

  function watchQuestionImageChanges() {
    // 주기적으로 갱신 (간단하고 교체에도 안전)
    let lastSrc = '';
    setInterval(() => {
      const el = findQuestionImageElement();
      const current = el && el.src ? el.src : '';
      if (current && current !== lastSrc) {
        lastSrc = current;
        updatePreviewImage();
      }
    }, 1200);
  }

  function init() {
    ensureFab();
    ensureDock();
    watchQuestionImageChanges();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();


