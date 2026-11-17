// 막대 보드: 게임 상태를 그리고, 클릭을 조작(action)으로 바꿔 알려 줘요.
// 막대는 값(서로 다름)을 키로 재사용하고 위치만 바꿔서 CSS 전환으로 움직여요.
import { ALGOS } from './sorts.js';

export function createBoard(root, { onAction }) {
  root.classList.add('board');
  root.innerHTML = `
    <div class="stage"><div class="zones"></div><div class="bars"></div><div class="slots"></div></div>
    <div class="ctrl"></div>`;
  const stage = root.querySelector('.stage'), zones = root.querySelector('.zones'),
    barsEl = root.querySelector('.bars'), slotsEl = root.querySelector('.slots'), ctrl = root.querySelector('.ctrl');
  const els = new Map();
  let game = null, opts = {}, locked = false;

  function barEl(v) {
    let b = els.get(v);
    if (!b) {
      b = document.createElement('button');
      b.type = 'button'; b.className = 'bar'; b.dataset.v = v;
      b.innerHTML = `<span class="fill" style="height:${14 + v * 0.86}%"></span><span class="num">${v}</span>`;
      b.addEventListener('click', () => clickBar(v));
      barsEl.appendChild(b); els.set(v, b);
    }
    return b;
  }

  function act(x) { if (!locked && game && !game.done) onAction(x); }

  function clickBar(v) {
    if (!game || game.done) return;
    const vw = game.view(), a = game.a, i = a.indexOf(v);
    if (vw.kind === 'selection') { if (i >= vw.lo) act({ t: 'pick', i }); }
    else if (vw.kind === 'merge') {
      if (i === vw.li && vw.li < vw.mid) act({ t: 'take', side: 'L' });
      else if (i === vw.ri && vw.ri < vw.hi) act({ t: 'take', side: 'R' });
    } else if (vw.kind === 'bubble' && vw.pair && (i === vw.pair[0] || i === vw.pair[1])) {
      // 막대를 눌러도 바꾸기로 처리하면 실수가 잦아서, 버블은 버튼으로만 조작해요.
      root.querySelector('.ctrl .hint-line')?.classList.add('blink');
      setTimeout(() => root.querySelector('.ctrl .hint-line')?.classList.remove('blink'), 600);
    }
  }

  function render(g, o = {}) {
    game = g; opts = o;
    const a = g.a, n = a.length, vw = g.view(), hint = o.hint ? g.expected() : null;
    const twoRows = vw.kind === 'merge';
    stage.classList.toggle('two', twoRows);
    stage.style.setProperty('--n', n);
    const W = 100 / n;
    zones.innerHTML = ''; slotsEl.innerHTML = '';
    const zone = (from, to, cls, label) => {
      if (to <= from) return;
      const z = document.createElement('div');
      z.className = 'zone ' + cls; z.style.left = from * W + '%'; z.style.width = (to - from) * W + '%';
      if (label) z.innerHTML = `<span>${label}</span>`;
      zones.appendChild(z);
    };

    // 각 막대의 위치(x, row)와 상태 클래스 계산
    const pos = new Map();
    a.forEach((v, i) => pos.set(v, { x: i, row: 0, cls: [] }));
    if (vw.kind === 'bubble') {
      if (vw.lockedFrom < n) zone(vw.lockedFrom, n, 'z-lock', '고정');
      a.forEach((v, i) => { if (i >= vw.lockedFrom) pos.get(v).cls.push('locked'); });
      if (vw.pair) vw.pair.forEach(i => pos.get(a[i]).cls.push('active'));
      if (g.done) a.forEach(v => pos.get(v).cls.push('locked'));
    } else if (vw.kind === 'selection') {
      zone(vw.lo, n, 'z-open', g.done ? '' : '정리 안 된 구역');
      a.forEach((v, i) => { if (i < vw.lockedBefore || g.done) pos.get(v).cls.push('locked'); else pos.get(v).cls.push('pickable'); });
      if (hint) pos.get(a[hint.i]).cls.push('hint');
    } else if (vw.kind === 'insertion') {
      zone(0, vw.sortedUpTo, 'z-sorted', '정리된 구역');
      a.forEach((v, i) => {
        if (i < vw.sortedUpTo || g.done) pos.get(v).cls.push('sorted');
        if (!g.done && i === vw.k) pos.get(v).cls.push('key');
      });
      if (!g.done) {
        for (let s = 0; s <= vw.k; s++) {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'slot' + (hint && hint.s === s ? ' hint' : '');
          b.style.left = s * W + '%'; b.textContent = '▼';
          b.title = s === vw.k ? '이 자리 그대로' : `${s + 1}번째 자리에 끼우기`;
          b.addEventListener('click', () => act({ t: 'slot', s }));
          slotsEl.appendChild(b);
        }
      }
      if (g.done) a.forEach(v => pos.get(v).cls.push('locked'));
    } else if (vw.kind === 'merge') {
      if (g.done) a.forEach(v => pos.get(v).cls.push('locked'));
      else {
        // 현재 단계의 묶음 경계 표시
        for (let s = 0; s < n; s += vw.w) zone(s, Math.min(s + vw.w, n), 'z-group');
        zone(vw.lo, vw.mid, 'z-left', '왼쪽 묶음');
        zone(vw.mid, vw.hi, 'z-right', '오른쪽 묶음');
        for (let i = vw.lo; i < vw.li; i++) pos.delete(a[i]);
        for (let i = vw.mid; i < vw.ri; i++) pos.delete(a[i]);
        vw.out.forEach((v, k) => pos.set(v, { x: vw.lo + k, row: 1, cls: ['out'] }));
        if (vw.li < vw.mid) pos.get(a[vw.li]).cls.push('head', 'head-l');
        if (vw.ri < vw.hi) pos.get(a[vw.ri]).cls.push('head', 'head-r');
        if (hint) pos.get(a[hint.side === 'L' ? vw.li : vw.ri]).cls.push('hint');
        for (let i = vw.lo; i < vw.hi; i++) if (pos.has(a[i]) && pos.get(a[i]).row === 0 && !pos.get(a[i]).cls.length) pos.get(a[i]).cls.push('dim0');
      }
    }

    // 사용하지 않는 막대 제거(새 게임일 때)
    for (const [v, b] of els) if (!a.includes(v)) { b.remove(); els.delete(v); }
    for (const v of a) {
      const p = pos.get(v), b = barEl(v);
      b.style.left = p.x * W + '%'; b.style.width = W + '%';
      b.dataset.row = p.row;
      b.className = 'bar ' + p.cls.join(' ');
      b.tabIndex = (p.cls.includes('pickable') || p.cls.includes('head')) ? 0 : -1;
    }

    // 조작 영역
    const info = ALGOS[g.algo];
    if (g.done) ctrl.innerHTML = `<p class="hint-line done">🎉 정렬 완료!</p>`;
    else if (vw.kind === 'bubble') {
      ctrl.innerHTML = `<div class="btns">
        <button type="button" class="big swap ${hint && hint.swap ? 'hint' : ''}" data-s="1">🔄 바꾸기</button>
        <button type="button" class="big keep ${hint && !hint.swap ? 'hint' : ''}" data-s="0">✋ 그대로</button></div>
        <p class="hint-line">${vw.pass}번째 바퀴 · 노란 두 막대 중 앞이 더 크면 바꿔요.</p>`;
      ctrl.querySelectorAll('.btns button').forEach(b => b.addEventListener('click', () => act({ t: 'bubble', swap: b.dataset.s === '1' })));
    } else ctrl.innerHTML = `<p class="hint-line">${info.how}</p>`;
  }

  // 키보드: 버블은 ← 바꾸기, → 그대로 (모둠이 한 기기를 돌려 쓸 때 편해요)
  function onKey(e) {
    if (!game || game.done || game.view().kind !== 'bubble') return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); act({ t: 'bubble', swap: true }); }
    if (e.key === 'ArrowRight') { e.preventDefault(); act({ t: 'bubble', swap: false }); }
  }
  document.addEventListener('keydown', onKey);

  return {
    render,
    shake() { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); },
    setLocked(v) { locked = v; root.classList.toggle('frozen', v); },
    destroy() { document.removeEventListener('keydown', onKey); root.innerHTML = ''; els.clear(); },
  };
}

// 실수했을 때 보여 줄 짧은 설명
export function missText(g, exp) {
  const a = g.a, vw = g.view();
  switch (exp.t) {
    case 'bubble': return exp.swap ? `${a[vw.pair[0]]}이(가) ${a[vw.pair[1]]}보다 커요 → 바꿔야 해요.` : `${a[vw.pair[0]]}이(가) ${a[vw.pair[1]]}보다 작아요 → 그대로 둬요.`;
    case 'pick': return `정리 안 된 구역에서 가장 작은 막대는 ${a[exp.i]}이에요.`;
    case 'slot': return `${a[vw.k]}보다 작은 막대가 ${exp.s}개 있어요 → ${exp.s + 1}번째 자리예요.`;
    case 'take': { const l = a[vw.li], r = a[vw.ri]; return `왼쪽 맨 앞 ${l}, 오른쪽 맨 앞 ${r} 중 더 작은 ${Math.min(l, r)}을(를) 내려요.`; }
  }
  return '';
}
