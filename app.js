/* Tribunal de Grados — Club Karate Swing
   Evaluación de exámenes CN, 1r Dan y 2º Dan con las reglas del club y el acta FCK.
   Los datos se guardan solo en este dispositivo (localStorage). */

const VERSION = '1.0';
const KEY = 'grados-v1';

/* ---------- reglas ---------- */
const GRADES = {
  CN: { label: 'Cinturón Negro', short: 'CN', min: 12 },
  '1D': { label: '1r Dan', short: '1r Dan', min: 12 },
  '2D': { label: '2º Dan', short: '2º Dan', min: 14 },
};
const WAZA = [
  ['dachi', 'Dachi'], ['tsuki', 'Tsuki'], ['uchi', 'Uchi'],
  ['geri', 'Geri'], ['uke', 'Uke'], ['renzoku', 'Renzoku'],
];
const SCORE_KEYS = ['dachi', 'tsuki', 'uchi', 'geri', 'uke', 'renzoku', 'kata1', 'kata2', 'ippon', 'sambon', 'bunkai', 'yakusoku'];
const TEO = [
  { v: 0, label: 'Mal', adj: -1 },
  { v: 5, label: 'Normal', adj: 0 },
  { v: 10, label: 'Bien', adj: 1 },
];

// '' → null, número 0-10 → número, cualquier otra cosa → NaN
function num(v) {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : NaN;
}
function avg(vals) {
  if (vals.some(v => Number.isNaN(v))) return NaN;
  if (vals.some(v => v == null)) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
const ok = v => v != null && !Number.isNaN(v);
// Redondeo al entero más cercano, ,5 hacia arriba (con tolerancia de coma flotante)
const roundHalfUp = x => Math.floor(x + 0.5 + 1e-9);

function calc(c) {
  const s = c.scores || {};
  const g = GRADES[c.grade] || GRADES.CN;
  const mW = avg(WAZA.map(([k]) => num(s[k])));
  const mK = avg([num(s.kata1), num(s.kata2)]);
  const mIS = avg([num(s.ippon), num(s.sambon)]);
  const bunkai = num(s.bunkai);
  const yak = num(s.yakusoku);

  const r1 = ok(mW) && ok(mK) ? mW + mK : null;
  const r2 = ok(mIS) && ok(bunkai) ? mIS + bunkai : null;
  const r3 = ok(yak) ? yak * 2 : null;
  const base = [r1, r2, r3].map(r => (r == null ? null : Math.min(20, roundHalfUp(r))));

  const complete = base.every(v => v != null);
  const apto = complete && base.every(v => v >= g.min);
  const teo = TEO.find(t => t.v === c.teorica);
  const adj = teo ? teo.adj : 0;
  // La teórica solo se aplica a los APTO, sin pasar de 20 ni bajar del mínimo del grado
  const acta = base.map(v => (v == null ? null : apto ? Math.max(g.min, Math.min(20, v + adj)) : v));
  const total = complete ? acta.reduce((a, b) => a + b, 0) : null;
  const invalid = SCORE_KEYS.some(k => Number.isNaN(num(s[k])));
  const filled = SCORE_KEYS.filter(k => ok(num(s[k]))).length;

  return { g, mW, mK, mIS, raw: [r1, r2, r3], base, acta, total, complete, apto, teo, adj, invalid, filled };
}

/* ---------- estado ---------- */
let S = load();
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.exams)) return { settings: {}, ...d };
  } catch (e) { /* datos dañados o sin acceso */ }
  return { exams: [], settings: {} };
}
let saveTimer = null;
function save(now) {
  clearTimeout(saveTimer);
  const doSave = () => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('No se ha podido guardar en el dispositivo'); }
  };
  if (now) doSave(); else saveTimer = setTimeout(doSave, 250);
  if (!S.settings.persistAsked && navigator.storage && navigator.storage.persist) {
    S.settings.persistAsked = true;
    navigator.storage.persist().catch(() => {});
  }
}
window.addEventListener('pagehide', () => save(true));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(true); });

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const findExam = id => S.exams.find(e => e.id === id);
const touch = ex => { ex.updatedAt = Date.now(); };

/* ---------- utilidades ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
function fmt(n, dec = 2) {
  if (n == null || Number.isNaN(n)) return '';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(dec).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}
function fmtDate(iso) {
  if (!iso) return 'Sin fecha';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function longDate(iso) {
  if (!iso) return 'Sin fecha';
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) { return fmtDate(iso); }
}
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
const ICON = {
  back: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  print: '<svg viewBox="0 0 24 24"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
};
function statusBadge(r) {
  if (r.invalid) return '<span class="badge ko">Revisar</span>';
  if (!r.complete) return `<span class="badge">${r.filled}/12</span>`;
  return r.apto ? '<span class="badge ok">APTO</span>' : '<span class="badge ko">NO APTO</span>';
}

/* ---------- router ---------- */
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  document.querySelectorAll('#tabbar .tab').forEach(t => {
    const tab = t.dataset.tab;
    t.classList.toggle('active', tab === '' ? (!parts[0] || parts[0] === 'examen') : parts[0] === tab);
  });
  const main = $('#main');
  if (parts[0] === 'examen' && parts[2] === 'asp') renderCandidate(main, parts[1], parts[3]);
  else if (parts[0] === 'examen') renderExam(main, parts[1]);
  else if (parts[0] === 'buscar') renderSearch(main);
  else if (parts[0] === 'ajustes') renderSettings(main);
  else renderHome(main);
}
const go = h => { if (location.hash === h) route(); else location.hash = h; };
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
document.querySelectorAll('#tabbar .tab').forEach(t => t.addEventListener('click', () => go('#/' + t.dataset.tab)));

/* ---------- pantalla: exámenes ---------- */
function needsBackup() {
  if (!S.exams.length) return false;
  const last = S.settings.lastBackup || 0;
  return S.exams.some(e => (e.updatedAt || 0) > last);
}
function backupBanner() {
  if (!needsBackup()) return '';
  return `<div class="banner"><span>Hay cambios sin copia de seguridad.</span><button data-act="backup-csv">Exportar</button></div>`;
}
function renderHome(main) {
  const exams = [...S.exams].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
  const rows = exams.map(e => {
    const rs = e.candidates.map(calc);
    const aptos = rs.filter(r => r.apto).length;
    const n = e.candidates.length;
    return `<button class="row" data-go="#/examen/${e.id}">
      <div class="main">
        <div class="title">${esc(fmtDate(e.date))}${e.place ? ' · ' + esc(e.place) : ''}</div>
        <div class="meta">${n} aspirante${n === 1 ? '' : 's'}${n ? ` · ${aptos} apto${aptos === 1 ? '' : 's'}` : ''}${e.judge ? ' · ' + esc(e.judge) : ''}</div>
      </div>${ICON.chev}</button>`;
  }).join('');
  main.innerHTML = `
    <h1>Exámenes</h1>
    <p class="subtitle">Tribunal de grados · Club Karate Swing</p>
    ${backupBanner()}
    <button class="btn primary" data-act="new-exam">${ICON.plus}Nuevo examen</button>
    ${rows ? `<div class="list">${rows}</div>` : `<div class="empty">Aún no hay exámenes.<br>Crea uno para empezar a puntuar.</div>`}
  `;
}

/* ---------- pantalla: examen ---------- */
function renderExam(main, id) {
  const ex = findExam(id);
  if (!ex) return go('#/');
  const rows = ex.candidates.map(c => {
    const r = calc(c);
    const parts = r.complete ? `A1 ${r.acta[0]} · A2 ${r.acta[1]} · A3 ${r.acta[2]}` : 'Sin terminar';
    return `<button class="row" data-go="#/examen/${ex.id}/asp/${c.id}">
      <div class="main">
        <div class="title">${esc(c.name) || '<span class="muted">Sin nombre</span>'}</div>
        <div class="meta"><span class="badge grade">${esc(GRADES[c.grade].short)}</span> &nbsp;${parts}</div>
      </div>
      ${r.complete ? `<div class="score">${r.total}</div>` : ''}
      ${statusBadge(r)}${ICON.chev}</button>`;
  }).join('');
  main.innerHTML = `
    <button class="back-pill" data-go="#/">${ICON.back}Exámenes</button>
    <h1>${esc(fmtDate(ex.date))}</h1>
    <p class="subtitle">${esc(longDate(ex.date))}</p>
    <div class="card">
      <div class="field"><label>Fecha</label><input class="input" type="date" data-ex="date" value="${esc(ex.date)}"></div>
      <div class="field"><label>Lugar</label><input class="input" data-ex="place" value="${esc(ex.place)}" placeholder="Dojo, ciudad"></div>
      <div class="field" style="margin-bottom:0"><label>Juez del tribunal</label><input class="input" data-ex="judge" value="${esc(ex.judge)}" placeholder="Nombre"></div>
    </div>
    <h2>Aspirantes</h2>
    ${rows ? `<div class="list">${rows}</div>` : `<div class="empty">Añade a los aspirantes de este examen.</div>`}
    <button class="btn primary" data-act="add-cand">${ICON.plus}Añadir aspirante</button>
    <div class="btn-row">
      <button class="btn" data-act="print">${ICON.print}Imprimir hoja</button>
      <button class="btn" data-act="csv-exam">${ICON.share}Exportar</button>
    </div>
    <button class="btn danger" data-act="del-exam">${ICON.trash}Borrar examen</button>
  `;
  main.querySelectorAll('[data-ex]').forEach(inp => inp.addEventListener('input', () => {
    ex[inp.dataset.ex] = inp.value;
    if (inp.dataset.ex === 'place') S.settings.lastPlace = inp.value;
    if (inp.dataset.ex === 'judge') S.settings.lastJudge = inp.value;
    if (inp.dataset.ex === 'date') {
      $('h1', main).textContent = fmtDate(inp.value);
      $('.subtitle', main).textContent = longDate(inp.value);
    }
    touch(ex); save();
  }));
  main.dataset.exam = ex.id;
}

/* ---------- pantalla: aspirante ---------- */
function scoreCell(k, label, c) {
  const v = c.scores[k];
  return `<div class="sc" data-cell="${k}"><label>${esc(label)}</label><input inputmode="decimal" enterkeyhint="next" autocomplete="off" data-sc="${k}" value="${esc(v == null ? '' : String(v).replace('.', ','))}" placeholder="–"></div>`;
}
function renderCandidate(main, exId, cId) {
  const ex = findExam(exId);
  const c = ex && ex.candidates.find(x => x.id === cId);
  if (!c) return go(ex ? '#/examen/' + exId : '#/');
  const idx = ex.candidates.indexOf(c);
  const next = ex.candidates[idx + 1];

  main.innerHTML = `
    <button class="back-pill" data-go="#/examen/${ex.id}">${ICON.back}${esc(fmtDate(ex.date))}</button>
    <div class="field"><input class="input big" data-f="name" value="${esc(c.name)}" placeholder="Nombre y apellidos" autocomplete="off"></div>
    <div class="seg" id="grade" style="margin-bottom:16px">
      ${Object.entries(GRADES).map(([k, g]) => `<button data-grade="${k}" class="${c.grade === k ? 'on' : ''}">${esc(g.short)}</button>`).join('')}
    </div>

    <div class="card">
      <h3>1r apartado · Técnica + oral + kata</h3>
      <div class="card-sub">Media waza + media kata · cada nota de 0 a 10</div>
      <div class="scores">${WAZA.map(([k, l]) => scoreCell(k, l, c)).join('')}</div>
      <div class="calc-line"><span>Media waza</span><b id="mW">–</b></div>
      <div class="kata-row"><input class="input" data-f="kata1Name" value="${esc(c.kata1Name)}" placeholder="Kata 1 · voluntario">${scoreCell('kata1', 'Nota', c)}</div>
      <div class="kata-row"><input class="input" data-f="kata2Name" value="${esc(c.kata2Name)}" placeholder="Kata 2 · tribunal">${scoreCell('kata2', 'Nota', c)}</div>
      <div class="calc-line"><span>Media kata</span><b id="mK">–</b></div>
      <div class="apart-res" id="res0"><span>A1</span><span class="val">–</span></div>
    </div>

    <div class="card">
      <h3>2º apartado · Aplicados</h3>
      <div class="card-sub">Media Ippon/Sambon + Bunkai</div>
      <div class="scores">${scoreCell('ippon', 'Ippon', c)}${scoreCell('sambon', 'Sambon', c)}${scoreCell('bunkai', 'Bunkai', c)}</div>
      <div class="calc-line"><span>Media Ippon / Sambon</span><b id="mIS">–</b></div>
      <div class="apart-res" id="res1"><span>A2</span><span class="val">–</span></div>
    </div>

    <div class="card">
      <h3>3r apartado · Kumite + defensa personal</h3>
      <div class="card-sub">Yakusoku kumite × 2</div>
      <div class="scores">${scoreCell('yakusoku', 'Yakusoku', c)}</div>
      <div class="apart-res" id="res2"><span>A3</span><span class="val">–</span></div>
    </div>

    <div class="card">
      <h3>Teórica</h3>
      <div class="card-sub">Mal resta 1 y Bien suma 1 en cada apartado (solo si es APTO)</div>
      <div class="seg teo" id="teo">
        ${TEO.map(t => `<button data-v="${t.v}" class="${c.teorica === t.v ? 'on' : ''}">${t.label}<small>${t.v} · ${t.adj > 0 ? '+1' : t.adj < 0 ? '−1' : '0'}</small></button>`).join('')}
      </div>
    </div>

    <div class="result" id="result"></div>

    <div class="field"><label>Notas</label><textarea class="input" data-f="notes" placeholder="Observaciones del tribunal">${esc(c.notes)}</textarea></div>

    ${next
      ? `<button class="btn primary" data-go="#/examen/${ex.id}/asp/${next.id}">Siguiente: ${esc(next.name) || 'aspirante ' + (idx + 2)}</button>`
      : `<button class="btn primary" data-act="add-cand">${ICON.plus}Añadir otro aspirante</button>`}
    <button class="btn danger" data-act="del-cand" data-id="${c.id}">${ICON.trash}Eliminar aspirante</button>
  `;
  main.dataset.exam = ex.id;

  const upd = () => { touch(ex); save(); updateCandidate(main, c); };
  main.querySelectorAll('[data-sc]').forEach(inp => {
    inp.addEventListener('input', () => {
      const raw = inp.value.trim();
      c.scores[inp.dataset.sc] = raw === '' ? null : (Number.isNaN(num(raw)) ? raw : num(raw));
      upd();
    });
    inp.addEventListener('focus', () => inp.select());
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const all = [...main.querySelectorAll('[data-sc]')];
      const n = all[all.indexOf(inp) + 1];
      if (n) n.focus(); else inp.blur();
    });
  });
  main.querySelectorAll('[data-f]').forEach(inp => inp.addEventListener('input', () => { c[inp.dataset.f] = inp.value; upd(); }));
  $('#grade', main).addEventListener('click', e => {
    const b = e.target.closest('[data-grade]'); if (!b) return;
    c.grade = b.dataset.grade;
    S.settings.lastGrade = c.grade;
    $('#grade', main).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    upd();
  });
  $('#teo', main).addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    const v = +b.dataset.v;
    c.teorica = c.teorica === v ? null : v; // volver a tocar = sin evaluar
    $('#teo', main).querySelectorAll('button').forEach(x => x.classList.toggle('on', +x.dataset.v === c.teorica));
    upd();
  });
  updateCandidate(main, c);
  if (!c.name) setTimeout(() => $('[data-f="name"]', main).focus(), 50);
}

function updateCandidate(main, c) {
  const r = calc(c);
  const set = (id, v) => { const el = $('#' + id, main); if (el) el.textContent = v; };
  set('mW', ok(r.mW) ? fmt(r.mW) : '–');
  set('mK', ok(r.mK) ? fmt(r.mK) : '–');
  set('mIS', ok(r.mIS) ? fmt(r.mIS) : '–');
  main.querySelectorAll('[data-cell]').forEach(cell => cell.classList.toggle('bad', Number.isNaN(num(c.scores[cell.dataset.cell]))));
  r.base.forEach((b, i) => {
    const el = $('#res' + i, main);
    const raw = r.raw[i];
    el.querySelector('.val').innerHTML = b == null ? '–' : `${!Number.isInteger(raw) ? `<small>${fmt(raw)} →</small>` : ''}${b}`;
    el.classList.toggle('low', b != null && b < r.g.min);
  });

  const box = $('#result', main);
  box.className = 'result' + (r.complete && !r.invalid ? (r.apto ? ' ok' : ' ko') : '');
  if (r.invalid) {
    box.innerHTML = `<div class="verdict">Revisar notas</div><div class="why">Hay alguna nota fuera de 0 a 10.</div>`;
    return;
  }
  if (!r.complete) {
    box.innerHTML = `<div class="verdict" style="color:var(--muted)">Faltan notas</div><div class="why">${r.filled} de 12 notas puestas · mínimo ${r.g.min} por apartado (${r.g.label})</div>`;
    return;
  }
  const fails = r.base.map((b, i) => (b < r.g.min ? 'A' + (i + 1) : null)).filter(Boolean);
  let why = r.apto
    ? `Mínimo ${r.g.min} por apartado superado`
    : `No llega al mínimo de ${r.g.min} en ${fails.join(', ')}`;
  if (r.apto && c.teorica == null) why += ' · teórica sin evaluar';
  if (!r.apto && r.teo && r.adj) why += ' · la teórica no se aplica';
  const cellH = (k, v, d) => `<div><div class="k">${k}</div><div class="v">${v}</div><div class="d ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' + d : d < 0 ? '−' + -d : ''}</div></div>`;
  const deltas = r.acta.map((a, i) => a - r.base[i]);
  const dTot = deltas.reduce((a, b) => a + b, 0);
  box.innerHTML = `
    <div class="verdict">${r.apto ? 'APTO' : 'NO APTO'}</div>
    <div class="why">${why}</div>
    <div class="acta">
      ${cellH('A1', r.acta[0], deltas[0])}${cellH('A2', r.acta[1], deltas[1])}${cellH('A3', r.acta[2], deltas[2])}
      <div class="tot"><div class="k">TOTAL</div><div class="v">${r.total}</div><div class="d">${dTot ? (dTot > 0 ? '+' : '−') + Math.abs(dTot) + ' teórica' : '/ 60'}</div></div>
    </div>`;
}

/* ---------- pantalla: buscar ---------- */
let searchState = { q: '', grade: '' };
function renderSearch(main) {
  main.innerHTML = `
    <h1>Buscar</h1>
    <p class="subtitle">Histórico de aspirantes de todos los exámenes</p>
    <input class="input" id="q" type="search" placeholder="Nombre del aspirante" value="${esc(searchState.q)}" autocomplete="off">
    <div class="chips" id="gchips">
      <button class="chip ${!searchState.grade ? 'on' : ''}" data-g="">Todos</button>
      ${Object.entries(GRADES).map(([k, g]) => `<button class="chip ${searchState.grade === k ? 'on' : ''}" data-g="${k}">${esc(g.short)}</button>`).join('')}
    </div>
    <div id="results"></div>`;
  const draw = () => {
    const q = norm(searchState.q);
    const items = [];
    S.exams.forEach(ex => ex.candidates.forEach(c => {
      if (searchState.grade && c.grade !== searchState.grade) return;
      if (q && !norm(c.name).includes(q)) return;
      items.push({ ex, c, r: calc(c) });
    }));
    items.sort((a, b) => (b.ex.date || '').localeCompare(a.ex.date || ''));
    $('#results', main).innerHTML = items.length
      ? `<div class="list">${items.map(({ ex, c, r }) => `
        <button class="row" data-go="#/examen/${ex.id}/asp/${c.id}">
          <div class="main">
            <div class="title">${esc(c.name) || '<span class="muted">Sin nombre</span>'}</div>
            <div class="meta">${esc(fmtDate(ex.date))} · ${esc(GRADES[c.grade].label)}${ex.place ? ' · ' + esc(ex.place) : ''}</div>
          </div>
          ${r.complete ? `<div class="score">${r.total}</div>` : ''}${statusBadge(r)}${ICON.chev}</button>`).join('')}</div>
        <p class="muted small" style="text-align:center">${items.length} resultado${items.length === 1 ? '' : 's'}</p>`
      : `<div class="empty">${S.exams.length ? 'Sin resultados.' : 'Todavía no hay exámenes guardados.'}</div>`;
  };
  $('#q', main).addEventListener('input', e => { searchState.q = e.target.value; draw(); });
  $('#gchips', main).addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    searchState.grade = b.dataset.g;
    $('#gchips', main).querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
    draw();
  });
  draw();
}

/* ---------- pantalla: ajustes ---------- */
function renderSettings(main) {
  const n = S.exams.reduce((a, e) => a + e.candidates.length, 0);
  const last = S.settings.lastBackup ? new Date(S.settings.lastBackup).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : 'nunca';
  main.innerHTML = `
    <h1>Ajustes</h1>
    <p class="subtitle">${S.exams.length} examen${S.exams.length === 1 ? '' : 'es'} · ${n} aspirante${n === 1 ? '' : 's'} guardados en este dispositivo</p>
    ${backupBanner()}
    <h2>Copia de seguridad</h2>
    <div class="card">
      <p class="small muted" style="margin-bottom:12px">Los datos solo están en este dispositivo. Guarda una copia en Dropbox de vez en cuando. Última copia: <b>${esc(last)}</b>.</p>
      <button class="btn primary" data-act="backup-csv">${ICON.share}Exportar histórico (Excel)</button>
      <button class="btn" data-act="backup-json">${ICON.share}Copia completa para restaurar</button>
      <button class="btn ghost" data-act="import" style="margin-bottom:0">Importar copia completa</button>
      <input type="file" id="importFile" accept=".json,application/json" hidden>
    </div>
    <p class="small muted" style="margin:-4px 4px 14px">El histórico se abre en Excel para buscar desde el ordenador. La copia completa sirve para pasar los datos a otro iPhone o recuperarlos.</p>

    <h2>Cómo se calcula</h2>
    <div class="card rules">
      <p><b>1r apartado.</b> Media de los 6 waza + media de Kata 1 y Kata 2.</p>
      <p><b>2º apartado.</b> Media de Ippon y Sambon kumite + Bunkai.</p>
      <p><b>3r apartado.</b> Yakusoku kumite × 2.</p>
      <p><b>Redondeo.</b> Cada apartado se redondea al entero más cercano (,5 hacia arriba). El APTO se decide con estas notas.</p>
      <p><b>Teórica.</b> Mal −1, Normal 0, Bien +1 en cada apartado. Sin pasar de 20 ni bajar del mínimo. A los NO APTO no se les aplica.</p>
      <table>
        <tr><th>Grado</th><th>A1</th><th>A2</th><th>A3</th><th>Total</th></tr>
        <tr><td>Cinturón Negro</td><td>12</td><td>12</td><td>12</td><td>36</td></tr>
        <tr><td>1r Dan</td><td>12</td><td>12</td><td>12</td><td>36</td></tr>
        <tr><td>2º Dan</td><td>14</td><td>14</td><td>14</td><td>42</td></tr>
      </table>
    </div>

    <h2>Datos</h2>
    <button class="btn danger" data-act="wipe">${ICON.trash}Borrar todos los datos</button>
    <p class="footer">Tribunal de Grados v${VERSION} · Club Karate Swing<br>© 2026 Oriol Aragon</p>
  `;
  $('#importFile', main).addEventListener('change', importJSON);
}

/* ---------- exportar ---------- */
const CSV_HEAD = ['Fecha', 'Lugar', 'Juez', 'Aspirante', 'Grado',
  'Dachi', 'Tsuki', 'Uchi', 'Geri', 'Uke', 'Renzoku', 'Media waza',
  'Kata 1', 'Nota kata 1', 'Kata 2', 'Nota kata 2', 'Media kata', 'A1 base',
  'Ippon', 'Sambon', 'Media Ip/Sa', 'Bunkai', 'A2 base', 'Yakusoku', 'A3 base',
  'Teórica', 'A1 acta', 'A2 acta', 'A3 acta', 'Total', 'Resultado', 'Notas'];
function csvRows(exams) {
  const rows = [];
  [...exams].sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(ex => ex.candidates.forEach(c => {
    const r = calc(c), s = c.scores;
    const n = k => (ok(num(s[k])) ? fmt(num(s[k])) : '');
    rows.push([fmtDate(ex.date), ex.place, ex.judge, c.name, GRADES[c.grade].label,
      ...WAZA.map(([k]) => n(k)), fmt(r.mW),
      c.kata1Name, n('kata1'), c.kata2Name, n('kata2'), fmt(r.mK), r.base[0] ?? '',
      n('ippon'), n('sambon'), fmt(r.mIS), n('bunkai'), r.base[1] ?? '', n('yakusoku'), r.base[2] ?? '',
      r.teo ? `${r.teo.label} (${r.teo.v})` : '', r.acta[0] ?? '', r.acta[1] ?? '', r.acta[2] ?? '', r.total ?? '',
      r.complete ? (r.apto ? 'APTO' : 'NO APTO') : 'Incompleto', c.notes]);
  }));
  return rows;
}
function toCSV(rows) {
  // Separador ";" y coma decimal: es lo que Excel en castellano abre en columnas
  const cell = v => {
    const s = String(v == null ? '' : v);
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + [CSV_HEAD, ...rows].map(r => r.map(cell).join(';')).join('\r\n');
}
async function shareFile(name, content, type) {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return true;
}
async function exportAllCSV() {
  if (!S.exams.length) return toast('No hay datos que exportar');
  const done = await shareFile(`Grados histórico ${today()}.csv`, toCSV(csvRows(S.exams)), 'text/csv');
  if (done) { S.settings.lastBackup = Date.now(); save(true); route(); toast('Histórico exportado'); }
}
async function exportJSON() {
  if (!S.exams.length) return toast('No hay datos que exportar');
  const data = JSON.stringify({ app: 'grados', version: 1, exportedAt: new Date().toISOString(), exams: S.exams }, null, 1);
  const done = await shareFile(`Grados copia ${today()}.json`, data, 'application/json');
  if (done) { S.settings.lastBackup = Date.now(); save(true); route(); toast('Copia exportada'); }
}
function importJSON(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d || !Array.isArray(d.exams)) throw new Error('formato');
      let added = 0, updated = 0;
      d.exams.forEach(ex => {
        if (!ex || !ex.id || !Array.isArray(ex.candidates)) return;
        const cur = findExam(ex.id);
        if (!cur) { S.exams.push(ex); added++; }
        else if ((ex.updatedAt || 0) > (cur.updatedAt || 0)) { Object.assign(cur, ex); updated++; }
      });
      save(true); route();
      toast(`Importado: ${added} nuevo${added === 1 ? '' : 's'}, ${updated} actualizado${updated === 1 ? '' : 's'}`);
    } catch (err) { toast('El archivo no es una copia válida'); }
  };
  rd.readAsText(f);
  e.target.value = '';
}

/* ---------- imprimir hoja ---------- */
function printExam(ex) {
  const per = 8;
  const pages = [];
  const list = ex.candidates.length ? ex.candidates : [];
  for (let i = 0; i < Math.max(1, list.length); i += per) pages.push(list.slice(i, i + per));
  const widths = [5, 30, 10, 9, 9, 9, 9, 9, 9, 9, 9.5, 9.5, 9, 10, 10, 10, 9, 10, 10, 10, 10, 12, 9, 9, 9, 11, 9];
  const cols = `<colgroup>${widths.map(w => `<col style="width:${w}mm">`).join('')}</colgroup>`;
  const head = `<thead><tr>
      <th rowspan="2" class="g4">#</th><th rowspan="2" class="g4">Aspirante</th><th rowspan="2" class="g4" style="font-size:6.8pt">Grado</th>
      <th colspan="11" class="grp g1 thick-l">1r APARTADO · Técnica + explicación oral + kata<small>A1 = Media waza + Media kata, redondeado</small></th>
      <th colspan="5" class="grp g2 thick-l">2º APARTADO · Aplicados<small>A2 = Media Ip./Sa. + Bunkai, redondeado</small></th>
      <th colspan="2" class="grp g3 thick-l">3r APARTADO<small>Kumite + defensa personal<br>A3 = Yakusoku × 2</small></th>
      <th colspan="6" class="grp g4 thick-l">ACTA FCK<small>A1, A2, A3 enteros + ajuste de la teórica</small></th></tr>
    <tr class="sub">
      <th class="g1 thick-l">Dachi<em>waza</em></th><th class="g1">Tsuki<em>waza</em></th><th class="g1">Uchi<em>waza</em></th><th class="g1">Geri<em>waza</em></th><th class="g1">Uke<em>waza</em></th><th class="g1">Renzoku<em>waza</em></th>
      <th class="calc">Media<em>waza</em></th><th class="g1">Kata 1<em>voluntario</em></th><th class="g1">Kata 2<em>tribunal</em></th><th class="calc">Media<em>kata</em></th><th class="calc">A1<em>entero</em></th>
      <th class="g2 thick-l">Ippon<em>kumite</em></th><th class="g2">Sambon<em>kumite</em></th><th class="calc">Media<em>Ip./Sa.</em></th><th class="g2">Bunkai</th><th class="calc">A2<em>entero</em></th>
      <th class="g3 thick-l">Yakusoku<em>kumite</em></th><th class="calc">A3<em>/ 20</em></th>
      <th class="g4 thick-l">Teórica<em>0 · 5 · 10</em></th><th class="g4">A1<em>acta</em></th><th class="g4">A2<em>acta</em></th><th class="g4">A3<em>acta</em></th><th class="key">TOTAL<em>/ 60</em></th><th class="g4">Apto</th>
    </tr></thead>`;
  const body = (cands, offset) => {
    let h = '';
    for (let i = 0; i < per; i++) {
      const c = cands[i];
      if (!c) {
        h += `<tr><td class="n">${offset + i + 1}</td>${'<td></td>'.repeat(2)}<td class="thick-l"></td>${'<td></td>'.repeat(5)}<td class="calc"></td><td></td><td></td><td class="calc"></td><td class="calc"></td><td class="thick-l"></td><td></td><td class="calc"></td><td></td><td class="calc"></td><td class="thick-l"></td><td class="calc"></td><td class="thick-l"></td><td></td><td></td><td></td><td class="key"></td><td></td></tr>`;
        continue;
      }
      const r = calc(c), s = c.scores;
      const n = k => (ok(num(s[k])) ? fmt(num(s[k])) : '');
      const kt = (name, k) => `${n(k)}${name ? `<div style="font-size:5.5pt;color:#555;line-height:1.1">${esc(name)}</div>` : ''}`;
      h += `<tr>
        <td class="n">${offset + i + 1}</td><td class="name">${esc(c.name)}</td><td class="sm">${esc(GRADES[c.grade].short)}</td>
        ${WAZA.map(([k], j) => `<td${j === 0 ? ' class="thick-l"' : ''}>${n(k)}</td>`).join('')}
        <td class="calc">${fmt(r.mW)}</td><td>${kt(c.kata1Name, 'kata1')}</td><td>${kt(c.kata2Name, 'kata2')}</td><td class="calc">${fmt(r.mK)}</td><td class="calc">${r.base[0] ?? ''}</td>
        <td class="thick-l">${n('ippon')}</td><td>${n('sambon')}</td><td class="calc">${fmt(r.mIS)}</td><td>${n('bunkai')}</td><td class="calc">${r.base[1] ?? ''}</td>
        <td class="thick-l">${n('yakusoku')}</td><td class="calc">${r.base[2] ?? ''}</td>
        <td class="thick-l sm">${r.teo ? r.teo.label : ''}</td><td>${r.acta[0] ?? ''}</td><td>${r.acta[1] ?? ''}</td><td>${r.acta[2] ?? ''}</td>
        <td class="key">${r.total ?? ''}</td><td class="sm"><b>${r.complete ? (r.apto ? 'Sí' : 'No') : ''}</b></td></tr>`;
    }
    return h;
  };
  const legend = `<div class="legend">
    <div><h3>Cómo se calcula</h3>
      <p><b>1r apartado.</b> Media de los 6 waza + media de los 2 kata.</p>
      <p><b>2º apartado.</b> Media de Ippon y Sambon kumite + Bunkai.</p>
      <p><b>3r apartado.</b> Yakusoku kumite × 2.</p>
      <p><b>Redondeo.</b> A1, A2 y A3 al entero más cercano (,5 hacia arriba). El APTO se decide con estas notas, antes de la teórica.</p>
      <p><b>Teórica.</b> Mal −1, Normal 0, Bien +1 en cada apartado. Sin pasar de 20 ni bajar del mínimo. A los NO APTO no se les aplica.</p></div>
    <div><h3>Mínimos para APTO (normativa FCK)</h3>
      <table class="mins"><tr><th style="text-align:left">Grado</th><th>A1</th><th>A2</th><th>A3</th><th>Total</th></tr>
      <tr><td style="text-align:left">Cinturón Negro</td><td>12</td><td>12</td><td>12</td><td>36</td></tr>
      <tr><td style="text-align:left">1r Dan</td><td>12</td><td>12</td><td>12</td><td>36</td></tr>
      <tr><td style="text-align:left">2º Dan</td><td>14</td><td>14</td><td>14</td><td>42</td></tr></table></div></div>`;
  $('#print').innerHTML = pages.map((p, pi) => `
    <div class="ps">
      <div class="top">
        <div><h1>Examen de grado · Hoja del tribunal</h1><div class="sub">Club Karate Swing · CN, 1r Dan y 2º Dan · Cada ejercicio de 0 a 10</div></div>
        <div class="fields"><div><b>Fecha:</b> ${esc(fmtDate(ex.date))}</div><div><b>Lugar:</b> ${esc(ex.place || '')}</div><div><b>Juez del tribunal:</b> ${esc(ex.judge || '')}</div>${pages.length > 1 ? `<div>Hoja ${pi + 1}/${pages.length}</div>` : ''}</div>
      </div>
      <table>${cols}${head}<tbody>${body(p, pi * per)}</tbody></table>
      ${legend}
    </div>`).join('');
  setTimeout(() => window.print(), 50);
}

/* ---------- acciones ---------- */
function newCandidate(ex) {
  const last = ex.candidates[ex.candidates.length - 1];
  const c = {
    id: uid(), name: '', grade: (last && last.grade) || S.settings.lastGrade || 'CN',
    scores: {}, teorica: null, kata1Name: '', kata2Name: '', notes: '',
  };
  ex.candidates.push(c);
  touch(ex); save(true);
  go(`#/examen/${ex.id}/asp/${c.id}`);
}
document.addEventListener('click', async e => {
  const nav = e.target.closest('[data-go]');
  if (nav) { go(nav.dataset.go); return; }
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const ex = findExam($('#main').dataset.exam);
  switch (btn.dataset.act) {
    case 'new-exam': {
      const exn = { id: uid(), date: today(), place: S.settings.lastPlace || '', judge: S.settings.lastJudge || '', candidates: [], createdAt: Date.now() };
      touch(exn); S.exams.push(exn); save(true);
      go('#/examen/' + exn.id);
      break;
    }
    case 'add-cand': if (ex) newCandidate(ex); break;
    case 'del-cand': {
      if (!ex) break;
      const c = ex.candidates.find(x => x.id === btn.dataset.id);
      if (!c || !confirm(`¿Eliminar a ${c.name || 'este aspirante'}? No se puede deshacer.`)) break;
      ex.candidates = ex.candidates.filter(x => x !== c);
      touch(ex); save(true); go('#/examen/' + ex.id);
      break;
    }
    case 'del-exam': {
      if (!ex) break;
      const n = ex.candidates.length;
      if (!confirm(`¿Borrar el examen del ${fmtDate(ex.date)}${n ? ` con ${n} aspirante${n === 1 ? '' : 's'}` : ''}? No se puede deshacer.`)) break;
      S.exams = S.exams.filter(x => x !== ex);
      save(true); go('#/');
      break;
    }
    case 'print': if (ex) printExam(ex); break;
    case 'csv-exam': if (ex) {
      if (!ex.candidates.length) { toast('Este examen no tiene aspirantes'); break; }
      await shareFile(`Grados ${ex.date}${ex.place ? ' ' + ex.place.replace(/[\\/:*?"<>|]/g, '') : ''}.csv`, toCSV(csvRows([ex])), 'text/csv');
    } break;
    case 'backup-csv': await exportAllCSV(); break;
    case 'backup-json': await exportJSON(); break;
    case 'import': $('#importFile').click(); break;
    case 'wipe': {
      if (!S.exams.length) { toast('No hay datos'); break; }
      if (!confirm('¿Borrar TODOS los exámenes de este dispositivo?')) break;
      if (!confirm('¿Seguro? Si no tienes copia, se pierden para siempre.')) break;
      S = { exams: [], settings: S.settings }; save(true); route(); toast('Datos borrados');
      break;
    }
  }
});

// Ocultar la barra de pestañas mientras se teclea (en iPhone tapa los campos)
document.addEventListener('focusin', e => { if (e.target.matches('input:not([type=date]), textarea')) document.body.classList.add('kb-open'); });
document.addEventListener('focusout', () => setTimeout(() => {
  if (!document.activeElement || !document.activeElement.matches('input, textarea')) document.body.classList.remove('kb-open');
}, 80));

route();
