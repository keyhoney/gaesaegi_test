(function () {
  'use strict';

  // 보상 정책 (하루 1회)
  const STORAGE = {
    lastExamRewardDate: 'gsg_mock_exam_last_reward_date',
  };

  // DOM
  const $subject = document.getElementById('subjectSel');
  const $cat = document.getElementById('catSel');
  const $sub = document.getElementById('subSel');
  const $topic = document.getElementById('topicSel');
  const $addRange = document.getElementById('addRangeBtn');
  const $chips = document.getElementById('rangeChips');
  const $minHeart = document.getElementById('minHeart');
  const $maxHeart = document.getElementById('maxHeart');
  const $matchedCount = document.getElementById('matchedCount');
  const $numQuestions = document.getElementById('numQuestions');
  const $createExam = document.getElementById('createExamBtn');

  const $exam = document.getElementById('exam');
  const $examTitle = document.getElementById('examTitle');
  const $examProgress = document.getElementById('examProgress');
  const $examImage = document.getElementById('examImage');
  const $examAnswer = document.getElementById('examAnswer');
  const $prevBtn = document.getElementById('prevBtn');
  const $nextBtn = document.getElementById('nextBtn');
  const $submitExamBtn = document.getElementById('submitExamBtn');

  const $result = document.getElementById('result');
  const $summary = document.getElementById('summary');
  const $rewardMsg = document.getElementById('rewardMsg');
  const $breakdown = document.getElementById('breakdown');



  // 데이터
  let dataset = [];
  let hierarchy = null;
  let ranges = []; // [{ subject, cat?, sub?, topic? }]
  let pool = []; // 시험 생성 가능 문제 풀
  let currentExam = null; // { questions: [{id,img,answer,difficulty,solution}], answers: (string|undefined)[] }
  let cursor = 0;

  function loadJSON() {
    return fetch('questions.json', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('데이터 로드 실패'); return r.json(); })
      .then(j => { if (!Array.isArray(j)) throw new Error('형식 오류'); return j; });
  }

  function heartsToCount(str) {
    if (!str) return 0;
    return (str.match(/♥/g) || []).length;
  }

  function buildHierarchy(data) {
    return {
      subjects: Array.from(new Set(data.map(x => x['과목']))).sort(),
      getCats: s => Array.from(new Set(data.filter(x => x['과목'] === s).map(x => x['대분류']))).sort(),
      getSubs: (s, c) => Array.from(new Set(data.filter(x => x['과목'] === s && x['대분류'] === c).map(x => x['중분류']))).sort(),
      getTopics: (s, c, m) => Array.from(new Set(data.filter(x => x['과목'] === s && x['대분류'] === c && x['중분류'] === m).map(x => x['소분류']))).sort(),
      getQuestions: (s, c, m, t) => {
        const bucket = data.find(x => x['과목'] === s && x['대분류'] === c && x['중분류'] === m && x['소분류'] === t);
        return bucket?.['문항들'] ?? [];
      },
      filterByRange: (range) => {
        const { subject, cat, sub, topic } = range;
        return data.flatMap(x => {
          if (subject && x['과목'] !== subject) return [];
          if (cat && x['대분류'] !== cat) return [];
          if (sub && x['중분류'] !== sub) return [];
          if (topic && x['소분류'] !== topic) return [];
          return x['문항들'] || [];
        });
      }
    };
  }

  function opt(el, v, l) { const o = document.createElement('option'); o.value = v; o.textContent = l; el.appendChild(o); }
  function clearSel(el, ph) { el.innerHTML = ''; opt(el, '', ph); el.selectedIndex = 0; }
  function disable(el, b) { el.disabled = !!b; }

  function populateSubjects() {
    clearSel($subject, '과목 선택');
    hierarchy.subjects.forEach(s => opt($subject, s, s));
    disable($cat, true); disable($sub, true); disable($topic, true);
  }

  function onSubject() {
    const s = $subject.value;
    clearSel($cat, '선택 안 함'); clearSel($sub, '선택 안 함'); clearSel($topic, '선택 안 함');
    if (!s) { disable($cat, true); disable($sub, true); disable($topic, true); return; }
    hierarchy.getCats(s).forEach(v => opt($cat, v, v));
    disable($cat, false); disable($sub, true); disable($topic, true);
  }
  function onCat() {
    const s = $subject.value; const c = $cat.value;
    clearSel($sub, '선택 안 함'); clearSel($topic, '선택 안 함');
    if (!c) { disable($sub, true); disable($topic, true); return; }
    hierarchy.getSubs(s, c).forEach(v => opt($sub, v, v));
    disable($sub, false); disable($topic, true);
  }
  function onSub() {
    const s = $subject.value; const c = $cat.value; const m = $sub.value;
    clearSel($topic, '선택 안 함');
    if (!m) { disable($topic, true); return; }
    hierarchy.getTopics(s, c, m).forEach(v => opt($topic, v, v));
    disable($topic, false);
  }

  function normalizeRangeKey(r) {
    // 상위/하위를 동일 집합으로 간주하기 위해 넓은 범위로 정규화 키 생성
    return [r.subject || '', r.cat || '', r.sub || '', r.topic || ''].join('>');
  }

  function addRange() {
    const r = {
      subject: $subject.value || null,
      cat: $cat.value || null,
      sub: $sub.value || null,
      topic: $topic.value || null,
    };
    if (!r.subject) { alert('과목을 선택해 주세요.'); return; }
    // 동일 범위 중복 추가 방지
    const key = normalizeRangeKey(r);
    const exists = ranges.some(x => normalizeRangeKey(x) === key);
    if (exists) { alert('이미 추가된 범위입니다.'); return; }
    ranges.push(r);
    renderChips();
    updateMatched();
  }

  function renderChips() {
    $chips.innerHTML = '';
    ranges.forEach((r, i) => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      const text = [r.subject, r.cat, r.sub, r.topic].filter(Boolean).join(' / ');
      chip.innerHTML = `<span>${text}</span>`;
      const rm = document.createElement('button');
      rm.className = 'remove';
      rm.type = 'button';
      rm.setAttribute('aria-label', '삭제');
      rm.textContent = '✕';
      rm.addEventListener('click', () => { ranges.splice(i, 1); renderChips(); updateMatched(); });
      chip.appendChild(rm);
      $chips.appendChild(chip);
    });
  }

  function updateMatched() {
    // 난이도 범위
    const minH = Number($minHeart.value);
    const maxH = Number($maxHeart.value);
    if (minH > maxH) { $matchedCount.textContent = '0'; $createExam.disabled = true; return; }

    // 선택된 범위가 없으면 전체를 대상으로
    let items = [];
    if (ranges.length === 0) {
      items = dataset.flatMap(x => x['문항들'] || []);
    } else {
      // 범위별 문제를 합치되, 문항번호로 중복 제거
      const seen = new Set();
      ranges.forEach(r => {
        hierarchy.filterByRange(r).forEach(q => {
          const id = q['문항번호'];
          if (!seen.has(id)) { seen.add(id); items.push(q); }
        });
      });
    }
    // 난이도 필터
    items = items.filter(q => {
      const d = heartsToCount(q['난이도']);
      return d >= minH && d <= maxH;
    });
    pool = items.map(q => ({
      id: q['문항번호'],
      img: q['문항주소'],
      answer: String(q['정답']).trim(),
      difficulty: q['난이도'] || '',
      solution: q['해설주소'] || '',
      subject: (dataset.find(b => (b['문항들'] || []).some(x => x['문항번호'] === q['문항번호'])) || {})['과목'] || '',
      cat: (dataset.find(b => (b['문항들'] || []).some(x => x['문항번호'] === q['문항번호'])) || {})['대분류'] || null,
      sub: (dataset.find(b => (b['문항들'] || []).some(x => x['문항번호'] === q['문항번호'])) || {})['중분류'] || null,
      topic: (dataset.find(b => (b['문항들'] || []).some(x => x['문항번호'] === q['문항번호'])) || {})['소분류'] || null
    }));

    $matchedCount.textContent = String(pool.length);
    const minOk = pool.length >= 10;
    $createExam.disabled = !minOk;
    const max = Math.max(10, pool.length);
    $numQuestions.max = String(max);
    if (Number($numQuestions.value || '10') > max) $numQuestions.value = String(Math.min(max, Math.max(10, Number($numQuestions.value || '10'))));
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function createExam() {
    const n = Math.max(10, Math.min(Number($numQuestions.value || '10'), pool.length));
    if (pool.length < 10) { alert('최소 10문항이 필요합니다.'); return; }
    const selected = shuffle(pool.slice()).slice(0, n);
    currentExam = { questions: selected, answers: new Array(n).fill('') };
    cursor = 0;
    renderExam();
  }

  function resolveImagePath(path) {
    const normalized = (path || '').replace(/^\.\//, '');
    if (/^https?:\/\//i.test(normalized)) return normalized;
    // gsg/ 폴더 내에서 상대경로로 해석 (gsg/mun/...)
    return normalized;
  }

  function renderExam() {
    if (!currentExam) return;
    $exam.hidden = false; $result.hidden = true;
    const total = currentExam.questions.length;
    const q = currentExam.questions[cursor];
    $examTitle.textContent = `모의고사 (${total}문항)`;
    $examProgress.textContent = `${cursor + 1} / ${total}`;
    $examImage.src = resolveImagePath(q.img);
    $examImage.alt = `${q.id} 문제 이미지`;
    $examAnswer.value = currentExam.answers[cursor] || '';

    $prevBtn.disabled = cursor === 0;
    $nextBtn.disabled = cursor >= total - 1;
    $submitExamBtn.disabled = cursor < total - 1;
    $submitExamBtn.textContent = '최종 제출';
  }

  function move(delta) {
    if (!currentExam) return;
    // 현재 답 저장
    currentExam.answers[cursor] = ($examAnswer.value || '').trim();
    const next = cursor + delta;
    if (next < 0 || next >= currentExam.questions.length) return;
    cursor = next;
    renderExam();
  }

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function canReward() {
    const last = localStorage.getItem(STORAGE.lastExamRewardDate);
    if (!last) return true;
    return last !== todayKey();
  }

  async function grantExamReward() {
    console.log('모의고사 보상 지급 시작');
    
    if (!canReward()) {
      console.log('하루 1회 제한으로 인해 보상 지급 불가');
      return `보상은 하루에 한 번만 지급됩니다. 내일 다시 시도해 주세요.`;
    }
    
    console.log('Firebase 데이터 객체 확인:', !!window.firebaseData);
    console.log('addCoins 함수 확인:', !!window.firebaseData?.addCoins);
    
    // 코인 1개 지급
    try {
      const result = await window.firebaseData?.addCoins?.(1);
      console.log('addCoins 결과:', result);
      
      if (result && result.applied > 0) {
        localStorage.setItem(STORAGE.lastExamRewardDate, todayKey());
        console.log('보상 지급 성공, 로컬 스토리지 업데이트');
        return `모의고사 완료! 코인 1개를 획득했습니다! 🎉`;
      } else {
        console.log('보상 지급 실패 - applied가 0이거나 result가 없음');
        return `코인 지급에 실패했습니다. 잠시 후 다시 시도해 주세요.`;
      }
    } catch (error) {
      console.error('addCoins 호출 중 에러:', error);
      return `코인 지급 중 오류가 발생했습니다: ${error.message}`;
    }
  }

  function submitExam() {
    if (!currentExam) return;
    // 마지막 입력 저장
    currentExam.answers[cursor] = ($examAnswer.value || '').trim();
    const qs = currentExam.questions;
    const ans = currentExam.answers;
    let correct = 0;
    const detail = [];
    qs.forEach((q, i) => {
      const ok = (ans[i] || '').trim() === q.answer;
      if (ok) correct += 1;
      detail.push({ index: i + 1, id: q.id, ok, solution: q.solution });
    });
    const total = qs.length;
    const ratio = total > 0 ? correct / total : 0;
    const percent = Math.round(ratio * 100);

    $exam.hidden = true; $result.hidden = false;
    $summary.textContent = `정답 ${correct} / ${total} (${percent}%)`;
    
    // 보상 지급 (비동기 처리)
    (async () => {
      try {
        const rewardMsg = await grantExamReward();
        $rewardMsg.textContent = rewardMsg;
        
        // 보상이 실제로 지급되었는지 확인하여 토스트 메시지 표시
        if (rewardMsg.includes('코인 1개를 획득했습니다')) {
          console.log('토스트 메시지 표시 시도');
          if (window.showToast) {
            window.showToast('모의고사 완료! 코인 1개를 획득했습니다!', 'success');
            console.log('토스트 메시지 표시됨');
          } else {
            console.log('showToast 함수가 없음');
          }
        } else {
          console.log('보상 지급 실패로 토스트 메시지 표시 안함:', rewardMsg);
        }
      } catch (error) {
        console.error('모의고사 보상 지급 실패:', error);
        $rewardMsg.textContent = '보상 지급 중 오류가 발생했습니다.';
      }
    })();

    // 상세
    $breakdown.innerHTML = '';
    // 문항별 학습 로그 기록(세분화 가능하도록 카테고리 포함)
    const today = todayKey();
    const fbLogs = [];
    const fbAnswered = [];
    qs.forEach((q, i) => {
      const ok = (ans[i] || '').trim() === q.answer;
      fbLogs.push({ date: today, subject: q.subject || '', cat: q.cat || null, sub: q.sub || null, topic: q.topic || null, correct: ok ? 1 : 0, total: 1 });
      fbAnswered.push({ date: today, qid: q.id });
    });
    (async () => {
      try { await window.firebaseData?.addManyLearningLogs(fbLogs); } catch (_) {}
      try { await window.firebaseData?.addManyAnsweredLogs(fbAnswered); } catch (_) {}
      
      // 틀린 문항을 오답에 자동 추가
      try {
        for (let i = 0; i < qs.length; i++) {
          const ok = (ans[i] || '').trim() === qs[i].answer;
          if (!ok) {
            // 틀린 문항을 오답에 추가
            await window.firebaseData?.addWrong?.(qs[i].id);
          }
        }
      } catch (_) {}
      

    })();


    


    detail.forEach(d => {
      const el = document.createElement('div');
      el.className = `break-item ${d.ok ? 'ok' : 'bad'}`;
      el.innerHTML = `
        <div class="header">
          <strong>${d.index}. ${d.id}</strong>
          <span class="${d.ok ? 'ok' : 'bad'}">${d.ok ? '정답' : '오답'}</span>
        </div>
        <div class="solution">${d.solution ? `<a class="link" href="${d.solution}" target="_blank" rel="noopener">해설 영상 보기</a>` : ''}</div>
      `;
      $breakdown.appendChild(el);
    });
  }

  function wire() {
    $subject.addEventListener('change', onSubject);
    $cat.addEventListener('change', onCat);
    $sub.addEventListener('change', onSub);
    $addRange.addEventListener('click', (e) => { e.preventDefault(); addRange(); });
    [$minHeart, $maxHeart].forEach(el => el.addEventListener('change', updateMatched));
    $numQuestions.addEventListener('change', updateMatched);
    $createExam.addEventListener('click', (e) => { e.preventDefault(); createExam(); });
    $prevBtn.addEventListener('click', () => move(-1));
    $nextBtn.addEventListener('click', () => move(1));
    $submitExamBtn.addEventListener('click', submitExam);
  }

  (async function init() {
    try {
      dataset = await loadJSON();
      hierarchy = buildHierarchy(dataset);
      populateSubjects();
      updateMatched();
      wire();
    } catch (e) {
      console.error(e);
      alert('데이터 로드 중 오류가 발생했습니다. 새로고침 후 다시 시도해 주세요.');
    }
  })();
})();


