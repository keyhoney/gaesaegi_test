(function(){
  'use strict';

  const gridEl = document.getElementById('numberGrid');
  const pickedEl = document.getElementById('picked');
  const coinBalEl = document.getElementById('coinBal');
  const buyBtn = document.getElementById('buyBtn');
  const buyMsg = document.getElementById('buyMsg');
  const autoBtn = document.getElementById('autoPick');
  const clearBtn = document.getElementById('clearPick');
  const drawIdEl = document.getElementById('drawId');
  const drawNumsEl = document.getElementById('drawNums');
  const drawBonusEl = document.getElementById('drawBonus');
  const reloadBtn = document.getElementById('reloadResult');
  const myNumsEl = document.getElementById('myNums');
  const hitCountEl = document.getElementById('hitCount');
  const rankEl = document.getElementById('rank');

  const nums = new Set();

  function renderGrid(){
    const items = [];
    for (let i=1;i<=15;i++){
      const on = nums.has(i);
      items.push(`<button class="lottery-number-btn ${on? 'selected':''}" data-n="${i}">${i}</button>`);
    }
    gridEl.innerHTML = items.join('');
    gridEl.querySelectorAll('[data-n]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const n = Number(btn.getAttribute('data-n'));
        if (nums.has(n)) nums.delete(n); else { if (nums.size>=6) { window.showToast&&window.showToast('최대 6개까지 선택','error'); return; } nums.add(n); }
        renderGrid(); renderPicked();
      });
    });
  }
  function renderPicked(){ pickedEl.textContent = nums.size? Array.from(nums).sort((a,b)=>a-b).join(', '): '-'; }

  async function refreshBalance(){
    try { const w = await window.firebaseData?.getWallet?.(); coinBalEl.textContent = Number(w?.coins||0).toLocaleString(); } catch { coinBalEl.textContent = '0'; }
  }

  function randPick(k=6){
    const pool = Array.from({length:15},(_,i)=>i+1);
    for (let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
    return pool.slice(0,k).sort((a,b)=>a-b);
  }

  async function refreshLatestResult(){
    try {
      const r = await window.firebaseData?.lotteryGetLatestResult?.();
      if (r && r.ok){
        drawIdEl.textContent = r.drawDate || '-';
        drawNumsEl.textContent = (r.drawNums||[]).join(', ');
        drawBonusEl.textContent = r.drawBonus ?? '-';
        myNumsEl.textContent = (r.nums||[]).join(', ');
        hitCountEl.textContent = r.hitCount ?? '-';
        rankEl.textContent = r.rank ? `${r.rank}등` : '-';
      }
    } catch {}
  }

  async function loadMyTickets(){
    const box = document.getElementById('myTickets');
    const list = await window.firebaseData?.lotteryListMyTickets?.(30) || [];
    if (!list.length) { box.textContent = '구매 내역이 없습니다.'; return; }
    const fmt = new Intl.DateTimeFormat('ko-KR',{ dateStyle: 'medium', timeStyle:'short' });
    box.innerHTML = list.map(t=>{
      const hit = (t.hitCount||0);
      const rank = t.rank? `${t.rank}등` : '-';
      const when = fmt.format(t.at?.toDate ? t.at.toDate() : new Date());
      const draw = (t.drawNums||[]).join(', ');
      const bonus = (t.drawBonus==null? '' : ` + ${t.drawBonus}`);
      const mine = (t.nums||[]).join(', ');
      return `<div class="row"><div class="line top"><div class="meta">${when}</div></div><div class="line bottom"><div class="id">당첨 번호및 보너스 번호 : ${draw}${bonus}<br/>내가 응모한 번호 : ${mine}</div><div class="actions"><span class="badge">${rank}</span><span class="badge ghost">${hit}개 일치</span></div></div></div>`;
    }).join('');
  }

  async function loadStats(){
    const box = document.getElementById('stats');
    const card = (title, val) => `<div class="card small"><div class="muted">${title}</div><div class="stat-value">${val}</div></div>`;
    try {
      const s = await window.firebaseData?.lotteryStats?.();
      box.innerHTML = [
        card('총 구매 수', (s?.totalTickets||0).toLocaleString()),
        card('1등', (s?.w1||0)),
        card('2등', (s?.w2||0)),
        card('3등', (s?.w3||0)),
        card('4등', (s?.w4||0)),
        card('5등', (s?.w5||0)),
      ].join('');
    } catch {
      box.innerHTML = [
        card('총 구매 수', '0'), card('1등','0'), card('2등','0'), card('3등','0'), card('4등','0'), card('5등','0')
      ].join('');
    }
  }

  async function buy(){
    buyMsg.textContent='';
    if (nums.size !== 6){ buyMsg.textContent='번호 6개를 선택해 주세요.'; buyMsg.style.color='#c62828'; return; }
    if (!confirm('1코인을 사용하여 로또를 구매할까요?')) return;
    const pick = Array.from(nums).sort((a,b)=>a-b);
    let res = null;
    try { res = await window.firebaseData?.lotteryBuyTicket?.(pick); } catch(e) { res = null; }
    if (!res || res.ok !== true){
      // 실패로 내려와도 서버측에서 구매/차감/기록이 되었을 수 있으므로 즉시 동기화
      await refreshBalance();
      await loadMyTickets();
      await loadStats();
      await refreshLatestResult();
      const err = res?.error || '구매 처리 상태를 확인했습니다.';
      buyMsg.textContent = err==='insufficient-coins' ? '코인이 부족합니다.' : '구매가 처리되었을 수 있어 목록/결과를 갱신했습니다.';
      buyMsg.style.color = err==='insufficient-coins' ? '#c62828' : 'inherit';
      return;
    }
    window.showToast&&window.showToast('구매 완료','success');
    nums.clear(); renderGrid(); renderPicked();
    // 즉시 결과 반영
    try {
      drawIdEl.textContent = res.drawDate || new Date().toLocaleString('ko-KR');
      drawNumsEl.textContent = (res.drawNums||[]).join(', ');
      drawBonusEl.textContent = res.drawBonus ?? '-';
      myNumsEl.textContent = pick.join(', ');
      hitCountEl.textContent = res.hit ?? '-';
      rankEl.textContent = res.rank ? `${res.rank}등` : '-';
    } catch {}
    await refreshBalance(); await loadMyTickets(); await loadStats();
  }

  window.addEventListener('load', async ()=>{
    renderGrid(); renderPicked();
    autoBtn.addEventListener('click', ()=>{ nums.clear(); randPick(6).forEach(n=>nums.add(n)); renderGrid(); renderPicked(); });
    clearBtn.addEventListener('click', ()=>{ nums.clear(); renderGrid(); renderPicked(); });
    buyBtn.addEventListener('click', buy);
    // 구매 즉시 결과 갱신하므로 수동 새로고침 버튼 제거
    await refreshBalance();
    await refreshLatestResult();
    await loadMyTickets();
    await loadStats();
  });
})();


