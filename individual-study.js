(function () {
  'use strict';
  // 토스트 헬퍼
  function toast(msg, type) {
    try { window.showToast ? window.showToast(msg, type) : null; } catch {}
  }



  // 로컬 스토리지 사용 제거. 파이어베이스에만 기록/조회합니다.

  // DOM 참조
  const $subject = document.getElementById('subjectSelect');
  const $category = document.getElementById('categorySelect');
  const $subcategory = document.getElementById('subcategorySelect');
  const $topic = document.getElementById('topicSelect');
  const $question = document.getElementById('questionSelect');

  const $questionArea = document.getElementById('questionArea');
  const $qn = document.getElementById('questionNumber');
  const $diff = document.getElementById('questionDifficulty');
  const $img = document.getElementById('questionImage');
  const $solutionLink = document.getElementById('solutionLink');
  const $favToggle = document.getElementById('favToggle');
  
  // 문제 풀이 기록 표시 영역
  const $questionHistory = document.getElementById('questionHistory');

  const $answerForm = document.getElementById('answerForm');
  const $answerInput = document.getElementById('answerInput');
  const $feedback = document.getElementById('feedback');

  // 로컬 상태
  let dataset = [];
  let currentQuestion = null; // { 문항번호, 문항주소, 정답, 난이도, 해설주소 }
  
  // 보상 시스템 상수
  const DAILY_QUESTIONS_FOR_COIN = 10; // 하루 10문제 풀이 시 코인 1개 지급
  const COOLDOWN_HOURS = 96; // 96시간(4일) 쿨다운

  // 96시간 쿨다운 체크 함수
  async function checkQuestionCooldown(qid) {
    try {
      const lastCorrectTime = await window.firebaseData?.getQuestionLastCorrectTime?.(qid);
      if (!lastCorrectTime) return { isInCooldown: false, remainingTime: 0 };
      
      const lastCorrectDate = lastCorrectTime.toDate ? lastCorrectTime.toDate() : new Date(lastCorrectTime);
      const now = new Date();
      const timeDiff = now.getTime() - lastCorrectDate.getTime();
      const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
      
      if (timeDiff < cooldownMs) {
        const remainingMs = cooldownMs - timeDiff;
        return { isInCooldown: true, remainingTime: remainingMs };
      }
      
      return { isInCooldown: false, remainingTime: 0 };
    } catch (error) {
      console.error('쿨다운 체크 중 오류:', error);
      return { isInCooldown: false, remainingTime: 0 };
    }
  }

  // 남은 시간을 읽기 쉬운 형태로 변환
  function formatRemainingTime(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}일 ${remainingHours}시간 ${minutes}분`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  }

  // 쿨다운 상태 표시 업데이트
  async function updateCooldownDisplay(qid) {
    try {
      const cooldownInfo = await checkQuestionCooldown(qid);
      const cooldownElement = document.getElementById('cooldownDisplay');
      
      console.log('쿨다운 체크:', qid, cooldownInfo); // 디버깅용
      
      if (cooldownElement) {
        if (cooldownInfo.isInCooldown) {
          const remainingTime = formatRemainingTime(cooldownInfo.remainingTime);
          cooldownElement.innerHTML = `
            <div class="cooldown-info">
              <span class="cooldown-text">⏰ 이 문제는 ${remainingTime} 후에 다시 카운팅됩니다</span>
              <span class="cooldown-detail">(96시간 쿨다운 적용)</span>
            </div>
          `;
          cooldownElement.style.display = 'block';
          console.log('쿨다운 표시됨:', remainingTime); // 디버깅용
        } else {
          cooldownElement.style.display = 'none';
          console.log('쿨다운 표시 숨김'); // 디버깅용
        }
      } else {
        console.error('cooldownDisplay 요소를 찾을 수 없음'); // 디버깅용
      }
      
      return cooldownInfo;
    } catch (error) {
      console.error('쿨다운 표시 업데이트 중 오류:', error);
      return { isInCooldown: false, remainingTime: 0 };
    }
  }

  // 로컬 저장 제거: 즐겨찾기/오답/로그는 전부 Firebase로

  function todayKey() { const d = new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }

  // 문제 풀이 기록 조회
  async function getQuestionHistory(qid) {
    try {
      // 최종 답안 기록 조회
      const finalAnswers = await window.firebaseData?.listFinalAnswers?.() || [];
      const questionAnswer = finalAnswers.find(answer => answer.id === qid);
      
      // 답안 제출 로그 조회
      const answeredLogs = await window.firebaseData?.fetchAnsweredLogs?.() || [];
      const questionLogs = answeredLogs.filter(log => log.qid === qid);
      
      if (!questionAnswer && questionLogs.length === 0) {
        return {
          hasHistory: false,
          totalAttempts: 0,
          lastAttemptDate: null,
          lastAttemptCorrect: null
        };
      }
      
      // 총 시도 횟수
      const totalAttempts = questionLogs.length;
      
      // 마지막 시도 정보
      let lastAttemptDate = null;
      let lastAttemptCorrect = null;
      
      if (questionAnswer) {
        lastAttemptDate = questionAnswer.date;
        lastAttemptCorrect = questionAnswer.correct;
      }
      
      return {
        hasHistory: true,
        totalAttempts,
        lastAttemptDate,
        lastAttemptCorrect
      };
    } catch (error) {
      console.error('문제 풀이 기록 조회 중 오류:', error);
      return {
        hasHistory: false,
        totalAttempts: 0,
        lastAttemptDate: null,
        lastAttemptCorrect: null
      };
    }
  }

  // 노트 초기화 함수
  function resetNote() {
    try {
      const noteFrame = document.getElementById('noteFrame');
      if (noteFrame && noteFrame.contentWindow) {
        // iframe에 postMessage로 노트 초기화 요청
        noteFrame.contentWindow.postMessage({
          type: 'resetNote',
          action: 'clearCanvas'
        }, '*');
      }
    } catch (error) {
      console.error('노트 초기화 실패:', error);
    }
  }

  // 문제 풀이 기록 UI 업데이트
  function updateQuestionHistoryUI(history) {
    if (!$questionHistory) return;
    
    if (!history.hasHistory) {
      $questionHistory.innerHTML = '<p class="history-info">이 문제는 처음 풀어보는 문제입니다.</p>';
      return;
    }
    
    const { totalAttempts, lastAttemptDate, lastAttemptCorrect } = history;
    
    let html = '<div class="history-info">';
    html += `<h4>📊 풀이 기록</h4>`;
    html += `<p><strong>총 시도 횟수:</strong> ${totalAttempts}회</p>`;
    
    if (lastAttemptDate) {
      const lastDate = new Date(lastAttemptDate);
      const formattedDate = lastDate.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      const resultIcon = lastAttemptCorrect ? '✅' : '❌';
      const resultText = lastAttemptCorrect ? '정답' : '오답';
      
      html += `<p><strong>마지막 시도:</strong> ${formattedDate} (${resultIcon} ${resultText})</p>`;
    }
    
    html += '</div>';
    $questionHistory.innerHTML = html;
  }

  // 96시간 쿨다운 기반 정답 문제 수 추적 및 코인 지급
  async function trackDailyQuestionsAndReward(qid, isCorrect) {
    try {
      const dateKey = await window.firebaseData?.getServerDateSeoulKey?.() || todayKey();
      
      // 96시간 쿨다운 체크
      const cooldownInfo = await checkQuestionCooldown(qid);
      
      if (isCorrect && !cooldownInfo.isInCooldown) {
        // 쿨다운이 끝난 새로운 정답인 경우에만 마지막 정답 시간 저장
        await window.firebaseData?.saveQuestionLastCorrectTime?.(qid);
        
        // 96시간 쿨다운이 끝난 문제들만 카운트 (쿨다운이 적용되지 않은 문제들)
        const allQuestionLastCorrectTimes = await window.firebaseData?.getAllQuestionLastCorrectTimes?.() || {};
        const now = new Date();
        const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
        
        // 96시간이 지난 문제들만 카운트 (쿨다운이 끝난 문제들)
        const eligibleQuestions = Object.entries(allQuestionLastCorrectTimes).filter(([questionId, lastCorrectTime]) => {
          if (!lastCorrectTime) return false;
          const lastCorrectDate = lastCorrectTime.toDate ? lastCorrectTime.toDate() : new Date(lastCorrectTime);
          const timeDiff = now.getTime() - lastCorrectDate.getTime();
          // 96시간이 지난 문제들만 카운트 (쿨다운이 끝난 문제들)
          return timeDiff >= cooldownMs;
        }).map(([questionId]) => questionId);
        
        const totalEligibleQuestions = eligibleQuestions.length;
        
        // 10문제 단위로 코인 지급
        if (totalEligibleQuestions % DAILY_QUESTIONS_FOR_COIN === 0) {
          const coinsEarned = Math.floor(totalEligibleQuestions / DAILY_QUESTIONS_FOR_COIN);
          await window.firebaseData?.addCoins?.(coinsEarned);
          
          const message = `축하합니다! ${totalEligibleQuestions}번째 정답을 맞췄습니다. 코인 ${coinsEarned}개를 획득했습니다! 🎉`;
          toast(message, 'success');
          return message;
        }
      } else if (isCorrect && cooldownInfo.isInCooldown) {
        // 쿨다운 중인 경우 알림
        const remainingTime = formatRemainingTime(cooldownInfo.remainingTime);
        const message = `이 문제는 ${remainingTime} 후에 다시 카운팅됩니다. (96시간 쿨다운)`;
        toast(message, 'info');
        return message;
      }
      
      return null; // 보상 지급 없음
    } catch (error) {
      console.error('보상 지급 중 오류:', error);
      return null;
    }
  }

  // 96시간 쿨다운 기반 현재 진행 상황 표시
  async function updateProgressDisplay() {
    try {
      // 96시간 쿨다운이 끝난 문제들만 카운트 (쿨다운이 적용되지 않은 문제들)
      const allQuestionLastCorrectTimes = await window.firebaseData?.getAllQuestionLastCorrectTimes?.() || {};
      const now = new Date();
      const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
      
      // 96시간이 지난 문제들만 카운트 (쿨다운이 끝난 문제들)
      const eligibleQuestions = Object.entries(allQuestionLastCorrectTimes).filter(([questionId, lastCorrectTime]) => {
        if (!lastCorrectTime) return false;
        const lastCorrectDate = lastCorrectTime.toDate ? lastCorrectTime.toDate() : new Date(lastCorrectTime);
        const timeDiff = now.getTime() - lastCorrectDate.getTime();
        // 96시간이 지난 문제들만 카운트 (쿨다운이 끝난 문제들)
        return timeDiff >= cooldownMs;
      }).map(([questionId]) => questionId);
      
      const currentCorrectCount = eligibleQuestions.length;
      
      // 진행 상황 계산
      const progress = currentCorrectCount % DAILY_QUESTIONS_FOR_COIN;
      const nextRewardAt = DAILY_QUESTIONS_FOR_COIN - progress;
      
      // 진행 상황 표시 업데이트
      const progressElement = document.getElementById('progressDisplay');
      if (progressElement) {
        progressElement.innerHTML = `
          <div class="progress-info">
            <span class="progress-text">정답 진행: ${currentCorrectCount}문항 / 목표: ${DAILY_QUESTIONS_FOR_COIN}문항 (96시간 쿨다운 적용)</span>
            <span class="progress-bar">
              <span class="progress-fill" style="width: ${(progress / DAILY_QUESTIONS_FOR_COIN) * 100}%"></span>
            </span>
            <span class="next-reward">다음 코인까지: ${nextRewardAt}문항</span>
          </div>
        `;
      }
      
      return { currentCorrectCount, nextRewardAt };
    } catch (error) {
      console.error('진행 상황 표시 업데이트 중 오류:', error);
      return { currentCorrectCount: 0, nextRewardAt: DAILY_QUESTIONS_FOR_COIN };
    }
  }

  // 유틸
  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }





  function buildHierarchy(data) {
    // 과목 -> 대분류 -> 중분류 -> 소분류 -> 문항들
    // 입력 데이터는 같은 키를 가진 평면 배열이므로, 선택값 기반으로 필터링만 수행
    return {
      subjects: Array.from(new Set(data.map(x => x['과목']))).sort(),
      getCategories: subject =>
        Array.from(new Set(data.filter(x => x['과목'] === subject).map(x => x['대분류']))).sort(),
      getSubcategories: (subject, category) =>
        Array.from(new Set(
          data.filter(x => x['과목'] === subject && x['대분류'] === category)
              .map(x => x['중분류'])
        )).sort(),
      getTopics: (subject, category, subcategory) =>
        Array.from(new Set(
          data.filter(x => x['과목'] === subject && x['대분류'] === category && x['중분류'] === subcategory)
              .map(x => x['소분류'])
        )).sort(),
      getQuestions: (subject, category, subcategory, topic) => {
        const bucket = data.find(x => x['과목'] === subject && x['대분류'] === category && x['중분류'] === subcategory && x['소분류'] === topic);
        if (!bucket) return [];
        return Array.isArray(bucket['문항들']) ? bucket['문항들'] : [];
      }
    };
  }

  function option(el, value, label) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    el.appendChild(opt);
  }

  function clearSelect(el, placeholder = '선택') {
    el.innerHTML = '';
    option(el, '', placeholder);
    el.selectedIndex = 0;
  }

  function setDisabled(el, disabled) {
    el.disabled = !!disabled;
  }

  async function loadData() {
    // gsg/questions.json 사용
    const res = await fetch('questions.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('문항 데이터를 불러오지 못했습니다.');
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('문항 데이터 형식이 올바르지 않습니다.');
    return json;
  }

  function populateSubjects(h) {
    clearSelect($subject, '과목 선택');
    h.subjects.forEach(s => option($subject, s, s));
    setDisabled($category, true);
    setDisabled($subcategory, true);
    setDisabled($topic, true);
    setDisabled($question, true);
  }

  function handleSubjectChange(h) {
    const subject = $subject.value;
    clearSelect($category, '대분류 선택');
    clearSelect($subcategory, '중분류 선택');
    clearSelect($topic, '소분류 선택');
    clearSelect($question, '개별 문제 선택');
    if (!subject) {
      setDisabled($category, true);
      setDisabled($subcategory, true);
      setDisabled($topic, true);
      setDisabled($question, true);
      return;
    }
    const cats = h.getCategories(subject);
    cats.forEach(c => option($category, c, c));
    setDisabled($category, false);
    setDisabled($subcategory, true);
    setDisabled($topic, true);
    setDisabled($question, true);
  }

  function handleCategoryChange(h) {
    const subject = $subject.value;
    const category = $category.value;
    clearSelect($subcategory, '중분류 선택');
    clearSelect($topic, '소분류 선택');
    clearSelect($question, '개별 문제 선택');
    if (!category) {
      setDisabled($subcategory, true);
      setDisabled($topic, true);
      setDisabled($question, true);
      return;
    }
    const subs = h.getSubcategories(subject, category);
    subs.forEach(s => option($subcategory, s, s));
    setDisabled($subcategory, false);
    setDisabled($topic, true);
    setDisabled($question, true);
  }

  function handleSubcategoryChange(h) {
    const subject = $subject.value;
    const category = $category.value;
    const sub = $subcategory.value;
    clearSelect($topic, '소분류 선택');
    clearSelect($question, '개별 문제 선택');
    if (!sub) {
      setDisabled($topic, true);
      setDisabled($question, true);
      return;
    }
    const topics = h.getTopics(subject, category, sub);
    topics.forEach(t => option($topic, t, t));
    setDisabled($topic, false);
    setDisabled($question, true);
  }

  function handleTopicChange(h) {
    const subject = $subject.value;
    const category = $category.value;
    const sub = $subcategory.value;
    const topic = $topic.value;
    clearSelect($question, '개별 문제 선택');
    if (!topic) {
      setDisabled($question, true);
      return;
    }
    const qs = h.getQuestions(subject, category, sub, topic);
    // 개별 문제 선택 시 난이도 함께 표기 예: 20220621(♥♥♥♥♥)
    qs.forEach((q, idx) => {
      const id = q['문항번호'] || `Q${idx + 1}`;
      const diff = q['난이도'] || '';
      const label = `${id}`; // 이미 (♥...) 포함됨
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = label;
      // 실제 객체를 참조하기 위해 data-*에 인덱스 저장
      opt.dataset.index = String(idx);
      $question.appendChild(opt);
    });
    // 해당 토픽의 질문 리스트를 state에 캐싱
    $question.dataset.cache = JSON.stringify(qs);
    setDisabled($question, false);
  }

  function applyDeepLink(h) {
    const p = new URLSearchParams(location.search);
    const subject = p.get('subject');
    const cat = p.get('cat');
    const sub = p.get('sub');
    const topic = p.get('topic');
    const qid = p.get('qid');
    if (!subject && !qid) return;
    // 과목
    if (subject) {
      $subject.value = subject;
      handleSubjectChange(h);
      if (cat) {
        $category.value = cat;
        handleCategoryChange(h);
      }
      if (sub) {
        $subcategory.value = sub;
        handleSubcategoryChange(h);
      }
      if (topic) {
        $topic.value = topic;
        handleTopicChange(h);
        if (qid) {
          const match = Array.from($question.options).find(o => o.value === qid);
          if (match) {
            $question.value = qid;
            selectQuestionFromDropdown();
            return;
          }
        }
      }
    }

    // Fallback: qid만으로 역추적하여 드롭다운 자동 설정
    if (qid) {
      let found = null;
      let bucketMeta = null;
      for (const bucket of dataset) {
        const list = bucket['문항들'] || [];
        const hit = list.find(q => q['문항번호'] === qid);
        if (hit) { found = hit; bucketMeta = bucket; break; }
      }
      if (found && bucketMeta) {
        $subject.value = bucketMeta['과목'];
        handleSubjectChange(h);
        $category.value = bucketMeta['대분류'];
        handleCategoryChange(h);
        $subcategory.value = bucketMeta['중분류'];
        handleSubcategoryChange(h);
        $topic.value = bucketMeta['소분류'];
        handleTopicChange(h);
        const match = Array.from($question.options).find(o => o.value === qid);
        if (match) {
          $question.value = qid;
          selectQuestionFromDropdown();
        }
      }
    }
  }

  async function selectQuestionFromDropdown() {
    const selectedValue = $question.value;
    const cache = JSON.parse($question.dataset.cache || '[]');
    const idxAttr = $question.options[$question.selectedIndex]?.dataset?.index;
    let qObj = null;
    if (idxAttr != null) {
      const idx = Number(idxAttr);
      if (!Number.isNaN(idx)) qObj = cache[idx];
    }
    if (!qObj) qObj = cache.find(x => x['문항번호'] === selectedValue) || null;
    if (!qObj) {
      $questionArea.hidden = true;
      currentQuestion = null;
      return;
    }
    currentQuestion = {
      id: qObj['문항번호'],
      img: qObj['문항주소'],
      answer: String(qObj['정답']).trim(),
      difficulty: qObj['난이도'] || '',
      solution: qObj['해설주소'] || ''
    };
    renderQuestion();
    
    // 노트 초기화
    resetNote();
    
    // 문제 풀이 기록 조회 및 표시
    try {
      const history = await getQuestionHistory(currentQuestion.id);
      updateQuestionHistoryUI(history);
    } catch (error) {
      console.error('문제 풀이 기록 조회 실패:', error);
    }
    
    // 진행 상황 업데이트
    try {
      await updateProgressDisplay();
    } catch (error) {
      console.error('진행 상황 업데이트 실패:', error);
    }
    
    // 쿨다운 상태 업데이트
    try {
      await updateCooldownDisplay(currentQuestion.id);
      
      // 테스트용: 쿨다운 표시가 제대로 작동하는지 확인
      const cooldownElement = document.getElementById('cooldownDisplay');
      if (cooldownElement) {
        console.log('쿨다운 요소 존재:', cooldownElement.style.display);
      }
    } catch (error) {
      console.error('쿨다운 상태 업데이트 실패:', error);
    }
  }

  function renderQuestion() {
    if (!currentQuestion) {
      $questionArea.hidden = true;
      return;
    }
    $questionArea.hidden = false;
    $qn.textContent = currentQuestion.id || '';
    $diff.textContent = currentQuestion.difficulty || '-';
    // 이미지 경로 해석: questions.json의 'mun/..'은 gsg/mun을 참조
    const rawPath = currentQuestion.img || '';
    const normalized = rawPath.replace(/^\.\//, '');
    const resolved = /^https?:\/\//i.test(normalized)
      ? normalized
      : normalized; // 예: 'mun/20220621.png' → 현재 문서 상대경로(gsg/mun/...)
    $img.onerror = () => {
      $img.alt = '문제 이미지를 불러오지 못했습니다.';
    };
    $img.src = resolved;
    $img.alt = `${currentQuestion.id} 문제 이미지`;
    // 해설 링크는 정답 제출 후에만 노출
    $solutionLink.removeAttribute('href');
    $solutionLink.style.display = 'none';
    $feedback.textContent = '';
    $answerInput.value = '';
    $answerInput.focus();
    
    // 문제 풀이 기록 영역 초기화
    if ($questionHistory) {
      $questionHistory.innerHTML = '<p class="history-info">풀이 기록을 불러오는 중...</p>';
    }

    // 즐겨찾기 상태 반영(Firebase)
    (async () => {
      try {
        const favs = new Set(await window.firebaseData?.listFavorites?.());
        const on = favs.has(currentQuestion.id);
        $favToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
        const icon = $favToggle.querySelector('.fav-icon');
        const label = $favToggle.querySelector('.fav-label');
        if (icon) icon.textContent = on ? '★' : '☆';
        if (label) label.textContent = on ? '즐겨찾기 삭제' : '즐겨찾기 추가';
      } catch (_) {}
    })();
  }

  async function handleSubmitAnswer(evt) {
    evt.preventDefault();
    if (!currentQuestion) return;
    const userAns = ($answerInput.value || '').trim();
    if (userAns.length === 0) {
      $feedback.textContent = '정답을 입력해 주세요.';
      return;
    }

    const isCorrect = userAns === currentQuestion.answer;
    if (isCorrect) {
      $feedback.textContent = '축하해요. 정답입니다! 🎉';
    } else {
      $feedback.textContent = `아쉬워요. 오답입니다! 😭 정답은 ${currentQuestion.answer} 입니다.`;
    }

    // 오답 수집(Firebase)
    if (!isCorrect) {
      try { await window.firebaseData?.addWrong?.(currentQuestion.id); } catch (_) {}
    }

    // 학습 로그 기록(과목 기준)
    const subj = $subject.value || '';
    const cat = $category.value || null;
    const sub = $subcategory.value || null;
    const topic = $topic.value || null;
    // Firebase에만 기록
    try { await window.firebaseData?.addLearningLog({ date: todayKey(), subject: subj, cat, sub, topic, correct: isCorrect ? 1 : 0, total: 1 }); } catch (_) {}
    try { await window.firebaseData?.addAnsweredLog({ date: todayKey(), qid: currentQuestion.id }); } catch (_) {}

    // 하루 정답 문제 보상 체크 (새로운 정답인 경우에만)
    const rewardMessage = await trackDailyQuestionsAndReward(currentQuestion.id, isCorrect);
    
    // 진행 상황 업데이트
    await updateProgressDisplay();
    
    // 쿨다운 상태 업데이트
    await updateCooldownDisplay(currentQuestion.id);

    // 최종 제출 답안을 answers/{qid}로 저장(과목 필터 정확도를 위해 메타 포함)
    try {
      await window.firebaseData?.setFinalAnswer?.(currentQuestion.id, {
        subject: subj, cat, sub, topic,
        correct: isCorrect, date: todayKey(),
      });
    } catch (_) {}

    // 정답 여부와 무관하게 해설 링크 노출(있을 때만)
    if (currentQuestion.solution) {
      $solutionLink.href = currentQuestion.solution;
      $solutionLink.style.display = '';
    }
  }

  function wireEvents(h) {
    $subject.addEventListener('change', () => handleSubjectChange(h));
    $category.addEventListener('change', () => handleCategoryChange(h));
    $subcategory.addEventListener('change', () => handleSubcategoryChange(h));
    $topic.addEventListener('change', () => handleTopicChange(h));
    $question.addEventListener('change', selectQuestionFromDropdown);
    $answerForm.addEventListener('submit', handleSubmitAnswer);
    $favToggle.addEventListener('click', async () => {
      if (!currentQuestion) return;
      const isOn = $favToggle.getAttribute('aria-pressed') === 'true';
      // 낙관적 UI 적용
      const iconEl = $favToggle.querySelector('.fav-icon');
      const labelEl = $favToggle.querySelector('.fav-label');
      const prevIcon = iconEl ? iconEl.textContent : '';
      const prevLabel = labelEl ? labelEl.textContent : '';
      const prevPressed = $favToggle.getAttribute('aria-pressed');
      const next = !isOn;
      $favToggle.setAttribute('aria-pressed', next ? 'true' : 'false');
      if (iconEl) iconEl.textContent = next ? '★' : '☆';
      if (labelEl) labelEl.textContent = next ? '즐겨찾기 삭제' : '즐겨찾기 추가';
      let ok = false;
      try {
        ok = isOn
          ? await window.firebaseData?.removeFavorite?.(currentQuestion.id)
          : await window.firebaseData?.addFavorite?.(currentQuestion.id);
      } catch (_) { ok = false; }
      if (!ok) {
        // 실패 시 롤백
        $favToggle.setAttribute('aria-pressed', prevPressed || 'false');
        if (iconEl) iconEl.textContent = prevIcon || '☆';
        if (labelEl) labelEl.textContent = prevLabel || '즐겨찾기 추가';
        toast('즐겨찾기 동기화에 실패했습니다. 로그인 상태를 확인하거나 잠시 후 다시 시도해 주세요.', 'error');
      } else {
        toast(next ? '즐겨찾기에 추가했어요.' : '즐겨찾기를 삭제했어요.', 'success');
      }
    });
  }

  // 초기화
  (async function init() {
    try {
      dataset = await loadData();
      const h = buildHierarchy(dataset);
      populateSubjects(h);
      wireEvents(h);
      applyDeepLink(h);
      
      // 초기 진행 상황 표시
      try {
        await updateProgressDisplay();
      } catch (error) {
        console.error('초기 진행 상황 표시 실패:', error);
      }
    } catch (err) {
      console.error(err);
      alert('문제 데이터를 불러오는 중 오류가 발생했습니다. 새로고침 후 다시 시도해 주세요.');
    }
  })();
})();


