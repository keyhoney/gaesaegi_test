(function(){
  'use strict';

  const $ = (id)=>document.getElementById(id);
  const toast = (m,t)=>{ try{ window.showToast && window.showToast(m,t);}catch{} };

  async function ensureFirebase(){
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, getDocs, query, where, orderBy, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const cfg = await window.loadFirebaseConfig?.();
    const app = initializeApp(cfg);
    const db = getFirestore(app);
    const auth = getAuth(app);
    return { db, auth, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, getDocs, query, where, orderBy, serverTimestamp };
  }

  function rowItem(f){
    const when = f.createdAt?.toDate ? new Intl.DateTimeFormat('ko-KR',{dateStyle:'short', timeStyle:'short'}).format(f.createdAt.toDate()) : '';
    const cat = f.category || '-'; const status = f.status || 'open';
    return `<div class="row"><div class="line top"><div class="meta">${f.title||'(제목 없음)'}</div></div><div class="line bottom"><div class="id">${cat} · ${status}</div><div class="diff">${when}</div><div class="actions"><button class="btn small" data-open="${f.id}">열기</button></div></div></div>`;
  }

  let myUid = null; let isAdmin = false; let currentId = null;

  async function checkAdmin(){
    try {
      const uid = await window.firebaseData?.getCurrentUserUid?.(); if (!uid) return false;
      const { db, doc, getDoc } = await ensureFirebase();
      const r = doc(db,'admins', uid); const s = await getDoc(r); return s.exists();
    } catch { return false; }
  }

  async function postFeedback(){
    const title = $('fbTitle').value.trim(); const body = $('fbBody').value.trim(); const category = $('fbCategory').value||'bug';
    const msg = $('fbMsg'); msg.textContent='';
    try {
      const uid = await window.firebaseData?.getCurrentUserUid?.(); if (!uid) { msg.textContent='로그인이 필요합니다.'; return; }
      if (!body) { msg.textContent='설명을 입력해 주세요.'; return; }
      const { db, collection, addDoc, serverTimestamp } = await ensureFirebase();
      await addDoc(collection(db,'feedback'), { uid, title: title||null, body, category, status:'open', createdAt: serverTimestamp() });
      $('fbTitle').value=''; $('fbBody').value='';
      toast('피드백이 등록되었습니다.','success');
      loadList();
    } catch { msg.textContent='등록에 실패했습니다.'; }
  }

  async function loadList(){
    const box = $('feedbackList');
    try {
      const { db, collection, getDocs, query, orderBy } = await ensureFirebase();
      const snap = await getDocs(query(collection(db,'feedback'), orderBy('createdAt','desc')));
      const list = snap.docs.map(d=>({ id:d.id, ...(d.data()||{}) }));
      const text = ($('searchBox').value||'').trim().toLowerCase();
      const fcat = $('filterCategory').value||''; const fstat = $('filterStatus').value||'';
      const view = list.filter(f=>{
        const hay = `${f.title||''} ${f.body||''}`.toLowerCase();
        if (text && !hay.includes(text)) return false;
        if (fcat && f.category !== fcat) return false;
        if (fstat && (f.status||'open') !== fstat) return false;
        return true;
      });
      box.innerHTML = view.map(rowItem).join('') || '피드백이 없습니다.';
      box.querySelectorAll('[data-open]').forEach(btn=>btn.addEventListener('click', ()=> openDetail(btn.getAttribute('data-open'))));
    } catch { box.textContent='목록을 불러오지 못했습니다.'; }
  }

  async function openDetail(fid){
    currentId = fid; const card = $('detailCard'); card.hidden = false; $('replies').innerHTML='';
    const { db, doc, getDoc, collection, getDocs, query, orderBy } = await ensureFirebase();
    const r = doc(db,'feedback', fid); const s = await getDoc(r); if (!s.exists()) { card.hidden=true; return; }
    const d = { id: fid, ...(s.data()||{}) };
    $('dTitle').textContent = d.title || '(제목 없음)';
    $('dBody').textContent = d.body || '';
    $('dStatus').textContent = `상태: ${d.status||'open'} · 카테고리: ${d.category||'-'}`;
    const adminBox = $('adminActions');
    adminBox.innerHTML = '';
    $('replyForm').hidden = !isAdmin;
    if (isAdmin) {
      adminBox.innerHTML = `<button class="btn small" data-status="open">접수</button><button class="btn small" data-status="answered">응답</button><button class="btn small" data-status="resolved">해결</button>`;
      adminBox.querySelectorAll('[data-status]').forEach(btn=>btn.addEventListener('click', ()=> setStatus(btn.getAttribute('data-status'))));
    }
    const rs = await getDocs(query(collection(db,'feedback', fid, 'replies'), orderBy('createdAt','asc')));
    const rows = rs.docs.map(rp=>{ const d=rp.data()||{}; const when = d.createdAt?.toDate ? new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short'}).format(d.createdAt.toDate()):''; return `<div class="row"><div class="line top"><div class="meta">관리자</div></div><div class="line bottom"><div class="id">${d.body||''}</div><div class="diff">${when}</div></div></div>`; });
    $('replies').innerHTML = rows.join('') || '아직 응답이 없습니다.';
  }

  async function setStatus(status){
    try {
      const { db, doc, updateDoc } = await ensureFirebase();
      await updateDoc(doc(db,'feedback', currentId), { status });
      openDetail(currentId);
    } catch { toast('상태 업데이트 실패','error'); }
  }

  async function submitReply(e){
    e.preventDefault(); const msg = $('replyMsg'); msg.textContent='';
    try {
      if (!isAdmin) { msg.textContent='관리자만 작성할 수 있습니다.'; return; }
      const body = $('replyInput').value.trim(); if (!body) return;
      const { db, collection, addDoc, serverTimestamp } = await ensureFirebase();
      await addDoc(collection(db,'feedback', currentId, 'replies'), { body, createdAt: serverTimestamp() });
      $('replyInput').value=''; toast('등록되었습니다.','success'); openDetail(currentId);
    } catch { msg.textContent='등록에 실패했습니다.'; }
  }

  window.addEventListener('load', async ()=>{
    try { myUid = await window.firebaseData?.getCurrentUserUid?.(); } catch {}
    isAdmin = await checkAdmin();
    $('postFeedback').addEventListener('click', postFeedback);
    $('replyForm').addEventListener('submit', submitReply);
    $('searchBox').addEventListener('input', loadList);
    $('filterCategory').addEventListener('change', loadList);
    $('filterStatus').addEventListener('change', loadList);
    loadList();
  });
})();


