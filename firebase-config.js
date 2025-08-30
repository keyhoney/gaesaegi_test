;(function () {
  const FALLBACK_CONFIG = {
    apiKey: "AIzaSyCu2sVyMwlFpARnEGQsnBXJkPkbLbvasjg",
    authDomain: "honey-gsg.firebaseapp.com",
    projectId: "honey-gsg",
    storageBucket: "honey-gsg.firebasestorage.app",
    messagingSenderId: "853584351494",
    appId: "1:853584351494:web:bdf62930cc02cd27e28e87",
    measurementId: "G-B33ZSK7JFJ",
  };

  async function tryLoadExternalConfigScript() {
    if (window.__FIREBASE_CONFIG__) return true;
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'config.js';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('config.js not found'));
        document.head.appendChild(s);
      });
      return Boolean(window.__FIREBASE_CONFIG__);
    } catch (_) {
      return false;
    }
  }

  window.loadFirebaseConfig = async function loadFirebaseConfig() {
    if (window.__FIREBASE_CONFIG__) return window.__FIREBASE_CONFIG__;
    const loaded = await tryLoadExternalConfigScript();
    if (loaded && window.__FIREBASE_CONFIG__) return window.__FIREBASE_CONFIG__;
    return FALLBACK_CONFIG;
  };

  // 앱/Firestore 단일 초기화(노이즈 완화 옵션 포함)
  let _db = null;
  window.getFirebaseAppAndDb = async function getFirebaseAppAndDb() {
    if (_db) {
      try {
        const { getApps } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
        return { app: getApps()[0], db: _db };
      } catch { return { app: null, db: _db }; }
    }
    const cfg = await window.loadFirebaseConfig();
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { initializeFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const app = getApps().length ? getApps()[0] : initializeApp(cfg);
    const db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      useFetchStreams: false,
      // 필요시 아래를 켜서 long-polling 강제
      // experimentalForceLongPolling: true,
    });
    _db = db;
    return { app, db };
  };
})();

