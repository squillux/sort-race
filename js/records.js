// 반별 기록 · 학년 명예의 전당 · CSV 내려받기 (교사 전용)
import { ALGOS } from './sorts.js';
import { connect, ready, isAdmin, r, teamName } from './net.js';
import { $, esc, fmt, toast, segButtons } from './ui.js';

export function mountRecords(root) {
  let f = null, all = {}, view = 'class', cls = 1;
  root.innerHTML = '<div class="rec"><p class="muted">🔌 불러오는 중...</p></div>';
  const box = $('.rec', root);

  async function start() {
    try { f = await connect(); } catch (e) { box.innerHTML = `<div class="card"><h2>⚠ 서버에 연결할 수 없어요</h2><p class="small mono">${esc(e.message)}</p></div>`; return; }
    const me = await ready(f);
    if (!me || me.isAnonymous || !(await isAdmin(f, me.uid))) { box.innerHTML = `<div class="card"><h2>🔐 교사만 볼 수 있어요</h2><p><a class="btn" href="#/host">교사용 화면에서 로그인하기</a></p></div>`; return; }
    await load();
  }
  async function load() {
    const s = await f.D.get(r(f, 'records')).catch(e => { toast(e.message, true); return null; });
    all = (s && s.val()) || {};
    const withData = Object.keys(all).map(Number).sort((a, b) => a - b);
    if (withData.length && !all[cls]) cls = withData[0];
    paint();
  }

  // 모든 기록을 한 줄씩 펼치기
  function flat() {
    const out = [];
    for (const [c, sessions] of Object.entries(all)) for (const [rid, se] of Object.entries(sessions || {})) for (const [rd, ro] of Object.entries(se.rounds || {})) for (const [t, x] of Object.entries(ro.results || {}))
      out.push({ cls: +c, rid, date: se.date, code: se.code, round: +rd, final: !!ro.final, n: ro.n, arr: ro.arr || '', roundAlgo: ro.algo, t: +t, ...x });
    return out;
  }

  function paint() {
    box.innerHTML = `<div class="row" style="justify-content:space-between"><h1>📒 대항전 기록</h1><div class="row"><a class="btn ghost small" href="#/host">📺 교사 화면</a><button class="btn sub small csv">⬇ CSV 내려받기</button></div></div>
      <div class="seg tabs"></div><div class="body"></div>`;
    segButtons($('.tabs', box), [{ v: 'class', label: '🏫 반별 기록' }, { v: 'hall', label: '🏆 학년 명예의 전당' }], view, v => { view = v; body(); });
    $('.csv', box).addEventListener('click', csv);
    body();
  }

  function body() {
    const b = $('.body', box);
    if (view === 'hall') return hall(b);
    b.innerHTML = `<div class="card"><div class="cl"></div><div class="list" style="margin-top:12px"></div></div>`;
    segButtons($('.cl', b), Array.from({ length: 12 }, (_, i) => ({ v: String(i + 1), html: `${i + 1}반${all[i + 1] ? ' ●' : ''}` })), String(cls), v => { cls = +v; list(); });
    list();
  }

  function list() {
    const el = $('.body .list', box), sessions = Object.entries(all[cls] || {}).sort((a, b) => b[0].localeCompare(a[0]));
    if (!sessions.length) { el.innerHTML = `<p class="muted">${cls}반 기록이 아직 없어요.</p>`; return; }
    el.innerHTML = sessions.map(([rid, se]) => `<div class="card" style="background:var(--bg)">
      <div class="row" style="justify-content:space-between"><h3 style="margin:0">📅 ${esc(se.date)} <span class="small muted">방 ${esc(se.code)}</span></h3><button class="btn ghost small del" data-rid="${esc(rid)}">🗑 삭제</button></div>
      ${Object.entries(se.rounds || {}).sort((a, b) => a[0] - b[0]).map(([rd, ro]) => {
        const res = Object.entries(ro.results || {}).map(([t, x]) => ({ t: +t, ...x })).sort((a, b) => (a.place || 99) - (b.place || 99));
        return `<p style="margin:10px 0 4px"><b>${ro.final ? '🏆 결승' : rd + '라운드'}</b> · ${ro.algo === 'pick' ? '모둠별 선택' : esc(ALGOS[ro.algo]?.name || ro.algo)} · 막대 ${ro.n}개</p>
        <div class="scroll-x"><table class="t"><tr><th>순위</th><th>모둠</th><th>방법</th><th>기록</th><th>위반</th><th>비교</th></tr>
        ${res.map(x => `<tr><td>${x.place ? x.place + '위' : '미완주'}</td><td>${esc(teamName(x.t, x.nick))}</td><td>${esc(ALGOS[x.algo]?.short || '')}</td><td>${x.done ? fmt(x.score) : x.pct + '%'}</td><td>${x.miss}</td><td>${x.cmp}</td></tr>`).join('')}</table></div>`;
      }).join('')}</div>`).join('');
    el.querySelectorAll('.del').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('이 수업의 기록을 삭제할까요? 되돌릴 수 없어요.')) return;
      await f.D.remove(r(f, `records/${cls}/${btn.dataset.rid}`)); toast('삭제했어요.'); load();
    }));
  }

  function hall(b) {
    const rows = flat().filter(x => x.done);
    const groups = {};
    for (const x of rows) { const k = `${x.algo}|${x.n}`; (groups[k] ||= []).push(x); }
    const keys = Object.keys(groups).sort();
    if (!keys.length) { b.innerHTML = '<div class="card"><p class="muted">아직 완주 기록이 없어요.</p></div>'; return; }
    b.innerHTML = `<p class="muted">정렬 방법과 막대 수별로 학년 전체 상위 기록과 반별 최고 기록을 보여 줘요.</p>` + keys.map(k => {
      const [algo, n] = k.split('|'), g = groups[k].sort((a, b) => a.score - b.score);
      const best = {}; for (const x of g) if (!best[x.cls]) best[x.cls] = x;
      const top = g.slice(0, 5);
      const clsRank = Object.values(best).sort((a, b) => a.score - b.score);
      const max = clsRank.length ? clsRank[clsRank.length - 1].score : 1;
      return `<div class="card"><h2>${ALGOS[algo]?.icon || ''} ${esc(ALGOS[algo]?.name || algo)} · 막대 ${n}개</h2>
        <div class="podium">${top.slice(0, 3).map((x, i) => `<div class="pd p${i + 1}"><div class="md">${['🥇', '🥈', '🥉'][i]}</div><b>${x.cls}반 ${esc(teamName(x.t, x.nick))}</b><span class="mono">${fmt(x.score)}</span><small class="muted">${esc(x.date)}</small></div>`).join('')}</div>
        <h3>🏫 반별 최고 기록</h3>
        ${clsRank.map(x => `<div class="cmpbar"><span>${x.cls}반</span><i style="width:${Math.max(3, x.score / max * 70)}%;background:var(--mint)"></i><em>${fmt(x.score)} · ${esc(teamName(x.t, x.nick))}</em></div>`).join('')}</div>`;
    }).join('');
  }

  function csv() {
    const rows = flat();
    if (!rows.length) return toast('내려받을 기록이 없어요.');
    const head = ['반', '날짜', '방코드', '라운드', '결승', '라운드방법', '막대수', '배열', '모둠', '별명', '모둠방법', '순위', '완주', '기록(초)', '시간(초)', '위반', '비교', '이동', '진행률'];
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head.map(q).join(',')].concat(rows.sort((a, b) => a.cls - b.cls || a.date.localeCompare(b.date) || a.round - b.round || (a.place || 99) - (b.place || 99))
      .map(x => [x.cls, x.date, x.code, x.round, x.final ? 'O' : '', x.roundAlgo, x.n, x.arr, x.t, x.nick, ALGOS[x.algo]?.name || x.algo, x.place || '', x.done ? 'O' : 'X', (x.score / 1000).toFixed(1), (x.ms / 1000).toFixed(1), x.miss, x.cmp, x.moves, x.pct].map(q).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `막대정렬레이스_기록_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  start();
  return { destroy() {} };
}
