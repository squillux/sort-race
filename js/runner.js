// 게임 진행기: 보드 + 시간 + 벌점 + 릴레이 + 효과음을 묶어요. (연습하기·대항전 공통)
import { createGame } from './sorts.js';
import { createBoard, missText } from './board.js';
import { sfx } from './sound.js';
import { $, fmt, toast, overlay, PENALTY } from './ui.js';

export const RELAY_EVERY = 5;

export function createRunner(root, { algo, arr, members = 4, hint = false, now = () => performance.now(), startAt = null, onStep, onDone }) {
  root.innerHTML = `
    <div class="hud">
      <div class="m time"><small>⏱ 시간</small><b class="t">0.0초</b></div>
      <div class="m miss"><small>❌ 위반(+3초)</small><b class="mi">0</b></div>
      <div class="m"><small>🔍 비교</small><b class="cp">0</b></div>
      <div class="m"><small>↔ 이동</small><b class="mv">0</b></div>
      <div class="m"><small>🎮 차례</small><b class="who">1번</b></div>
    </div>
    <div class="progress"><i style="width:0%"></i></div>
    <div class="bd"></div>`;
  const game = createGame(algo, arr);
  let t0 = startAt ?? now(), raf = 0, endMs = null, actions = 0, who = 1, relayLock = false, stopped = false;
  const board = createBoard($('.bd', root), { onAction });
  const el = { t: $('.t', root), mi: $('.mi', root), cp: $('.cp', root), mv: $('.mv', root), who: $('.who', root), pr: $('.progress i', root) };

  function elapsed() { return endMs ?? Math.max(0, now() - t0); }
  function score() { return elapsed() + game.c.miss * PENALTY; }
  function paint() {
    el.t.textContent = fmt(elapsed());
    el.mi.textContent = game.c.miss; el.cp.textContent = game.c.cmp; el.mv.textContent = game.c.moves;
    el.who.textContent = members > 1 ? who + '번' : '-';
    el.pr.style.width = Math.round(game.progress() * 100) + '%';
  }
  // 출발 시각 전에는 막대를 잠가 둬요(카운트다운 중).
  let started = now() >= t0;
  function tick() {
    if (stopped) return;
    if (!started && now() >= t0) { started = true; board.setLocked(false); }
    el.t.textContent = fmt(elapsed()); raf = requestAnimationFrame(tick);
  }

  function onAction(x) {
    if (relayLock || stopped || !started) return;
    const r = game.apply(x);
    if (!r.ok) {
      sfx.buzz(); board.shake();
      toast('❌ 규칙 위반 +3초 · ' + missText(game, r.expected), true, 2600);
    } else {
      if (r.ev.includes('lock') || r.ev.includes('merged')) sfx.ding(); else if (r.ev.includes('keep')) sfx.keep(); else sfx.pop();
      actions++;
    }
    board.render(game, { hint });
    paint();
    onStep?.(snapshot());
    if (r.done) return finish();
    if (r.ok && members > 1 && actions % RELAY_EVERY === 0) relay();
  }

  function relay() {
    who = who % members + 1; paint();
    relayLock = true; board.setLocked(true); sfx.relay();
    const o = overlay(`<div class="huge">다음 사람!</div><p style="font-size:1.4rem;margin:.2em 0 0">🎮 <b>${who}번</b> 차례예요</p>`, 'relay');
    setTimeout(() => { o.remove(); relayLock = false; board.setLocked(false); }, 1100);
  }

  function finish() {
    endMs = Math.max(0, now() - t0); stopped = true; cancelAnimationFrame(raf);
    sfx.fanfare(); paint(); board.setLocked(true);
    onDone?.(snapshot());
  }

  function snapshot() {
    return { algo, done: game.done, ms: Math.round(elapsed()), score: Math.round(score()), miss: game.c.miss, cmp: game.c.cmp, moves: game.c.moves, pct: Math.round(game.progress() * 100) };
  }

  board.render(game, { hint }); paint();
  if (!started) board.setLocked(true);
  tick();
  let hintUsed = !!hint;
  return {
    game, snapshot,
    get hintUsed() { return hintUsed; },
    setHint(v) { hint = v; if (v) hintUsed = true; board.render(game, { hint }); },
    stop() { stopped = true; cancelAnimationFrame(raf); board.setLocked(true); },
    destroy() { stopped = true; cancelAnimationFrame(raf); board.destroy(); root.innerHTML = ''; },
  };
}
