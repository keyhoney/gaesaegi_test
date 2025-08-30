(function () {
  'use strict';

  // Firebase만 사용

  const $tabs = document.querySelectorAll('.tab');
  const $favTab = document.getElementById('favTab');
  const $wrongTab = document.getElementById('wrongTab');
  const $favList = document.getElementById('favList');
  const $wrongList = document.getElementById('wrongList');

  async function listFavIds() { try { return await window.firebaseData?.listFavorites?.() || []; } catch (_) { return []; } }
  async function listWrongIds() { try { return await window.firebaseData?.listWrongs?.() || []; } catch (_) { return []; } }

  function loadData() {
    return fetch('questions.json', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('로드 실패'); return r.json(); });
  }

  function findQuestionMetaIndex(dataset) {
    // id -> {과목,대분류,중분류,소분류,난이도,문항주소,해설주소}
    const map = new Map();
    dataset.forEach(bucket => {
      const subject = bucket['과목'];
      const cat = bucket['대분류'];
      const sub = bucket['중분류'];
      const topic = bucket['소분류'];
      (bucket['문항들'] || []).forEach(q => {
        map.set(q['문항번호'], {
          subject, cat, sub, topic,
          difficulty: q['난이도'] || '',
          img: q['문항주소'] || '',
          solution: q['해설주소'] || ''
        });
      });
    });
    return map;
  }

  function makeLink(m, id) {
    const q = new URLSearchParams({
      subject: m.subject,
      cat: m.cat,
      sub: m.sub,
      topic: m.topic,
      qid: id,
    });
    return `individual-study.html?${q.toString()}`;
  }

  async function renderFav(list, meta) {
    $favList.innerHTML = '';
    if (list.size === 0) { $favList.textContent = '즐겨찾기한 문항이 없습니다.'; return; }
    list.forEach(id => {
      const m = meta.get(id);
      if (!m) return;
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <div class="line top"><div class="meta">${m.subject} / ${m.cat} / ${m.sub} / ${m.topic}</div></div>
        <div class="line bottom"><div class="id">${id}</div><div class="diff">${m.difficulty}</div><div class="actions"><a class="btn ghost small" href="${makeLink(m, id)}" target="_self">문제 보기</a><button type="button" class="btn small remove-fav" data-id="${id}">삭제</button></div></div>
      `;
      const rm = row.querySelector('.remove-fav');
      rm.addEventListener('click', async () => {
        await window.firebaseData?.removeFavorite?.(id);
        const ids = await listFavIds();
        renderFav(new Set(ids), meta);
      });
      $favList.appendChild(row);
    });
  }

  function renderWrong(list, meta) {
    $wrongList.innerHTML = '';
    if (list.size === 0) { $wrongList.textContent = '오답 문항이 없습니다.'; return; }
    list.forEach(id => {
      const m = meta.get(id);
      if (!m) return;
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <div class="line top"><div class="meta">${m.subject} / ${m.cat} / ${m.sub} / ${m.topic}</div></div>
        <div class="line bottom"><div class="id">${id}</div><div class="diff">${m.difficulty}</div><div class="actions"><a class="btn ghost small" href="${makeLink(m, id)}" target="_self">문제 보기</a></div></div>
      `;
      $wrongList.appendChild(row);
    });
  }

  function wireTabs() {
    $tabs.forEach(btn => btn.addEventListener('click', () => {
      $tabs.forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      const fav = tab === 'fav';
      $favTab.hidden = !fav; $wrongTab.hidden = fav;
    }));
  }

  (async function init() {
    wireTabs();
    const dataset = await loadData();
    const meta = findQuestionMetaIndex(dataset);
    const favIds = await listFavIds();
    const wrongIds = await listWrongIds();
    renderFav(new Set(favIds), meta);
    renderWrong(new Set(wrongIds), meta);
  })();
})();


