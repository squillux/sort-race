// 대항전 · 모둠 화면 (모둠 노트북 1대)
import { ALGOS, ALGO_KEYS, makeArray } from './sorts.js';
import { createRunner } from './runner.js';
import { sfx, unlock } from './sound.js';
import { connect, signInTeam, r, bad, rank, teamName } from './net.js';
import { $, esc, fmt, toast, countdown, store, segButtons, confirmBox } from './ui.js';

const JOIN_KEY = 'sr-join';

export function mountTeam(root, { code: preCode } = {}) {
  let f = null, me = null, code = null, t = null, info = null, unsub = [], runner = null, playingRound = -1, lastPush = 0, pushTimer = null, state = null, teams = {}, cdShown = -1;
  const off = () => { unsub.forEach(u => u()); unsub = []; };

  root.innerHTML = `<div class="team"></div>`;
  const box = $('.team', root);

  async function start() {
    box.innerHTML = '<p class="muted">🔌 연결 중...</p>';
    try { f = await connect(); me = await signInTeam(f); }
    catch (e) { box.innerHTML = `<div class="card"><h2>⚠ 실시간 서버에 연결할 수 없어요</h2><p class="small mono">${esc(e.message)}</p><p>학교 인터넷 차단일 수 있어요. 그동안은 <a href="#/practice">연습하기</a>로 진행해 주세요.</p></div>`; return; }
    const saved = store(JOIN_KEY);
    if (saved && (!preCode || preCode === saved.code)) {
      const s = await f.D.get(r(f, `rooms/${saved.code}/teams/${saved.t}`)).catch(() => null);
      if (s && s.val() && s.val().uid === me.uid) return enter(saved.code, saved.t);
    }
    joinForm();
  }

  function joinForm(msg = '') {
    off();
    let members = 4, tSel = null;
    box.innerHTML = `
      <h1>🏁 대항전 참여</h1>
      <p class="lead">선생님 화면에 보이는 <b>방 코드 4자리</b>를 입력하고 모둠을 골라요.</p>
      <div class="card">
        <label><b>방 코드</b><br><input class="code mono" inputmode="numeric" maxlength="4" placeholder="0000" style="font-size:2rem;width:7em;letter-spacing:.3em;padding:6px 10px;border:2px solid var(--line);border-radius:12px" value="${esc(preCode || '')}"></label>
        <div class="tpick" style="margin-top:12px"></div>
        <div style="margin-top:12px"><b>모둠 인원</b> <span class="mem"></span></div>
        <label style="display:block;margin-top:12px"><b>모둠 별명</b> <span class="small muted">(선택, 8자까지 · 이름은 쓰지 마세요)</span><br>
          <input class="nick" maxlength="8" placeholder="예: 번개팀" style="padding:8px 10px;border:2px solid var(--line);border-radius:12px;width:12em"></label>
        <p class="err small" style="color:var(--bad)">${esc(msg)}</p>
        <button class="btn lg go">입장하기</button>
      </div>`;
    segButtons($('.mem', box), [2, 3, 4, 5, 6].map(x => ({ v: String(x), label: x + '명' })), '4', v => { members = +v; });
    const codeIn = $('.code', box), err = $('.err', box);
    async function loadSlots() {
      const c = codeIn.value.trim();
      if (!/^\d{4}$/.test(c)) { $('.tpick', box).innerHTML = ''; return; }
      const s = await f.D.get(r(f, `rooms/${c}`)).catch(() => null);
      const room = s && s.val();
      if (!room || !room.meta) { $('.tpick', box).innerHTML = '<p class="small" style="color:var(--bad)">이 방 코드가 없어요. 다시 확인해 주세요.</p>'; return; }
      const taken = room.teams || {};
      $('.tpick', box).innerHTML = `<b>${room.meta.cls}반 · 모둠 번호</b><div class="seg tsel"></div>`;
      const items = [];
      for (let i = 1; i <= room.meta.maxTeams; i++) items.push({ v: String(i), html: `${i}모둠${taken[i] && taken[i].uid !== me.uid ? ' <span class="small muted">(사용 중)</span>' : ''}` });
      segButtons($('.tsel', box), items, tSel, v => { tSel = v; });
    }
    codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.replace(/\D/g, ''); loadSlots(); });
    if (preCode) loadSlots();
    $('.go', box).addEventListener('click', async () => {
      unlock();
      const c = codeIn.value.trim(), nick = $('.nick', box).value.trim();
      if (!/^\d{4}$/.test(c)) return err.textContent = '방 코드 4자리를 입력해 주세요.';
      if (!tSel) return err.textContent = '모둠 번호를 골라 주세요.';
      if (nick && bad(nick)) return err.textContent = '바른 말로 별명을 지어 주세요.';
      try {
        await f.D.set(r(f, `rooms/${c}/teams/${tSel}`), { uid: me.uid, nick, members, at: f.serverNow() });
      } catch (e) { return err.textContent = '이 모둠은 다른 기기가 이미 사용 중이에요. 다른 번호를 고르거나 선생님께 말씀드려 주세요.'; }
      store(JOIN_KEY, { code: c, t: +tSel });
      sfx.join();
      enter(c, +tSel);
    });
  }

  function enter(c, tt) {
    code = c; t = tt; off();
    box.innerHTML = `
      <div class="row" style="justify-content:space-between">
        <h1 style="margin:0">🏁 <span class="me"></span></h1>
        <button class="btn ghost small leave">나가기</button>
      </div>
      <div class="stagebox"></div>`;
    $('.leave', box).addEventListener('click', async () => {
      const racing = runner && !runner.done && state?.phase === 'count';
      const yes = racing
        ? await confirmBox({ icon: '🚨', title: '지금 나가면 이번 라운드는 실패예요!', body: '레이스가 진행 중이에요. 나가면 우리 모둠 기록이 <b>❌ 실패(나감)</b>로 남고, 이번 라운드에는 다시 들어올 수 없어요.', ok: '그래도 나가기', cancel: '계속 도전하기', danger: true })
        : await confirmBox({ icon: '🚪', title: '대항전에서 나갈까요?', body: '모둠 자리가 비워져요. 지금까지의 기록은 남아요.', ok: '나가기', cancel: '취소' });
      if (!yes) return;
      if (racing) { const s = runner.snapshot(); s.quit = true; await new Promise(res => { push(playingRound, s, true); setTimeout(res, 400); }); }
      off(); runner?.destroy(); runner = null;
      await f.D.remove(r(f, `rooms/${code}/live/${t}`)).catch(() => {});
      await f.D.remove(r(f, `rooms/${code}/teams/${t}`)).catch(() => {});
      store(JOIN_KEY, null); joinForm();
    });
    unsub.push(f.D.onValue(r(f, `rooms/${code}/teams`), s => {
      teams = s.val() || {};
      if (!teams[t] || teams[t].uid !== me.uid) { // 선생님이 내보냈거나 자리를 잃음
        runner?.destroy(); runner = null; store(JOIN_KEY, null); off();
        return joinForm('모둠 자리가 비워졌어요. 다시 입장해 주세요.');
      }
      info = teams[t];
      $('.me', box).textContent = teamName(t, info.nick);
    }));
    unsub.push(f.D.onValue(r(f, `rooms/${code}/state`), s => { state = s.val() || { phase: 'lobby', round: 0 }; onState(); }));
    const liveOn = r(f, `rooms/${code}/live/${t}/on`);
    unsub.push(f.D.onValue(r(f, '.info/connected'), s => { if (s.val() === true) { f.D.onDisconnect(liveOn).set(false).catch(() => {}); f.D.get(r(f, `rooms/${code}/live/${t}`)).then(x => { if (x.exists()) f.D.set(liveOn, true).catch(() => {}); }).catch(() => {}); } }));
  }

  const stageBox = () => $('.stagebox', box);

  async function onState() {
    const st = state, sb = stageBox(); if (!sb) return;
    if (st.phase === 'lobby') { stopRunner(); sb.innerHTML = waitHtml('선생님이 라운드를 시작할 때까지 기다려요.', '그동안 모둠원끼리 누가 막대를 옮길지, 누가 규칙을 확인할지 정해 두세요!'); return; }
    if (st.phase === 'end') { stopRunner(); store(JOIN_KEY, null); sb.innerHTML = waitHtml('오늘 대항전이 끝났어요!', '수고했어요. 어떤 정렬 방법이 가장 효율적이었는지 이야기해 봐요.', '🎉'); return; }
    if (st.phase === 'pick') return showPick(st);
    if (st.phase === 'count') return play(st);
    if (st.phase === 'result') return showResult(st);
  }

  function waitHtml(title, sub, icon = '⏳') {
    const ic = icon === '⏳' ? '<div class="hourglass" aria-hidden="true">⏳</div>' : `<div style="font-size:3rem">${icon}</div>`;
    return `<div class="card" style="text-align:center;padding:36px 16px">${ic}<h2>${esc(title)}</h2><p class="muted">${esc(sub)}</p></div>`;
  }

  function stopRunner() { runner?.destroy(); runner = null; clearTimeout(pushTimer); }

  async function showPick(st) {
    stopRunner();
    const sb = stageBox();
    const mine = (await f.D.get(r(f, `rooms/${code}/pick/${st.round}/${t}`)).catch(() => null))?.val();
    sb.innerHTML = `<div class="card"><h2>🏆 결승: 우리 모둠의 정렬 방법을 골라요</h2>
      <p class="muted">막대 ${st.n}개를 가장 빨리 정렬할 수 있는 방법은? <b class="left"></b></p><div class="pk"></div>
      <p class="small muted">선택하지 않으면 버블 정렬로 출발해요.</p></div>`;
    segButtons($('.pk', sb), ALGO_KEYS.map(k => ({ v: k, html: `${ALGOS[k].icon} ${ALGOS[k].name}` })), mine, async v => {
      try { await f.D.set(r(f, `rooms/${code}/pick/${st.round}/${t}`), v); sfx.pop(); } catch (e) { toast('선택 시간이 끝났어요.', true); }
    });
    const left = $('.left', sb);
    const tick = () => { if (!left.isConnected) return; const s = Math.max(0, Math.ceil((st.pickUntil - f.serverNow()) / 1000)); left.textContent = `· 남은 시간 ${s}초`; if (s > 0) setTimeout(tick, 250); };
    tick();
  }

  // 선생님이 멈춘 시간을 뺀 기준 시각
  const effNow = () => { const st = state || {}; const n = f.serverNow(); return n - (st.pauseTotal || 0) - (st.pausedAt ? n - st.pausedAt : 0); };

  async function play(st) {
    if (playingRound === st.round && runner) { runner.setPaused(!!st.pausedAt); return; }
    stopRunner();
    const sb = stageBox();
    let algo = st.algo;
    if (algo === 'pick') algo = (await f.D.get(r(f, `rooms/${code}/pick/${st.round}/${t}`)).catch(() => null))?.val() || 'bubble';
    const prev = (await f.D.get(r(f, `rooms/${code}/prog/${st.round}/${t}`)).catch(() => null))?.val();
    if (prev && prev.done) return showMine(prev);
    if (prev && prev.quit) { stageBox().innerHTML = waitHtml('이번 라운드는 ❌ 실패(나감)로 기록됐어요.', '다음 라운드부터 다시 참여할 수 있어요. 잠시 기다려 주세요.'); return; }
    playingRound = st.round;
    const A = ALGOS[algo];
    sb.innerHTML = `<div class="rule" style="margin-top:0"><div class="big-ic">${A.icon}</div>
      <p><b style="font-family:var(--cute);font-size:1.25rem">${st.final ? '🏆 결승 · ' : ''}${st.round}라운드 · ${A.name}</b> <span class="small muted">막대 ${st.n}개</span></p>
      <p class="small">📏 ${esc(A.rule)}</p></div><div class="run"></div>`;
    const arr = makeArray(st.n, st.seed);
    runner = createRunner($('.run', sb), {
      algo, arr, members: info?.members || 4, relay: !!st.relay, hint: false, startAt: st.startAt, now: effNow,
      onStep: s => push(st.round, s),
      onDone: s => { push(st.round, s, true); setTimeout(() => showMine(s), 900); },
    });
    if (f.serverNow() < st.startAt && cdShown !== st.round) { cdShown = st.round; countdown(st.startAt, () => f.serverNow()); }
    if (st.pausedAt) runner.setPaused(true);
    push(st.round, runner.snapshot(), true);
  }

  // 진행 상황 보내기 (최대 초당 3번, 끝났을 때는 바로)
  let sentDone = -1;
  function push(round, s, now = false) {
    if (sentDone === round) return; // 완주 기록을 보낸 뒤에는 더 보내지 않아요(규칙상 거부됨)
    if (s.done) { sentDone = round; now = true; }
    const write = () => {
      lastPush = Date.now();
      f.D.set(r(f, `rooms/${code}/prog/${round}/${t}`), { algo: s.algo, pct: s.pct, ms: s.ms, score: s.score, miss: s.miss, cmp: s.cmp, moves: s.moves, done: !!s.done, nick: info?.nick || '', ...(s.quit ? { quit: true } : {}) }).catch(() => {});
      if (s.view) f.D.set(r(f, `rooms/${code}/live/${t}`), { r0: s.view.r0, r0x: s.view.r0x, r1: s.view.r1, n: s.view.n, who: s.who || 1, ev: s.ev || '', on: true, round, at: f.serverNow() }).catch(() => {});
    };
    clearTimeout(pushTimer);
    if (now || Date.now() - lastPush > 330) write(); else pushTimer = setTimeout(write, 330);
  }

  function showMine(s) {
    if (!stageBox()) return;
    stopRunner();
    stageBox().innerHTML = `<div class="card" style="text-align:center;padding:28px 16px"><div style="font-size:3rem">🏁</div>
      <h2>완주! 기록 ${fmt(s.score)}</h2><p class="muted">시간 ${fmt(s.ms)} + 위반 ${s.miss}회 × 3초 · 비교 ${s.cmp}번 · 이동 ${s.moves}번</p>
      <p>다른 모둠이 끝날 때까지 기다려요. 순위는 선생님 화면에 나와요! 📺</p></div>`;
  }

  async function showResult(st) {
    stopRunner();
    const p = (await f.D.get(r(f, `rooms/${code}/prog/${st.round}`)).catch(() => null))?.val() || {};
    const rows = rank(teams, p), mine = rows.find(x => x.t === t);
    stageBox().innerHTML = `<div class="card" style="text-align:center"><div style="font-size:3rem">${mine?.place === 1 ? '🥇' : mine?.place === 2 ? '🥈' : mine?.place === 3 ? '🥉' : '🏅'}</div>
      <h2>${st.round}라운드 결과: ${mine?.place ? mine.place + '위' : '미완주'}</h2>
      ${mine?.done ? `<p class="muted">기록 ${fmt(mine.score)} · 비교 ${mine.cmp}번</p>` : ''}
      <p class="small muted">다음 라운드를 기다려요.</p></div>`;
    if (mine?.place === 1) sfx.fanfare();
  }

  const beforeUnload = e => { if (runner && !runner.done && state?.phase === 'count') { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);
  start();
  return { destroy() { window.removeEventListener('beforeunload', beforeUnload); off(); stopRunner(); } };
}
