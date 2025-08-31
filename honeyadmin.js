(function () {
  'use strict';

  // 관리자 UID
  const ADMIN_UID = 'zcaWS7Kl8xSeBoWrVY5w2LpMwsj2';
  
     // 전역 변수
   let currentUserUid = null;
   let allUsers = [];
   let allLotteryTickets = [];
   let allCoinHistory = [];

  // 숫자 포맷팅 함수
  function formatNumber(num) {
    return Number(num || 0).toLocaleString();
  }

  // 날짜 포맷팅 함수
  function formatDate(timestamp) {
    if (!timestamp) return '-';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return '-';
    }
  }

  // 사용자 정보 표시 함수
  function renderUserInfo(user) {
    const className = user.className || user.class || '미분반';
    const studentNumber = user.studentNumber || user.number || user.studentNo || '미번호';
    const name = user.name || user.displayName || user.nickname || '미이름';
    const initials = name.substring(0, 2).toUpperCase();
    
    // 전화번호가 있으면 표시
    const phoneInfo = user.phone ? `<div class="user-phone">${user.phone}</div>` : '';
    
    return `
      <div class="user-info">
        <div class="user-avatar">${initials}</div>
        <div class="user-details">
          <div class="user-name">${name}</div>
          <div class="user-email">${className} ${studentNumber}번</div>
          ${phoneInfo}
        </div>
      </div>
    `;
  }

  // 접근 권한 확인
  async function checkAdminAccess() {
    try {
      console.log('관리자 접근 권한 확인 시작...');
      
      // Firebase 초기화 확인
      if (!window.firebaseData) {
        console.error('firebaseData가 초기화되지 않았습니다.');
        return false;
      }
      
      // 인증 상태 확인
      const isAuth = await window.firebaseData?.isAuthenticated?.();
      console.log('인증 상태:', isAuth);
      
      if (!isAuth) {
        console.log('로그인되지 않음');
        document.getElementById('accessDenied').style.display = 'block';
        document.getElementById('adminContent').style.display = 'none';
        return false;
      }
      
      const uid = await window.firebaseData?.getCurrentUserUid?.();
      console.log('현재 사용자 UID:', uid);
      console.log('관리자 UID:', ADMIN_UID);
      
      if (uid === ADMIN_UID) {
        console.log('관리자 권한 확인됨');
        currentUserUid = uid;
        document.getElementById('accessDenied').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        return true;
      } else {
        console.log('관리자 권한 없음');
        document.getElementById('accessDenied').style.display = 'block';
        document.getElementById('adminContent').style.display = 'none';
        return false;
      }
    } catch (error) {
      console.error('접근 권한 확인 실패:', error);
      document.getElementById('accessDenied').style.display = 'block';
      document.getElementById('adminContent').style.display = 'none';
      return false;
    }
  }

  // 모든 사용자 정보 가져오기
  async function fetchAllUsers() {
    try {
      console.log('사용자 정보 가져오기 시작...');
      
      const { db } = await window.getFirebaseAppAndDb();
      const { collection, getDocs, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      
      console.log('Firebase DB 객체:', !!db);
      console.log('현재 관리자 UID:', currentUserUid);
      
      const usersRef = collection(db, 'users');
      console.log('users 컬렉션 참조 생성됨');
      
      const snapshot = await getDocs(usersRef);
      console.log('사용자 스냅샷:', { 
        empty: snapshot.empty, 
        size: snapshot.size,
        docs: snapshot.docs.length 
      });
      
      allUsers = [];
      snapshot.forEach(doc => {
        const userData = doc.data();
        console.log('사용자 문서:', { id: doc.id, data: userData });
        allUsers.push({
          uid: doc.id,
          ...userData
        });
      });
      
      console.log(`총 ${allUsers.length}명의 사용자 정보를 가져왔습니다.`);
      console.log('사용자 목록:', allUsers.map(u => ({ uid: u.uid, name: u.name || u.displayName })));
      
      // 하드코딩된 모든 사용자 UID 목록 사용
      if (allUsers.length === 0) {
        console.log('하드코딩된 사용자 UID 목록을 사용합니다...');
        
        // 하드코딩된 모든 사용자 UID 목록
        const allUserUids = [
          'WRcdJOZJJCXMpkV3WG0jUTp8I5h1',
          'fkLWvKLKaRT4wZ1j40gia8hmsA72',
          'pqCnLsuyZrfJASspMOixTiJWl0g1',
          'JjOgt7spmXMpG7tslDz7ROAwJ4P2',
          'O61e0m0q0JOAkv73jk5y81mdEDd2',
          '4NboR1jFUcRMRm3uLljF1l6UqMY2',
          '0Eiyl2LGCRfzVCJRqzn4ot8qSy92',
          'M5bNsbKXiVQCi7TuyvWkH3RUNji1',
          'jZ7MmTF7eFZCpq1PHmKbNLghlHA3',
          'CUOUoM9NTWMvGyZ9YjT6rdUHtVC3',
          'oxp6mue9lUWd2XIoSIlgSIceTB02',
          'nswTy2ip82hIEYfOJ1FiMzxcdxi2',
          'dR39blRK7sMHcHQ1PlAaQ3AvndQ2',
          'B2ZYgSDjM7Y3DaBIKmsZl8XBXQp1',
          '51pgFJbj3qYNi2kHJkBSfsOPKYa2',
          'VKFJbBedjqML1YkW3jZnBdvtiZU2',
          'ZJ479LfUCMQqpmzYua0HQahgdZk2',
          'ZlTHQqBY6pNyzVpb2iU8O5DPO4q2',
          '36AGvjAeTBYdaKeAqIfpNfHTt5G2',
          'asIYZFIlbWSY1es46bRCMUp9MZr1',
          'bF588uRythV6lK3vRwSxTeKCWYf1',
          'cb4ab1jtBjeb2P1OwOrVp8vIHh92',
          'lLoc3JZ9OHTtczjZ9vT7Augzyhv1',
          '6bk72c8s6dfe60zi8Qc54F6Nsat1',
          'VUOd0mFb1zVAGsqYbsAGjHSC6d23',
          'Q39Thv2UOST2th3uujNyxLybDV32',
          'J6qlUjQrEMZbbZlWDSvB9OpHW2i1',
          'dszmx0y2e4e3HCWTV00H1kZ9nB62',
          'aeTcj1IXeuf3ENUcPxe5vmIYwFn2',
          'LhQV1IsUIEZZniE3a4QJk52Tft82',
          'n9lvyxRp8SQqZEyLNCeYWqYz9zG3',
          'MssfKSgkmJWGY5oP2U3tNEvlWjI3',
          'PRJWEPkY0be3mTCSWBFHbGQc12u1',
          'k2fH1Ri0QJbNXyvpAvpuWU3EOuF2',
          'FrNwbVDMaIXLlUVdG324RYScTRG2',
          'QxNDx7GVytfh5dxxiCpH84BQhli1',
          'dM3Rvcwsg8flCKCY6pbiMnjcOrO2',
          '2RkgZx7kaOaVmyK3RzcDceAlysx1',
          'X88tTrzkIVYZFYCrP2jpR6xnk2B3',
          'bl9A3k2Co5WLBJbYUe98Q4JBooC3',
          'Cn9MV05VeYVyvlQkqZSUoQ5sFlx2',
          'r2ABBh4F6DgrMIkkaoFM25oBA5O2',
          'zo2h81Ij3lQk3uE4RbSDpJD7IXh2',
          'h0aoOGv68PQBIYWsl4544E5bZvf2',
          'VI2IoZETcMgFmhbupWABysQKadu2',
          'KhXhhMTo75P8aPHJjBUUxZvrwzs1',
          'g0c1n5J1W2YawNOmREj0oEsORBE3',
          'aKNoy2mfa8X5I6Zzrr5BcHPWnRz1',
          'oVowmmHMRYaskUj2fWpN8rdeUwh2',
          'o3NeiVAUDZSlUbpG3tMQ1J7UWlq2',
          'qBPMabxl9BUj53at6V6UIZPfT6r1',
          'cjX8yMlygIgBlGloF2e9Fum2isZ2',
          'fmbB02EY3qUtJFpkeKQqXoKcmkN2',
          '5E3oLGJO3Wc460s4IcOWoqkY0DB3',
          'cdMWPqGerYcCuTXZbAw1gXEWIXt2',
          'xN8HtTXTpId0qWf1AxPypYZlWo63',
          'nX5yEhFCZZdpSBDGYQiHA9kSXJh2',
          'ejajdQbTF4M8IwFTz1MVnVuuoA22',
          '8XQWGq2O23MVI0tzRid2gdKrnaG2',
          'XSeM8AdPCUP810gokNvTazIOX7w2',
          'I960Kz1EijNF76638P59SgpomdF2',
          'PCmGu0Kt0HPdhXQUI6zDx6H96yB3',
          'TUscOf9J5xfFur2J7EGKbjvqfef2',
          '9cCgknYXkbQe5CAG1DRlFwWmMUE3',
          'nBElyz9AUASVdsQqeGQPInQdJCo1',
          'sb9hNOmrNhPd8KO08DscWCzZxT53',
          'bO3dHUde3CPOqScsZFe9JGOJEsi2',
          'VQC1azy1H8Xb9E7nuTW1RyMx5B52',
          'SlKVE6tzEOWkhVk3IfEalmmmyzx2',
          'l5qENNQkkweMTvQYtzoG4BAZebF3',
          'UauPrKFTBJaRXyLYjMF4znSsi5U2',
          'e9Id49Pa6waJFA7g7RHCbiUUdf72',
          'm8kg1KbSzdVYbIdCxapCooYVsrR2',
          'HEumHGcKKDVjVdyMQBo5e0pqOv32',
          '4sPsZvlWUaP3rL6RKZYBrzEaHA93',
          'UOgj3L4ZOUQeQreSHzLKhtTQwa82',
          'm1vRmYxl01c4U7nCmP8EK4KooEN2',
          '7OJyVZFN9Dgw1THf9QgsZPdTQR42',
          'VsAWChuPIPeZfy8a62FMJMD9QPG3',
          'l7Xqxsx99KXzTRXRPd7D00jAUTm2',
          'y6VTQ7kOMDUeixayVkFZkIRB7xO2',
          'ZgIOnf4qVDbLBiVucuuuG7nSfFT2',
          'B7j85Y1HDrhIEP24CwghMLDXcLe2',
          'S8PcwCtfV8UfQKi2KpC5kbfCsq83',
          'JN4Aj1tLcgSdLbDxJvHXYphEGG12',
          'IlZ8YpkPjmV79WU2itCwPp8Gk6t2',
          'jz2W3dOpZmTUw0H3x2DV2QSPet32',
          'OyDiGyFxHjUOaXfTKSM49ffSXAE2',
          'vPyKdlAjbfNZIhW9tO2N9fe8Mg22',
          'BAdn611CqLXqULS3u8EveX6Bl2v2',
          'FoGVZ5bhimMEp7H43OVNA72Nw0b2',
          'YA9rtJMw5zXQPNYuWxslDTKlZoo2',
          'hU6thgkjI1gIasdTpUA3YSGVm0h1',
          'hkbvHbUC8xRmc9WZisi9vWJtBe82',
          'tt1YSD1HEncK2IhdjqRc41RDfGB2',
          'Bc1l3o3zz2T3xjPtdRP83NJipCE2',
          'cKipew6dcpeWOHddw6yFxRbHBAh2',
          'grXV9p498Xar1ugyKKGs7ycT2Dr1',
          '3uvLN9aYtBgOW6h4R5X3aixHMy23',
          'jiDQCuRpBGVZjnUrIT0cInXgIVG2',
          'nIFEBVILqgcQSxH5TVrwtglwp7Q2',
          'oNP1OtfV9wdHTsgGZO6hkCaCiZK2',
          'DRdR9MMiFHOnNK85CBcYWKKglUw1',
          'ZAKL8ukxTyQorl2wZhkG1co6dNw1',
          'ZNE7WWO7rAgeQZbFzvJQq3s9wlx2',
          'zcaWS7Kl8xSeBoWrVY5w2LpMwsj2'
        ];
        
        console.log(`하드코딩된 사용자 UID 목록: 총 ${allUserUids.length}명`);
        
        // 각 UID에 대해 사용자 정보 생성
        for (const uid of allUserUids) {
          try {
            // 사용자 기본 정보 문서 시도
            const userDocRef = doc(db, 'users', uid);
            const userDocSnap = await getDoc(userDocRef);
            
            let userInfo = {
              uid: uid,
              name: `사용자 ${uid.substring(0, 8)}`,
              className: '미분반',
              studentNumber: 0
            };
            
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              userInfo = {
                uid: uid,
                name: userData.name || userData.displayName || `사용자 ${uid.substring(0, 8)}`,
                className: userData.className || userData.class || '미분반',
                studentNumber: userData.studentNumber || userData.number || 0,
                email: userData.email || null
              };
            } else {
              // 기본 정보가 없으면 profile 컬렉션에서 정보 찾기
              try {
                const profileRef = doc(db, 'users', uid, 'profile', 'main');
                const profileSnap = await getDoc(profileRef);
                if (profileSnap.exists()) {
                  const profileData = profileSnap.data();
                  userInfo = {
                    uid: uid,
                    name: profileData.name || profileData.nickname || `사용자 ${uid.substring(0, 8)}`,
                    className: profileData.classNo ? `${profileData.grade || ''}학년 ${profileData.classNo}반` : '미분반',
                    studentNumber: profileData.studentNo || 0,
                    grade: profileData.grade || null,
                    classNo: profileData.classNo || null,
                    nickname: profileData.nickname || null,
                    phone: profileData.phone || null,
                    updatedAt: profileData.updatedAt || null
                  };
                }
              } catch (profileError) {
                // 프로필 정보 접근 실패 시 기본 정보 사용
              }
            }
            
            allUsers.push(userInfo);
            
            // 진행 상황 표시 (20명마다)
            if (allUsers.length % 20 === 0) {
              console.log(`진행 상황: ${allUsers.length}/${allUserUids.length}명 완료`);
            }
            
          } catch (userError) {
            console.error(`사용자 ${uid} 정보 생성 실패:`, userError);
            // 기본 정보라도 추가
            allUsers.push({
              uid: uid,
              name: `사용자 ${uid.substring(0, 8)}`,
              className: '미분반',
              studentNumber: 0
            });
          }
        }
        
        console.log(`최종 사용자 목록: 총 ${allUsers.length}명`);
      }
      
      return allUsers;
    } catch (error) {
      console.error('사용자 정보 가져오기 실패:', error);
      console.error('오류 상세:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      // 권한 오류인지 확인
      if (error.code === 'permission-denied') {
        console.error('❌ Firebase 권한 오류: 관리자가 users 컬렉션에 접근할 수 없습니다.');
      }
      
      throw error;
    }
  }



     // 모든 로또 내역 가져오기
   async function fetchAllLotteryTickets() {
     try {
       const { db } = await window.getFirebaseAppAndDb();
       const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
       
       allLotteryTickets = [];
       
       for (const user of allUsers) {
         try {
           const lotteryRef = collection(db, 'users', user.uid, 'lotteryTickets');
           const lotteryQuery = query(lotteryRef, orderBy('at', 'desc'));
           const lotterySnap = await getDocs(lotteryQuery);
           
           lotterySnap.forEach(doc => {
             const ticketData = doc.data();
             allLotteryTickets.push({
               id: doc.id,
               uid: user.uid,
               user: user,
               ...ticketData
             });
           });
         } catch (error) {
           console.error(`사용자 ${user.uid} 로또 내역 가져오기 실패:`, error);
         }
       }
       
       return allLotteryTickets;
     } catch (error) {
       console.error('로또 내역 가져오기 실패:', error);
       throw error;
     }
   }

   // 모든 코인 지급 내역 가져오기
   async function fetchAllCoinHistory() {
     try {
       const { db } = await window.getFirebaseAppAndDb();
       const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
       
       allCoinHistory = [];
       
       for (const user of allUsers) {
         try {
           const coinHistoryRef = collection(db, 'users', user.uid, 'coinHistory');
           const coinHistoryQuery = query(coinHistoryRef, orderBy('givenAt', 'desc'));
           const coinHistorySnap = await getDocs(coinHistoryQuery);
           
           coinHistorySnap.forEach(doc => {
             const historyData = doc.data();
             allCoinHistory.push({
               id: doc.id,
               uid: user.uid,
               user: user,
               ...historyData
             });
           });
         } catch (error) {
           console.error(`사용자 ${user.uid} 코인 지급 내역 가져오기 실패:`, error);
         }
       }
       
       return allCoinHistory;
     } catch (error) {
       console.error('코인 지급 내역 가져오기 실패:', error);
       throw error;
     }
   }

  // 로또 당첨 기록 테이블 렌더링
  function renderLotteryWinnersTable() {
    const tbody = document.getElementById('lotteryWinnersBody');
    const loading = document.getElementById('lotteryWinnersLoading');
    const error = document.getElementById('lotteryWinnersError');
    const table = document.getElementById('lotteryWinnersTable');
    
    try {
      // 당첨 기록만 필터링 (rank가 있는 것만)
      const winners = allLotteryTickets.filter(ticket => ticket.rank && ticket.rank >= 1 && ticket.rank <= 4);
      
      // 등수별로 정렬 (1등, 2등, 3등, 4등 순)
      const sortedWinners = winners.sort((a, b) => {
        // 먼저 등수로 정렬
        if (a.rank !== b.rank) {
          return a.rank - b.rank;
        }
        // 등수가 같으면 시간순 정렬 (최신순)
        const aTime = a.at?.toDate ? a.at.toDate().getTime() : 0;
        const bTime = b.at?.toDate ? b.at.toDate().getTime() : 0;
        return bTime - aTime;
      });
      
      tbody.innerHTML = sortedWinners.map(ticket => {
        const nums = Array.isArray(ticket.nums) ? ticket.nums.join(', ') : '-';
        const drawNums = Array.isArray(ticket.drawNums) ? ticket.drawNums.join(', ') : '-';
        const bonus = ticket.drawBonus || '-';
        const hitCount = ticket.hitCount || 0;
        const rankText = `${ticket.rank}등`;
        
        return `
          <tr class="winner-row winner-row-${ticket.rank}">
            <td><strong>${rankText}</strong></td>
            <td>${renderUserInfo(ticket.user)}</td>
            <td>${nums}</td>
            <td>${drawNums}</td>
            <td>${bonus}</td>
            <td>${hitCount}개</td>
            <td>${formatDate(ticket.at)}</td>
          </tr>
        `;
      }).join('');
      
      loading.style.display = 'none';
      error.style.display = 'none';
      table.style.display = 'table';
    } catch (err) {
      loading.style.display = 'none';
      error.style.display = 'block';
      error.textContent = '로또 당첨 기록을 불러오는 중 오류가 발생했습니다.';
      table.style.display = 'none';
    }
  }

   // 코인 지급 내역 테이블 렌더링
   function renderCoinHistoryTable() {
     const tbody = document.getElementById('coinHistoryBody');
     const loading = document.getElementById('coinHistoryLoading');
     const error = document.getElementById('coinHistoryError');
     const table = document.getElementById('coinHistoryTable');
     
     try {
       const sortedHistory = allCoinHistory.sort((a, b) => {
         const aTime = a.givenAt?.toDate ? a.givenAt.toDate().getTime() : 0;
         const bTime = b.givenAt?.toDate ? b.givenAt.toDate().getTime() : 0;
         return bTime - aTime;
       });
       
       tbody.innerHTML = sortedHistory.map(history => `
         <tr>
           <td>${renderUserInfo(history.user)}</td>
           <td>${formatNumber(history.amount || 0)} coin</td>
           <td>${history.reason || '-'}</td>
           <td>${formatDate(history.givenAt)}</td>
         </tr>
       `).join('');
       
       loading.style.display = 'none';
       error.style.display = 'none';
       table.style.display = 'table';
     } catch (err) {
       loading.style.display = 'none';
       error.style.display = 'block';
       error.textContent = '코인 지급 내역을 불러오는 중 오류가 발생했습니다.';
       table.style.display = 'none';
     }
   }

     // 모든 데이터 새로고침
   async function refreshAllData() {
     try {
       console.log('데이터 새로고침 시작...');
       
       // 로딩 상태 표시
       document.getElementById('lotteryWinnersLoading').style.display = 'block';
       document.getElementById('coinHistoryLoading').style.display = 'block';
       
       document.getElementById('lotteryWinnersTable').style.display = 'none';
       document.getElementById('coinHistoryTable').style.display = 'none';
       
       // 데이터 가져오기
       console.log('사용자 정보 가져오기...');
       await fetchAllUsers();
       
       console.log('로또 내역 가져오기...');
       await fetchAllLotteryTickets();
       
       console.log('코인 지급 내역 가져오기...');
       await fetchAllCoinHistory();
       
       // 테이블 업데이트
       console.log('테이블 렌더링...');
       renderLotteryWinnersTable();
       renderCoinHistoryTable();
       
       console.log('데이터 새로고침 완료');
       
     } catch (error) {
       console.error('데이터 새로고침 실패:', error);
       alert('데이터를 새로고침하는 중 오류가 발생했습니다.');
     }
   }

   // 반/번호별 코인 지급 함수
   async function giveCoinByClassNumber() {
     try {
       const className = document.getElementById('classNameInput').value.trim();
       const studentNumber = Number(document.getElementById('studentNumberInput').value);
       const amount = Number(document.getElementById('coinAmountInput').value);
       const reason = document.getElementById('coinReasonInput').value.trim();
       
       if (!className) {
         alert('반을 입력해주세요.');
         return;
       }
       
       if (!studentNumber || studentNumber <= 0) {
         alert('학생 번호를 입력해주세요.');
         return;
       }
       
       if (!amount || amount <= 0) {
         alert('지급할 코인 수량을 입력해주세요.');
         return;
       }
       
       if (!reason) {
         alert('코인 지급 사유를 입력해주세요.');
         return;
       }
       
       if (amount > 100) {
         alert('한 번에 최대 100코인까지만 지급할 수 있습니다.');
         return;
       }
       
       // 해당 반/번호의 사용자 찾기
       const targetUser = allUsers.find(user => 
         (user.className === className || user.class === className) && 
         (user.studentNumber === studentNumber || user.number === studentNumber)
       );
       
       if (!targetUser) {
         alert(`해당하는 학생을 찾을 수 없습니다.\n반: ${className}\n번호: ${studentNumber}`);
         return;
       }
       
       // 버튼 비활성화
       const button = document.querySelector('.coin-give-btn-large');
       button.disabled = true;
       button.textContent = '처리중...';
       
       const { db } = await window.getFirebaseAppAndDb();
       const { doc, updateDoc, addDoc, collection, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
       
       // 사용자 지갑 업데이트
       const walletRef = doc(db, 'users', targetUser.uid, 'wallet', 'main');
       await updateDoc(walletRef, {
         coins: window.firebaseData.increment(amount),
         totalCoins: window.firebaseData.increment(amount)
       });
       
       // 코인 지급 내역 기록
       const coinHistoryRef = collection(db, 'users', targetUser.uid, 'coinHistory');
       await addDoc(coinHistoryRef, {
         amount: amount,
         reason: reason,
         givenAt: serverTimestamp(),
         givenBy: currentUserUid
       });
       
       // 입력 필드 초기화
       document.getElementById('classNameInput').value = '';
       document.getElementById('studentNumberInput').value = '';
       document.getElementById('coinAmountInput').value = '';
       document.getElementById('coinReasonInput').value = '';
       
       // 성공 메시지
       alert(`${targetUser.name || targetUser.displayName} 학생에게 ${amount}코인이 성공적으로 지급되었습니다.`);
       
       // 데이터 새로고침
       await refreshAllData();
       
     } catch (error) {
       console.error('코인 지급 실패:', error);
       alert('코인 지급 중 오류가 발생했습니다.');
       
       // 버튼 재활성화
       const button = document.querySelector('.coin-give-btn-large');
       if (button) {
         button.disabled = false;
         button.textContent = '코인 지급';
       }
     }
   }

     // 인증 상태 확인 함수
   async function checkAuthStatus() {
     try {
       const authInfo = document.getElementById('authInfo');
       authInfo.textContent = '확인 중...';
       
       if (!window.firebaseData) {
         authInfo.textContent = 'Firebase가 초기화되지 않았습니다.';
         return;
       }
       
       const isAuth = await window.firebaseData?.isAuthenticated?.();
       const uid = await window.firebaseData?.getCurrentUserUid?.();
       
       let status = `로그인 상태: ${isAuth ? '로그인됨' : '로그인 안됨'}`;
       if (uid) {
         status += `\n사용자 UID: ${uid}`;
         status += `\n관리자 UID: ${ADMIN_UID}`;
         status += `\n관리자 권한: ${uid === ADMIN_UID ? '있음' : '없음'}`;
       }
       
       authInfo.textContent = status;
       console.log('인증 상태:', { isAuth, uid, isAdmin: uid === ADMIN_UID });
       
     } catch (error) {
       console.error('인증 상태 확인 실패:', error);
       document.getElementById('authInfo').textContent = `오류: ${error.message}`;
     }
   }



     // 전역 함수로 노출
   window.refreshAllData = refreshAllData;
   window.giveCoinByClassNumber = giveCoinByClassNumber;
   window.checkAuthStatus = checkAuthStatus;

  // 페이지 로드 시 초기화
  window.addEventListener('load', async () => {
    try {
      console.log('관리자 페이지 로드 시작...');
      
      // Firebase 초기화 대기
      console.log('Firebase 초기화 대기 중...');
      await new Promise(resolve => {
        const checkFirebase = () => {
          console.log('Firebase 상태 확인:', {
            getFirebaseAppAndDb: !!window.getFirebaseAppAndDb,
            firebaseData: !!window.firebaseData
          });
          
          if (window.getFirebaseAppAndDb && window.firebaseData) {
            console.log('Firebase 초기화 완료');
            resolve();
          } else {
            console.log('Firebase 초기화 대기 중...');
            setTimeout(checkFirebase, 100);
          }
        };
        checkFirebase();
      });
      
      // 관리자 접근 권한 확인
      console.log('관리자 접근 권한 확인...');
      const hasAccess = await checkAdminAccess();
      if (hasAccess) {
        console.log('초기 데이터 로드 시작...');
        // 초기 데이터 로드
        await refreshAllData();
      } else {
        console.log('관리자 권한 없음 - 데이터 로드 건너뜀');
        // 인증 상태 표시
        await checkAuthStatus();
      }
    } catch (error) {
      console.error('페이지 초기화 실패:', error);
      document.getElementById('accessDenied').style.display = 'block';
      document.getElementById('adminContent').style.display = 'none';
    }
  });
})();
