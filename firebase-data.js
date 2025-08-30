// Firebase read/write helpers for learning logs
(async function () {
  'use strict';

  // 서버 시각 오프셋 캐시(세션 단위)
  let __serverOffsetMs = null; // serverNow - clientNow
  let __serverOffsetFetchedAtMs = 0;
  const __SERVER_OFFSET_TTL_MS = 6 * 60 * 60 * 1000; // 6시간

  async function ensureFirebase() {
    if (!(location.protocol === 'http:' || location.protocol === 'https:')) {
      throw new Error('Firebase requires http/https context');
    }
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const { collection, addDoc, writeBatch, doc, serverTimestamp, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const { app, db } = await window.getFirebaseAppAndDb();
    const auth = getAuth(app);
    return { auth, db, collection, addDoc, writeBatch, doc, serverTimestamp, getDocs, query, orderBy };
  }

  async function withUser() {
    const { auth, db, ...rest } = await ensureFirebase();
    let user = auth.currentUser;
    if (!user) {
      try {
        const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        user = await new Promise((resolve) => {
          const timeoutId = setTimeout(() => { try { unsub(); } catch {} resolve(null); }, 7000);
          const unsub = onAuthStateChanged(auth, (u) => { clearTimeout(timeoutId); try { unsub(); } catch {} resolve(u); });
        });
      } catch (_) { user = null; }
    }
    if (!user) throw new Error('Not authenticated');
    return { user, db, ...rest };
  }

  async function addLearningLog(log) {
    try {
      const { user, db, collection, addDoc, serverTimestamp } = await withUser();
      await addDoc(collection(db, 'users', user.uid, 'learningLogs'), { ...log, ts: serverTimestamp() });
      return true;
    } catch (_) { return false; }
  }

  async function addManyLearningLogs(logs) {
    try {
      const { user, db, writeBatch, doc, serverTimestamp } = await withUser();
      const batch = writeBatch(db);
      logs.forEach((l) => {
        const ref = doc(db, 'users', user.uid, 'learningLogs', crypto.randomUUID());
        batch.set(ref, { ...l, ts: serverTimestamp() });
      });
      await batch.commit();
      return true;
    } catch (_) { return false; }
  }

  async function addAnsweredLog(entry) {
    try {
      const { user, db, collection, addDoc, serverTimestamp } = await withUser();
      await addDoc(collection(db, 'users', user.uid, 'answeredLogs'), { ...entry, ts: serverTimestamp() });
      return true;
    } catch (_) { return false; }
  }

  async function addManyAnsweredLogs(entries) {
    try {
      const { user, db, writeBatch, doc, serverTimestamp } = await withUser();
      const batch = writeBatch(db);
      entries.forEach((e) => {
        const ref = doc(db, 'users', user.uid, 'answeredLogs', crypto.randomUUID());
        batch.set(ref, { ...e, ts: serverTimestamp() });
      });
      await batch.commit();
      return true;
    } catch (_) { return false; }
  }

  async function fetchLearningLogs() {
    try {
      const { user, db, collection, getDocs, query, orderBy } = await withUser();
      const snap = await getDocs(query(collection(db, 'users', user.uid, 'learningLogs'), orderBy('ts')));
      return snap.docs.map(d => d.data());
    } catch (_) { return []; }
  }

  async function fetchAnsweredLogs() {
    try {
      const { user, db, collection, getDocs, query, orderBy } = await withUser();
      const snap = await getDocs(query(collection(db, 'users', user.uid, 'answeredLogs'), orderBy('ts')));
      return snap.docs.map(d => d.data());
    } catch (_) { return []; }
  }



  async function getSubmissionAt(qid) {
    try {
      const { user, db } = await withUser();
      const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const ref = doc(db, 'users', user.uid, 'submissions', qid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const d = snap.data().lastAt;
      return d?.toDate ? d.toDate() : (d ? new Date(d) : null);
    } catch (_) { return null; }
  }

  async function setSubmissionNow(qid) {
    try {
      const { user, db } = await withUser();
      const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const ref = doc(db, 'users', user.uid, 'submissions', qid);
      await setDoc(ref, { lastAt: serverTimestamp() }, { merge: true });
      return true;
    } catch (_) { return false; }
  }



  window.firebaseData = {
    async getCurrentUserUid() {
      try {
        const { auth } = await ensureFirebase();
        if (auth.currentUser) return auth.currentUser.uid;
        try {
          const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
          return await new Promise((resolve) => {
            const timeoutId = setTimeout(() => { try { unsub(); } catch {} resolve(null); }, 3000);
            const unsub = onAuthStateChanged(auth, (u) => { clearTimeout(timeoutId); try { unsub(); } catch {} resolve(u ? u.uid : null); });
          });
        } catch (_) { return null; }
      } catch (_) { return null; }
    },
    async isAuthenticated() {
      return !!(await this.getCurrentUserUid());
    },
    // 로컬 클럭 기반(Asia/Seoul) 날짜키. 거래/비핵심 로직은 이 키 사용 권장
    getLocalDateSeoulKey() {
      try {
        const jsDate = new Date();
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
        return fmt.format(jsDate); // YYYY-MM-DD
      } catch { return null; }
    },
    addLearningLog,
    addManyLearningLogs,
    addAnsweredLog,
    addManyAnsweredLogs,
    fetchLearningLogs,
    fetchAnsweredLogs,

    getSubmissionAt,
    setSubmissionNow,
    // 최종 제출 답안 저장(문항별 1문서)
    async setFinalAnswer(qid, payload) {
      try {
        const { user, db } = await withUser();
        const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const { subject, cat, sub, topic, correct, date } = payload || {};
        const ref = doc(db, 'users', user.uid, 'answers', qid);
        await setDoc(ref, { subject: subject||null, cat: cat||null, sub: sub||null, topic: topic||null, correct: !!correct, date: date||null, ts: serverTimestamp() }, { merge: true });
        return true;
      } catch (_) { return false; }
    },




    async listFinalAnswers() {
      try {
        const { user, db, collection, getDocs } = await withUser();
        const snap = await getDocs(collection(db, 'users', user.uid, 'answers'));
        return snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
      } catch (_) { return []; }
    },


    async getServerDateSeoulKey() {
      try {
        const nowMs = Date.now();
        if (__serverOffsetMs !== null && (nowMs - __serverOffsetFetchedAtMs) < __SERVER_OFFSET_TTL_MS) {
          const jsDate = new Date(nowMs + __serverOffsetMs);
          const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
          return fmt.format(jsDate);
        }
        const { user, db } = await withUser();
        const { doc, setDoc, getDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'time', 'now');
        await setDoc(ref, { at: serverTimestamp() }, { merge: true });
        const snap = await getDoc(ref);
        const at = snap.data()?.at;
        const serverJs = at?.toDate ? at.toDate() : new Date();
        __serverOffsetMs = serverJs.getTime() - nowMs;
        __serverOffsetFetchedAtMs = nowMs;
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
        return fmt.format(serverJs);
      } catch (_) {
        try {
          const jsDate = new Date();
          const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
          return fmt.format(jsDate);
        } catch { return null; }
      }
    },
    async getDateKeyPreferServer() {
      const k = await this.getServerDateSeoulKey();
      if (k) return k;
      return this.getLocalDateSeoulKey();
    },

    async markLogin(dateKey) {
      try {
        const { user, db } = await withUser();
        const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'logins', dateKey);
        await setDoc(ref, { at: serverTimestamp() }, { merge: true });
        return true;
      } catch (_) { return false; }
    },
    async listLoginDates() {
      try {
        const { user, db, collection, getDocs } = await withUser();
        const snap = await getDocs(collection(db, 'users', user.uid, 'logins'));
        return snap.docs.map(d => d.id);
      } catch (_) { return []; }
    },
    // ===== User Profile =====
    async getMyProfile() {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'profile', 'main');
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data() : null;
      } catch (_) { return null; }
    },
    async saveMyProfile(profile) {
      try {
        const { user, db } = await withUser();
        const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'profile', 'main');
        await setDoc(ref, { ...profile, updatedAt: serverTimestamp() }, { merge: true });
        return true;
      } catch (_) { return false; }
    },






























    // Favorites
    async listFavorites() {
      try {
        const { user, db, collection, getDocs } = await withUser();
        const snap = await getDocs(collection(db, 'users', user.uid, 'favorites'));
        return snap.docs.map(d => d.id);
      } catch (_) { return []; }
    },
    async addFavorite(qid) {
      try {
        const { user, db } = await withUser();
        const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await setDoc(doc(db, 'users', user.uid, 'favorites', qid), { ts: serverTimestamp() }, { merge: true });
        return true;
      } catch (_) { return false; }
    },
    async removeFavorite(qid) {
      try {
        const { user, db } = await withUser();
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await deleteDoc(doc(db, 'users', user.uid, 'favorites', qid));
        return true;
      } catch (_) { return false; }
    },
    // Wrongs
    async listWrongs() {
      try {
        const { user, db, collection, getDocs } = await withUser();
        const snap = await getDocs(collection(db, 'users', user.uid, 'wrongs'));
        return snap.docs.map(d => d.id);
      } catch (_) { return []; }
    },
    async addWrong(qid) {
      try {
        const { user, db } = await withUser();
        const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await setDoc(doc(db, 'users', user.uid, 'wrongs', qid), { ts: serverTimestamp() }, { merge: true });
        return true;
      } catch (_) { return false; }
    },
    async removeWrong(qid) {
      try {
        const { user, db } = await withUser();
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await deleteDoc(doc(db, 'users', user.uid, 'wrongs', qid));
        return true;
      } catch (_) { return false; }
    },

    // ===== Wallet (coins) =====
    async getWallet() {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'wallet', 'main');
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data() : { coins: 0, totalCoins: 0 };
      } catch (_) { return { coins: 0, totalCoins: 0 }; }
    },
    async addCoins(numCoins) {
      try {
        if (!Number.isFinite(numCoins) || numCoins === 0) return { applied: 0 };
        const { user, db } = await withUser();
        const { doc, setDoc, increment, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'wallet', 'main');
        await setDoc(ref, { coins: increment(numCoins), totalCoins: numCoins>0? increment(numCoins): increment(0), updatedAt: serverTimestamp() }, { merge: true });
        return { applied: numCoins };
      } catch (_) { return { applied: 0 }; }
    },
    async adjustCoins(delta, reason) {
      try {
        if (!Number.isFinite(delta) || delta === 0) return { ok: false };
        const { user, db } = await withUser();
        const { doc, runTransaction, serverTimestamp, collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'wallet', 'main');
        const res = await runTransaction(db, async (trx) => {
          const snap = await trx.get(ref);
          const cur = snap.exists() ? (snap.data().coins||0) : 0;
          if (delta < 0 && cur + delta < 0) throw new Error('insufficient-coins');
          trx.set(ref, { coins: (cur + delta), updatedAt: serverTimestamp() }, { merge: true });
          return true;
        });
        try { await addDoc(collection(db, 'users', user.uid, 'transactions'), { type: 'coin', amount: delta, reason: reason||null, at: serverTimestamp() }); } catch {}
        return { ok: true };
      } catch (e) { return { ok: false, error: String(e&&e.message||e) }; }
    },

    // ===== Lottery =====
    async lotteryBuyTicket(pick6) {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc, setDoc, addDoc, collection, runTransaction, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        if (!Array.isArray(pick6) || pick6.length!==6) return { ok:false, error:'invalid-pick' };
        // balance check
        const w = await this.getWallet();
        if (Number(w.coins||0) < 1) return { ok:false, error:'insufficient-coins' };
        const key = await this.getServerDateSeoulKey();
        // deduct 1 coin
        await this.adjustCoins(-1, 'lottery:buy');
        let drawNums, drawBonus, hit, rank;
        let attempts = 0;
        const maxAttempts = 100; // 무한 루프 방지
        
        do {
          const pool = Array.from({length:15},(_,i)=>i+1);
          for (let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
          drawNums = pool.slice(0,6).sort((a,b)=>a-b);
          drawBonus = pool[6];
          const ticketNums = pick6.slice().sort((a,b)=>a-b);
          // evaluate rank
          hit = ticketNums.filter(n => drawNums.includes(n)).length;
          rank = null;
          if (hit===6) rank = 1;
          else if (hit===5 && drawBonus && ticketNums.includes(drawBonus)) rank = 2;
          else if (hit===5) rank = 3;
          else if (hit===4) rank = 4;
          else if (hit===3) rank = 5;
          
          attempts++;
        } while ((rank === 1 || rank === 2) && attempts < maxAttempts);
        
        if (attempts >= maxAttempts && (rank === 1 || rank === 2)) {
          rank = 3;
        }
        const ticket = { uid: user.uid, drawDate: key, nums: ticketNums, drawNums, drawBonus, hitCount: hit, rank, at: serverTimestamp() };
        // 사용자 티켓 기록은 필수
        await addDoc(collection(db, 'users', user.uid, 'lotteryTickets'), ticket);
        // 공개 티켓/통계는 권한 문제로 실패해도 구매는 성공 처리
        try { await addDoc(collection(db, 'lottery', 'tickets'), ticket); } catch {}
        try {
          const statsRef = doc(db, 'lottery', 'public', 'stats', 'main');
          await runTransaction(db, async (trx)=>{
            const s = await trx.get(statsRef);
            const cur = s.exists()? s.data() : { totalTickets:0, w1:0,w2:0,w3:0,w4:0,w5:0 };
            const next = { ...cur, totalTickets: (cur.totalTickets||0)+1 };
            if (rank) next[`w${rank}`] = (cur[`w${rank}`]||0) + 1;
            trx.set(statsRef, next, { merge: true });
          });
        } catch {}
        return { ok:true, rank, hit, drawNums, drawBonus, drawDate: key };
      } catch (e) { return { ok:false, error:String(e&&e.message||e) }; }
    },
    async lotteryGetLatestResult(){
      try {
        const { user, db } = await withUser();
        const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = collection(db, 'users', user.uid, 'lotteryTickets');
        const q = query(ref, orderBy('at','desc'), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return { ok:true };
        const d = snap.docs[0].data()||{};
        return { ok:true, drawDate: d.drawDate, nums: d.nums||[], drawNums: d.drawNums||[], drawBonus: d.drawBonus||null, hitCount: d.hitCount||0, rank: d.rank||null };
      } catch (e) { return { ok:false, error:String(e&&e.message||e) }; }
    },
    async lotteryListMyTickets(limitN=30){
      try {
        const { user, db } = await withUser();
        const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = collection(db, 'users', user.uid, 'lotteryTickets');
        const q = query(ref, orderBy('at','desc'), limit(limitN));
        const snap = await getDocs(q);
        return snap.docs.map(d=>({ id:d.id, ...(d.data()||{}) }));
      } catch (_) { return []; }
    },
    async lotteryStats(){
      try {
        const { user, db } = await withUser();
        const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = collection(db, 'users', user.uid, 'lotteryTickets');
        const q = query(ref, orderBy('at', 'desc'));
        const snap = await getDocs(q);
        const tickets = snap.docs.map(d => d.data());
        
        // 개인 통계 계산
        const stats = { totalTickets: tickets.length, w1: 0, w2: 0, w3: 0, w4: 0, w5: 0 };
        tickets.forEach(ticket => {
          const rank = Number(ticket.rank || 0);
          if (rank >= 1 && rank <= 5) {
            stats[`w${rank}`]++;
          }
        });
        
        return stats;
      } catch (_) { return { totalTickets:0,w1:0,w2:0,w3:0,w4:0,w5:0 }; }
    },

  };
})();


