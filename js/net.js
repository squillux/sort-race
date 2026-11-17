// Firebase 연결: 인증(교사 Google / 모둠 익명), 실시간 DB, 서버 시각 맞추기
import { FIREBASE, EMU } from './config.js';

const V = '10.14.1';
const CDN = `https://www.gstatic.com/firebasejs/${V}/`;
let fb = null;

export function useEmu() {
  try { if (new URLSearchParams(location.search).get('emu') === '1') return true; } catch (e) {}
  return /[?&]emu=1/.test(location.hash) || (sessionStorage && sessionStorage.getItem('sr-emu') === '1');
}

export async function connect() {
  if (fb) return fb;
  const emu = useEmu();
  if (emu) try { sessionStorage.setItem('sr-emu', '1'); } catch (e) {}
  if (!emu && !FIREBASE.databaseURL) throw new Error('Firebase 설정값(js/config.js)이 아직 비어 있어요.');
  const [appM, authM, dbM] = await Promise.all([import(CDN + 'firebase-app.js'), import(CDN + 'firebase-auth.js'), import(CDN + 'firebase-database.js')]);
  const cfg = emu ? { apiKey: 'demo-key', projectId: EMU.projectId, databaseURL: `http://${EMU.db}?ns=${EMU.projectId}-default-rtdb`, authDomain: 'localhost' } : FIREBASE;
  const app = appM.initializeApp(cfg);
  const auth = authM.getAuth(app);
  const db = dbM.getDatabase(app);
  if (emu) {
    authM.connectAuthEmulator(auth, EMU.auth, { disableWarnings: true });
    const [h, p] = EMU.db.split(':'); dbM.connectDatabaseEmulator(db, h, +p);
  }
  let offset = 0;
  dbM.onValue(dbM.ref(db, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });
  fb = { app, auth, db, A: authM, D: dbM, emu, serverNow: () => Date.now() + offset };
  return fb;
}

export async function ready(f) { await f.auth.authStateReady(); return f.auth.currentUser; }

export async function signInTeam(f) {
  const u = await ready(f);
  if (u) return u;
  return (await f.A.signInAnonymously(f.auth)).user;
}

export async function signInTeacher(f) {
  const prov = new f.A.GoogleAuthProvider();
  prov.setCustomParameters({ prompt: 'select_account' });
  return (await f.A.signInWithPopup(f.auth, prov)).user;
}

export async function isAdmin(f, uid) {
  try { const s = await f.D.get(f.D.ref(f.db, 'admins/' + uid)); return s.val() === true; } catch (e) { return false; }
}

export const r = (f, p) => f.D.ref(f.db, p);

// 흔한 비속어가 들어 있으면 막기 (완벽하지 않으므로 교사 강퇴 기능과 함께 써요)
const BAD = ['씨발', '시발', '씨바', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '븅신', '개새', '개색', '좆', '존나', '졸라', '지랄', 'ㅈㄹ', '닥쳐', '꺼져', '미친놈', '미친년', '니애미', '느금', '엠창', 'fuck', 'shit'];
export const bad = v => { const s = String(v).toLowerCase().replace(/[\s._*~!?,-]/g, '').replace(/시발(점|역)/g, ''); return BAD.some(w => s.includes(w)); };

export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// 순위: 완주 팀은 기록(시간+벌점) 오름차순, 미완주 팀은 진행률 내림차순
export function rank(teams, prog) {
  const rows = Object.entries(teams || {}).map(([t, tm]) => ({ t: +t, nick: tm.nick || '', members: tm.members, ...(prog?.[t] || {}) }));
  rows.sort((a, b) => (b.done ? 1 : 0) - (a.done ? 1 : 0) || (a.done ? a.score - b.score : (b.pct || 0) - (a.pct || 0)) || a.t - b.t);
  let place = 0; rows.forEach((x, i) => { if (x.done) x.place = ++place; });
  return rows;
}

export const teamName = (t, nick) => `${t}모둠${nick ? ' · ' + nick : ''}`;
