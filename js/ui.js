// 작은 화면 도우미 모음
import { sfx } from './sound.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = ms => { ms = Math.max(0, ms); const s = ms / 1000; return s < 60 ? s.toFixed(1) + '초' : Math.floor(s / 60) + '분 ' + (s % 60).toFixed(1).padStart(4, '0') + '초'; };
export const PENALTY = 3000; // 위반 1회당 3초

let toastTimer = null;
export function toast(msg, bad = false, ms = 2200) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.toggle('bad', bad); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

export function overlay(html, cls = '') {
  const o = document.createElement('div');
  o.className = 'overlay ' + cls;
  o.innerHTML = `<div class="box pop">${html}</div>`;
  document.body.appendChild(o);
  return o;
}

// 3·2·1·출발! targetTime(ms, 기준 시계)까지 기다리며 표시해요. now()는 기준 시계 함수.
export function countdown(targetTime, now = () => Date.now()) {
  return new Promise(res => {
    const o = overlay('<div class="huge">3</div><p class="muted">준비!</p>');
    const big = o.querySelector('.huge');
    let last = null;
    const loop = () => {
      const left = targetTime - now();
      if (left <= 0) {
        big.textContent = '출발!'; sfx.go();
        setTimeout(() => o.remove(), 450);
        return res();
      }
      const n = Math.ceil(left / 1000);
      if (n !== last && n <= 3) { last = n; big.textContent = n; big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop'); sfx.tick(); }
      requestAnimationFrame(loop);
    };
    loop();
  });
}

export function store(key, val) {
  try {
    if (val === undefined) { const v = localStorage.getItem(key); return v == null ? null : JSON.parse(v); }
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) { return null; }
}

export function segButtons(el, items, value, onPick) {
  el.classList.add('seg');
  el.innerHTML = items.map(it => `<button type="button" data-v="${esc(it.v)}" aria-pressed="${it.v === value}">${it.html ?? esc(it.label)}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    onPick(b.dataset.v);
  }));
}
