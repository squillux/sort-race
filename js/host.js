// 대항전 · 교사 화면 (TV에 띄워요)
import { ALGOS, ALGO_KEYS, makeArray, compareAll } from './sorts.js';
import { drawMini } from './board.js';
import { sfx, unlock } from './sound.js';
import { connect, ready, signInTeacher, isAdmin, r, rank, today, teamName } from './net.js';
import { $, esc, fmt, toast, countdown, store, segButtons } from './ui.js';

const HOST_KEY = 'sr-host';
const MEDAL = ['🥇', '🥈', '🥉'];

export function mountHost(root) {
  let f = null, me = null, code = null, meta = null, st = null, teams = {}, prog = {}, picks = {}, live = {}, unsub = [], progUnsub = null, pickUnsub = null, liveUnsub = null, raf = 0, finishedSeen = new Set(), saved = new Set(), autoPickTimer = null, view = 'race';
  let cfg = { algo: 'bubble', n: 8, final: false, relay: false, practice: false };
  const off = () => { unsub.forEach(u => u()); unsub = []; progUnsub?.(); progUnsub = null; pickUnsub?.(); pickUnsub = null; liveUnsub?.(); liveUnsub = null; cancelAnimationFrame(raf); clearTimeout(autoPickTimer); };
  // 멈춘 시간을 뺀 경과 시간 기준 시각
  const effNow = () => { const n = f.serverNow(); return n - (st?.pauseTotal || 0) - (st?.pausedAt ? n - st.pausedAt : 0); };

  root.innerHTML = '<div class="host"></div>';
  const box = $('.host', root);

  async function start() {
    box.innerHTML = '<p class="muted">🔌 연결 중...</p>';
    try { f = await connect(); me = await ready(f); }
    catch (e) { box.innerHTML = `<div class="card"><h2>⚠ 실시간 서버에 연결할 수 없어요</h2><p class="small mono">${esc(e.message)}</p></div>`; return; }
    if (!me || me.isAnonymous) return loginView();
    if (!(await isAdmin(f, me.uid))) return notAdminView();
    const last = store(HOST_KEY);
    if (last?.code) {
      const s = await f.D.get(r(f, `rooms/${last.code}/meta`)).catch(() => null);
      if (s?.val()?.host === me.uid && s.val().createdAt > Date.now() - 12 * 3600e3) return openRoom(last.code);
    }
    setupView();
  }

  function loginView() {
    box.innerHTML = `<div class="card" style="max-width:560px;margin:30px auto;text-align:center">
      <div style="font-size:3rem">📺</div><h1>교사용</h1>
      <p class="muted">대항전 방을 만들고 반별 기록을 보려면 선생님 Google 계정으로 로그인해요.</p>
      <button class="btn lg login">Google로 로그인</button>
      ${f.emu ? '<p><button class="btn ghost emulogin">🧪 에뮬레이터 교사 로그인</button></p>' : ''}
      <p class="small muted" style="margin-top:14px">학생은 첫 화면의 <b>대항전 참여</b>로 들어가요.</p></div>`;
    $('.login', box).addEventListener('click', async () => {
      try { await signInTeacher(f); start(); } catch (e) { toast('로그인하지 못했어요: ' + e.code, true, 4000); }
    });
    $('.emulogin', box)?.addEventListener('click', async () => {
      const cred = f.A.GoogleAuthProvider.credential(JSON.stringify({ sub: 'teacher-1', email: 'teacher@example.com', email_verified: true }));
      await f.A.signInWithCredential(f.auth, cred); start();
    });
  }

  function notAdminView() {
    box.innerHTML = `<div class="card" style="max-width:640px;margin:30px auto">
      <h1>🔐 교사 등록이 필요해요</h1>
      <p>처음 한 번만 하면 돼요. Firebase 콘솔 → Realtime Database → 데이터에서 <b>admins</b> 아래에 다음 값을 추가해 주세요.</p>
      <p class="mono" style="background:var(--bg);padding:10px;border-radius:10px;word-break:break-all">admins / <b class="uid">${esc(me.uid)}</b> : true</p>
      <div class="row"><button class="btn sub copy">📋 uid 복사</button><button class="btn again">🔄 등록했어요, 다시 확인</button><button class="btn ghost out">다른 계정으로 로그인</button></div>
      <p class="small muted">로그인한 계정: ${esc(me.email || '')}</p></div>`;
    $('.copy', box).addEventListener('click', () => navigator.clipboard?.writeText(me.uid).then(() => toast('복사했어요.')));
    $('.again', box).addEventListener('click', start);
    $('.out', box).addEventListener('click', async () => { await f.A.signOut(f.auth); start(); });
  }

  function setupView() {
    off(); code = null;
    let cls = null, maxTeams = 6;
    box.innerHTML = `<h1>📺 대항전 방 만들기</h1>
      <div class="card">
        <p><b>반</b></p><div class="cls"></div>
        <p style="margin-top:12px"><b>모둠 수</b></p><div class="mt"></div>
        <p class="err small" style="color:var(--bad)"></p>
        <div class="row" style="margin-top:12px"><button class="btn lg make">🏁 방 만들기</button><a class="btn sub" href="#/records">📒 반별 기록 보기</a><button class="btn ghost out">로그아웃</button></div>
      </div>`;
    segButtons($('.cls', box), Array.from({ length: 12 }, (_, i) => ({ v: String(i + 1), label: `${i + 1}반` })), null, v => { cls = +v; });
    segButtons($('.mt', box), [2, 3, 4, 5, 6, 7, 8, 9, 10].map(x => ({ v: String(x), label: x + '모둠' })), '6', v => { maxTeams = +v; });
    $('.out', box).addEventListener('click', async () => { await f.A.signOut(f.auth); store(HOST_KEY, null); start(); });
    $('.make', box).addEventListener('click', async () => {
      unlock();
      if (!cls) return $('.err', box).textContent = '반을 골라 주세요.';
      for (let i = 0; i < 20; i++) {
        const c = String(1000 + Math.floor(Math.random() * 9000));
        const ex = await f.D.get(r(f, `rooms/${c}/meta`)).catch(() => null);
        if (ex?.val() && ex.val().createdAt > Date.now() - 7 * 86400e3) continue;
        try {
          await f.D.set(r(f, `rooms/${c}`), { meta: { host: me.uid, cls, createdAt: f.serverNow(), maxTeams }, state: { phase: 'lobby', round: 0 } });
          store(HOST_KEY, { code: c });
          prune();
          return openRoom(c);
        } catch (e) { console.warn(e); }
      }
      $('.err', box).textContent = '방을 만들지 못했어요. 잠시 뒤 다시 해 주세요.';
    });
  }

  // 7일 지난 내 방 정리
  async function prune() {
    try {
      const s = await f.D.get(r(f, 'rooms'));
      const all = s.val() || {};
      for (const [c, rm] of Object.entries(all)) if (rm?.meta?.createdAt < Date.now() - 7 * 86400e3) f.D.remove(r(f, 'rooms/' + c)).catch(() => {});
    } catch (e) {}
  }

  function joinUrl(c) { return location.href.split('#')[0] + '#/join?c=' + c; }

  function openRoom(c) {
    off(); code = c; finishedSeen = new Set();
    box.innerHTML = `
      <div class="roomhead card">
        <div class="qr" title="학생용 주소 QR"></div>
        <div style="flex:1;min-width:220px">
          <div class="small muted"><span class="clsname"></span> · 방 코드</div>
          <div class="bigcode mono">${c}</div>
          <div class="small muted">학생: 첫 화면 → <b>대항전 참여</b> → 코드 입력 (또는 QR)</div>
        </div>
        <div class="row" style="align-self:flex-start"><button class="btn ghost small fsbtn">⛶ 전체화면</button><a class="btn ghost small" href="#/records">📒 기록</a><button class="btn ghost small endbtn">수업 끝내기</button></div>
      </div>
      <div class="main"></div>`;
    drawQr($('.qr', box), joinUrl(c));
    const fsb = $('.fsbtn', box);
    const fsPaint = () => { fsb.textContent = document.fullscreenElement ? '⛶ 전체화면 끝' : '⛶ 전체화면'; };
    if (!document.documentElement.requestFullscreen) fsb.remove();
    else { fsb.addEventListener('click', () => { (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}); }); document.addEventListener('fullscreenchange', fsPaint); }
    $('.endbtn', box).addEventListener('click', async () => {
      if (!confirm('대항전을 끝낼까요? 학생 화면에 종료 안내가 나와요. (진행 중인 라운드 기록도 저장돼요)')) return;
      if (st?.phase === 'count' || st?.phase === 'result') await saveRecord();
      await f.D.update(r(f, `rooms/${code}/state`), { phase: 'end' }); store(HOST_KEY, null); setupView();
    });
    unsub.push(f.D.onValue(r(f, `rooms/${c}/meta`), s => { meta = s.val(); if (meta) $('.clsname', box).textContent = meta.cls + '반'; }));
    unsub.push(f.D.onValue(r(f, `rooms/${c}/teams`), s => {
      const before = Object.keys(teams).length; teams = s.val() || {};
      if (Object.keys(teams).length > before && st?.phase === 'lobby') sfx.join();
      render();
    }));
    unsub.push(f.D.onValue(r(f, `rooms/${c}/state`), s => { const prev = st; st = s.val() || { phase: 'lobby', round: 0 }; onState(prev); }));
  }

  function onState(prev) {
    if (!prev || prev.round !== st.round) {
      progUnsub?.(); pickUnsub?.(); prog = {}; picks = {}; finishedSeen = new Set();
      if (st.round > 0) {
        progUnsub = f.D.onValue(r(f, `rooms/${code}/prog/${st.round}`), s => { prog = s.val() || {}; onProg(); });
        pickUnsub = f.D.onValue(r(f, `rooms/${code}/pick/${st.round}`), s => { picks = s.val() || {}; if (st.phase === 'pick') render(); });
        liveUnsub?.(); liveUnsub = f.D.onValue(r(f, `rooms/${code}/live`), s => { live = s.val() || {}; if (st.phase === 'count' && view === 'monitor') updateMonitor(); });
      }
    }
    if (st.phase === 'count' && prev?.phase !== 'count' && f.serverNow() < st.startAt) countdown(st.startAt, () => f.serverNow());
    if (st.phase === 'pick') schedulePick();
    if (prev && prev.phase === 'count' && st.phase === 'count' && prev.round === st.round) { paintPause(); return; }
    render();
  }

  function onProg() {
    for (const [t, p] of Object.entries(prog)) if (p.done && !finishedSeen.has(t)) {
      finishedSeen.add(t);
      if (finishedSeen.size === 1) sfx.fanfare(); else sfx.ding();
    }
    if (st.phase === 'count') { updateLanes(); if (view === 'monitor') updateMonitor(); }
    const rows = rank(teams, prog);
    if (st.phase === 'count' && rows.length && rows.every(x => x.done || x.quit || x.left)) {
      saveRecord(true);
      if (!st.allDone) {
        const endMs = Math.max(0, ...rows.filter(x => x.done || x.quit).map(x => x.ms || 0));
        f.D.update(r(f, `rooms/${code}/state`), { allDone: true, endMs, pausedAt: null }).catch(() => {});
      }
    }
  }

  function schedulePick() {
    clearTimeout(autoPickTimer);
    const left = st.pickUntil - f.serverNow();
    autoPickTimer = setTimeout(() => { if (st.phase === 'pick') go({ algo: 'pick' }); }, Math.max(0, left));
  }

  async function go(extra = {}) {
    unlock();
    const round = st.phase === 'pick' ? st.round : (st.round || 0) + 1;
    const next = { phase: 'count', round, algo: extra.algo || cfg.algo, n: cfg.n, seed: st.phase === 'pick' ? st.seed : Math.floor(Math.random() * 2e9), startAt: f.serverNow() + 4000, final: !!(extra.algo === 'pick' || cfg.final), relay: !!cfg.relay, pauseTotal: 0, practice: extra.algo === 'pick' ? false : !!cfg.practice };
    await f.D.set(r(f, `rooms/${code}/state`), next);
  }

  async function startPick() {
    unlock();
    const round = (st.round || 0) + 1;
    await f.D.set(r(f, `rooms/${code}/state`), { phase: 'pick', round, algo: 'pick', n: cfg.n, seed: Math.floor(Math.random() * 2e9), startAt: 0, pickUntil: f.serverNow() + 30000, final: true, relay: !!cfg.relay });
  }

  function render() {
    const main = $('.main', box); if (!main || !st) return;
    cancelAnimationFrame(raf);
    const nTeams = Object.keys(teams).length;
    if (st.phase === 'lobby' || st.phase === 'end') {
      main.innerHTML = `
        <div class="card"><h2>👥 입장한 모둠 <span class="muted">${nTeams} / ${meta?.maxTeams ?? '-'}</span></h2>
          <div class="tlist">${teamChips(true)}</div></div>
        <div class="card setupround">
          <h2>⚙ ${(st.round || 0) + 1}라운드 준비</h2>
          <p><b>정렬 방법</b></p><div class="al"></div>
          <p style="margin-top:10px"><b>막대 수</b></p><div class="nn"></div>
          <p style="margin-top:10px"><label><input type="checkbox" class="relaychk" ${cfg.relay ? 'checked' : ''}> 🎮 릴레이 교대 알림 (5번 조작마다 "다음 사람!")</label><br>
            <label><input type="checkbox" class="practicechk" ${cfg.practice ? 'checked' : ''}> 🧪 연습 라운드 (순위는 보여 주지만 기록에는 남기지 않아요. 결승에는 적용 안 됨)</label></p>
          <div class="row" style="margin-top:14px">
            <button class="btn lg gobtn" ${nTeams ? '' : 'disabled'}>▶ 모두 동시에 출발 (3초 카운트다운)</button>
            <button class="btn on lg pickbtn" ${nTeams ? '' : 'disabled'}>🏆 결승: 모둠이 방법 고르기 (30초)</button>
          </div>
          <p class="small muted">결승에서는 각 모둠이 정렬 방법을 직접 골라 같은 막대로 겨뤄요. 시간과 비교 횟수를 함께 비교해 보세요.</p>
        </div>`;
      segButtons($('.al', main), ALGO_KEYS.map(k => ({ v: k, html: `${ALGOS[k].icon} ${ALGOS[k].name}${k === 'merge' ? ' <span class="tag dare">도전</span>' : ''}` })), cfg.algo, v => { cfg.algo = v; });
      segButtons($('.nn', main), [6, 8, 10].map(x => ({ v: String(x), label: x + '개' + (x === 10 ? ' (결승 추천)' : '') })), String(cfg.n), v => { cfg.n = +v; });
      $('.relaychk', main).addEventListener('change', e => { cfg.relay = e.target.checked; });
      $('.practicechk', main).addEventListener('change', e => { cfg.practice = e.target.checked; });
      $('.gobtn', main).addEventListener('click', () => go());
      $('.pickbtn', main).addEventListener('click', startPick);
      bindKick(main);
      return;
    }
    if (st.phase === 'pick') {
      const left = Math.max(0, Math.ceil((st.pickUntil - f.serverNow()) / 1000));
      main.innerHTML = `<div class="card"><h2>🏆 결승 · 모둠이 정렬 방법을 고르는 중 <span class="pl muted">${left}초</span></h2>
        <p class="muted">막대 ${st.n}개 · 고르지 않은 모둠은 버블 정렬로 출발해요.</p>
        <div class="lanes">${Object.keys(teams).sort((a, b) => a - b).map(t => `<div class="lane"><b>${esc(teamName(t, teams[t].nick))}</b><span>${picks[t] ? ALGOS[picks[t]].icon + ' ' + ALGOS[picks[t]].name : '<span class="muted">고르는 중...</span>'}</span></div>`).join('')}</div>
        <button class="btn lg now" style="margin-top:12px">▶ 바로 출발</button></div>`;
      $('.now', main).addEventListener('click', () => go({ algo: 'pick' }));
      const tick = () => { const el = $('.pl', main); if (!el || st.phase !== 'pick') return; el.textContent = Math.max(0, Math.ceil((st.pickUntil - f.serverNow()) / 1000)) + '초'; raf = requestAnimationFrame(tick); };
      tick();
      return;
    }
    if (st.phase === 'count') {
      const A = ALGOS[st.algo];
      main.innerHTML = `<div class="card race">
        <div class="row" style="justify-content:space-between"><h2 style="margin:0">${st.practice ? '🧪 연습 · ' : ''}${st.final ? '🏆 결승' : st.round + '라운드'} · ${st.algo === 'pick' ? '모둠별 선택' : A.icon + ' ' + A.name} · 막대 ${st.n}개</h2>
          <div class="clock mono">0.0초</div></div>
        <div class="row ctlbar">
          <span class="seg viewsel"></span>
          <span class="sp"></span>
          <button class="btn sub pausebtn">⏸ 일시정지</button>
          <button class="btn ghost cancelbtn">⏹ 라운드 취소</button>
        </div>
        <div class="pausenote" hidden>⏸ 일시정지 중이에요. 학생 화면도 멈춰 있고, 시간도 흐르지 않아요.</div>
        <div class="alldone" hidden><div class="ad-ic">🏁</div><div><b>경기 종료! 모든 모둠이 끝났어요.</b><br><span>시간을 멈췄어요. 곧 순위가 공개됩니다! 아래 <b>🏆 결과 발표</b>를 눌러 주세요.</span></div></div>
        <div class="lanes big"></div>
        <div class="monitor" hidden></div>
        <div class="row" style="margin-top:12px"><button class="btn on lg reveal">🏆 결과 발표</button><span class="small muted donecnt"></span></div></div>`;
      $('.reveal', main).addEventListener('click', reveal);
      segButtons($('.viewsel', main), [{ v: 'race', label: '🏁 레이스' }, { v: 'monitor', label: '🖥 모니터링 (모둠 화면)' }], view, v => { view = v; showView(); });
      $('.pausebtn', main).addEventListener('click', togglePause);
      $('.cancelbtn', main).addEventListener('click', cancelRound);
      showView(); paintPause();
      const clock = $('.clock', main);
      const tick = () => { if (!clock.isConnected) return; clock.textContent = st.allDone ? '⏹ ' + fmt(st.endMs || 0) : fmt(Math.max(0, effNow() - st.startAt)); clock.classList.toggle('stopped', !!st.allDone); raf = requestAnimationFrame(tick); };
      tick();
      return;
    }
    if (st.phase === 'result') return renderResult(main);
  }

  function teamChips(kick) {
    const ks = Object.keys(teams).sort((a, b) => a - b);
    if (!ks.length) return '<p class="muted">아직 입장한 모둠이 없어요. 학생들이 방 코드를 입력하면 여기에 나타나요.</p>';
    return ks.map(t => `<span class="chip">🙋 ${esc(teamName(t, teams[t].nick))} <small>${teams[t].members}명</small>${kick ? ` <button class="kick" data-t="${t}" title="내보내기">✕</button>` : ''}</span>`).join('');
  }
  function bindKick(main) {
    main.querySelectorAll('.kick').forEach(b => b.addEventListener('click', async () => {
      if (!confirm(`${b.dataset.t}모둠을 내보낼까요? (그 기기는 다시 입장해야 해요)`)) return;
      await f.D.remove(r(f, `rooms/${code}/teams/${b.dataset.t}`));
    }));
  }

  const status = x => x.done ? '' : x.quit || x.left ? '❌ 실패(나감)' : '';

  function updateLanes() {
    const lanes = $('.lanes.big', box); if (!lanes) return;
    const rows = rank(teams, prog).sort((a, b) => a.t - b.t); // 결과 발표 전에는 순위를 숨기고 모둠 번호 순서로
    lanes.innerHTML = rows.map(x => {
      const algoName = x.algo ? ALGOS[x.algo].icon + ' ' + ALGOS[x.algo].short : '';
      const off = live[x.t] && live[x.t].on === false && !x.done;
      return `<div class="lane ${x.done ? 'fin' : ''} ${status(x) ? 'gone' : ''}">
        <b class="nm">${x.done ? '🏁' : status(x) ? '🚪' : '🏃'} ${esc(teamName(x.t, x.nick))}</b>
        <div class="track"><i style="width:${x.done ? 100 : x.pct || 0}%"></i></div>
        <span class="tm mono">${x.done ? '완주 ' + fmt(x.score) : status(x) || (x.pct || 0) + '%'}</span>
        <span class="sub small muted">${st.algo === 'pick' ? algoName + ' · ' : ''}위반 ${x.miss || 0}${off ? ' · <span style="color:var(--bad)">🔴 연결 끊김</span>' : ''}</span></div>`;
    }).join('');
    const d = rows.filter(x => x.done).length, gone = rows.filter(x => !x.done && (x.quit || x.left)).length, el = $('.donecnt', box);
    if (el) el.textContent = `완주 ${d} / ${rows.length}모둠${gone ? ` (나감 ${gone})` : ''}${d + gone === rows.length && rows.length ? (st.practice ? ' · 모두 끝났어요! (연습 라운드라 기록은 남기지 않아요)' : ' · 모두 끝났어요! 기록은 저장했어요.') : ''}`;
  }

  // 🖥 모니터링: 모둠 화면의 막대 상태를 그대로 다시 그려요
  function showView() {
    const lanes = $('.lanes.big', box), mon = $('.monitor', box); if (!lanes || !mon) return;
    lanes.hidden = view !== 'race'; mon.hidden = view !== 'monitor';
    if (view === 'monitor') updateMonitor(); else updateLanes();
  }
  function updateMonitor() {
    const mon = $('.monitor', box); if (!mon || mon.hidden) return;
    const rows = rank(teams, prog).sort((a, b) => a.t - b.t);
    if (!rows.length) { mon.innerHTML = '<p class="muted">입장한 모둠이 없어요.</p>'; return; }
    // 칸은 한 번만 만들고 내용만 바꿔요(깜빡임 방지)
    const want = rows.map(x => x.t).join(',');
    if (mon.dataset.ids !== want) {
      mon.dataset.ids = want;
      mon.innerHTML = rows.map(x => `<div class="mcard" data-t="${x.t}"><div class="mh"><b class="mn"></b><span class="ms mono"></span></div><div class="mb-wrap"></div><div class="mf small"></div></div>`).join('');
    }
    for (const x of rows) {
      const c = mon.querySelector(`.mcard[data-t="${x.t}"]`), lv = live[x.t] && live[x.t].round === st.round ? live[x.t] : null;
      const off = lv && lv.on === false && !x.done;
      c.classList.toggle('fin', !!x.done); c.classList.toggle('gone', !!status(x) || off);
      c.querySelector('.mn').textContent = `${x.done ? '🏁 ' : ''}${teamName(x.t, x.nick)}`;
      c.querySelector('.ms').textContent = x.done ? fmt(x.score) : status(x) || (x.pct || 0) + '%';
      drawMini(c.querySelector('.mb-wrap'), lv, lv?.n || st.n);
      c.querySelector('.mf').innerHTML = `${x.algo ? ALGOS[x.algo].icon + ' ' + ALGOS[x.algo].short + ' · ' : ''}비교 ${x.cmp || 0} · 위반 <b style="color:var(--bad)">${x.miss || 0}</b>${st.relay && lv?.who ? ` · 🎮 ${lv.who}번 차례` : ''}${off ? ' · <b style="color:var(--bad)">🔴 연결 끊김</b>' : ''}`;
      if (lv?.ev === 'miss' && c.dataset.at !== String(lv.at)) { c.dataset.at = lv.at; c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); }
    }
  }

  // ⏸ 일시정지 / ▶ 계속
  async function togglePause() {
    const n = f.serverNow();
    if (st.pausedAt) await f.D.update(r(f, `rooms/${code}/state`), { pauseTotal: (st.pauseTotal || 0) + (n - st.pausedAt), pausedAt: null });
    else await f.D.update(r(f, `rooms/${code}/state`), { pausedAt: n });
  }
  function paintPause() {
    const b = $('.pausebtn', box), note = $('.pausenote', box); if (!b) return;
    const ad = $('.alldone', box), rv = $('.reveal', box);
    if (ad) { const was = !ad.hidden; ad.hidden = !st.allDone; if (st.allDone && !was) sfx.relay(); }
    rv?.classList.toggle('pulse', !!st.allDone);
    b.hidden = !!st.allDone; $('.cancelbtn', box) && ($('.cancelbtn', box).hidden = !!st.allDone);
    b.textContent = st.pausedAt ? '▶ 계속하기' : '⏸ 일시정지';
    b.classList.toggle('mint', !!st.pausedAt); b.classList.toggle('sub', !st.pausedAt);
    if (note) note.hidden = !st.pausedAt;
  }
  // ⏹ 라운드 취소: 기록을 남기지 않고 준비 화면으로
  async function cancelRound() {
    if (!confirm('이번 라운드를 취소할까요? 기록은 저장하지 않고 준비 화면으로 돌아가요.')) return;
    saved.add(code + '_' + st.round);
    await f.D.set(r(f, `rooms/${code}/state`), { phase: 'lobby', round: st.round });
    toast('라운드를 취소했어요. 설정을 고르고 다시 출발하면 돼요.');
  }

  async function reveal() {
    sfx.drum();
    if (st.pausedAt) await togglePause();
    await saveRecord();
    setTimeout(() => f.D.update(r(f, `rooms/${code}/state`), { phase: 'result' }), 800);
  }

  async function saveRecord(auto = false) {
    const key = code + '_' + st.round; if (saved.has(key)) return;
    saved.add(key);
    if (st.practice) { if (!auto) toast('🧪 연습 라운드라 기록에는 남기지 않았어요.'); return; }
    const rows = rank(teams, prog), results = {};
    for (const x of rows) results[x.t] = { nick: x.nick || '', algo: x.algo || (st.algo === 'pick' ? 'bubble' : st.algo), score: x.score || 0, ms: x.ms || 0, miss: x.miss || 0, cmp: x.cmp || 0, moves: x.moves || 0, pct: x.pct || 0, done: !!x.done, ...(x.place ? { place: x.place } : {}), ...(!x.done && (x.quit || x.left) ? { quit: true } : {}) };
    const rid = `${today()}_${code}`;
    try {
      await f.D.update(r(f, `records/${meta.cls}/${rid}`), { date: today(), code, [`rounds/${st.round}`]: { algo: st.algo, n: st.n, arr: makeArray(st.n, st.seed).join(','), final: !!st.final, at: f.serverNow(), results } });
      toast(auto ? '✅ 모든 모둠이 끝나서 기록을 저장했어요.' : '✅ 기록을 저장했어요.');
    } catch (e) { saved.delete(key); toast('기록을 저장하지 못했어요: ' + e.message, true, 4000); }
  }

  function renderResult(main) {
    const rows = rank(teams, prog), arr = makeArray(st.n, st.seed), cmp = compareAll(arr), max = Math.max(...ALGO_KEYS.map(k => cmp[k].cmp));
    main.innerHTML = `<div class="card">
      <h2>🏆 ${st.practice ? '🧪 연습 · ' : ''}${st.final ? '결승' : st.round + '라운드'} 결과 ${st.algo !== 'pick' ? '· ' + ALGOS[st.algo].name : ''}</h2>
      <div class="podium">${rows.filter(x => x.place && x.place <= 3).map(x => `<div class="pd p${x.place}"><div class="md">${MEDAL[x.place - 1]}</div><b>${esc(teamName(x.t, x.nick))}</b><span class="mono">${fmt(x.score)}</span></div>`).join('') || '<p class="muted">완주한 모둠이 없어요.</p>'}</div>
      <div class="scroll-x"><table class="t"><tr><th>순위</th><th>모둠</th>${st.algo === 'pick' ? '<th>방법</th>' : ''}<th>기록</th><th>시간</th><th>위반</th><th>비교</th><th>이동</th></tr>
      ${rows.map(x => `<tr><td>${x.place ? x.place + '위' : status(x) || '미완주'}</td><td>${esc(teamName(x.t, x.nick))}</td>${st.algo === 'pick' ? `<td>${x.algo ? ALGOS[x.algo].icon + ' ' + ALGOS[x.algo].short : '-'}</td>` : ''}<td><b>${x.done ? fmt(x.score) : (x.pct || 0) + '%'}</b></td><td>${x.done ? fmt(x.ms) : '-'}</td><td>${x.miss || 0}</td><td>${x.cmp || 0}</td><td>${x.moves || 0}</td></tr>`).join('')}</table></div>
    </div>
    <div class="card"><h2>🤔 같은 막대를 네 가지 방법으로 정렬하면?</h2>
      <p class="small mono">이번 배열: [${arr.join(', ')}]</p>
      ${ALGO_KEYS.map(k => `<div class="cmpbar"><span>${ALGOS[k].icon} ${ALGOS[k].short}${k === st.algo ? ' ★' : ''}</span><i style="width:${Math.max(2, cmp[k].cmp / max * 70)}%;${k === st.algo ? 'background:var(--on)' : ''}"></i><em>비교 ${cmp[k].cmp}번 · 이동 ${cmp[k].moves}번</em></div>`).join('')}
      <p class="small muted">💬 함께 생각해 봐요: 가장 빨리 끝낸 모둠과 비교 횟수가 가장 적은 방법은 같을까요? 사람이 할 때와 컴퓨터가 할 때 "빠르다"는 무엇이 다를까요?</p>
      <div class="row"><button class="btn lg next">▶ 다음 라운드 준비</button></div></div>`;
    $('.next', main).addEventListener('click', () => f.D.update(r(f, `rooms/${code}/state`), { phase: 'lobby' }));
  }

  function drawQr(el, url) {
    const draw = () => { try { el.innerHTML = ''; new window.QRCode(el, { text: url, width: 132, height: 132, correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) { el.remove(); } };
    if (window.QRCode) return draw();
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    sc.onload = draw; sc.onerror = () => el.remove(); document.head.appendChild(sc);
  }

  start();
  return { destroy() { off(); } };
}
