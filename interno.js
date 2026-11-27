// ===== Cuadrillas internas (pestaña 3) =====
// Mismo archivo de bonos que "Avance de póliza", técnicos con Contratista = "Interno".
// Una ficha por distrito. Solo productividad (sin montos): días, folios, folios al día, soporte, recolección, festivo,
// contra las mismas metas del esquema (25 días, 3.5 folios al día). Técnicos con el mismo nombre en un distrito = una cuadrilla.
var IN = null, INI = -1;
var IN_META = { dias: 25, prod: 3.5, diasMes: 26, festMin: 3 };

function inNorm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
// "CTA-TPI-INT-GBA GDL BARRANCA" → GBA · GDL Barranca;  "CTA-TPI-MLT-GDL MLT GUADALAJARA" → MLT-GDL · MLT Guadalajara
function inDist(suc) { var m = String(suc || '').trim().toUpperCase().match(/^CTA-TPI-([A-Z]+)-([A-Z]+)\s*(.*)$/);
  if (!m) return { k: String(suc || '?'), n: titleName(String(suc || 'Sin sucursal')) };
  return { k: m[1] === 'INT' ? m[2] : m[1] + '-' + m[2], n: titleName(m[3] || m[2]).replace(/\b(Gdl|Mlt|Cdmx)\b/g, function (x) { return x.toUpperCase(); }) }; }
function inN(n) { return Math.round(n || 0).toLocaleString('en-US'); }

function inCompute(mk) {
  var y = +mk.slice(0, 4), m = +mk.slice(5, 7) - 1, last = new Date(y, m + 1, 0).getDate();
  var fest = Calc.FESTIVOS.filter(function (f) { return f.slice(0, 7) === mk; });
  var per = {}, corte = '';
  DATA.rows.forEach(function (r) {
    if (r[1].slice(0, 7) !== mk) return;
    var t = DATA.tec[r[0]]; if (!t || String(t.contratista || '').trim().toUpperCase() !== 'INTERNO') return;
    if (r[1] > corte) corte = r[1];
    var dd = inDist(t.sucursal), dist = dd.k, k = dist + '|' + inNorm(t.nombre || r[0]);
    var x = per[k] || (per[k] = { u: [], nombre: t.nombre || r[0], sucursal: t.sucursal, dist: dist, dn: dd.n, dias: {}, fol: 0, sop: 0, reco: 0, fest: 0, porTipo: {} });
    if (x.u.indexOf(r[0]) < 0) x.u.push(r[0]);
    x.dias[r[1]] = (x.dias[r[1]] || 0) + 1;
    x.porTipo[r[2] || 'Sin tipo'] = (x.porTipo[r[2] || 'Sin tipo'] || 0) + 1;
    if (fest.indexOf(r[1]) >= 0) { if (r[2] !== 'Recoleccion') x.fest++; return; }
    x.fol++; if (r[2] === 'Soporte') x.sop++; if (r[2] === 'Recoleccion') x.reco++;
  });
  if (!corte) return { monthKey: mk, distritos: [] };
  function hab(h) { var n = 0; for (var d = 1; d <= h; d++) if (new Date(y, m, d).getDay() !== 0) n++; return n; }
  var cd = +corte.slice(8, 10), totH = hab(last), pasH = hab(cd), restH = Math.max(0, totH - pasH);
  var D = {};
  Object.keys(per).forEach(function (k) {
    var x = per[k], d = Object.keys(x.dias).length, rate = Math.min(1, d / Math.max(1, pasH)), addD = rate * restH, fpd = d ? x.fol / d : 0;
    var t = { u: x.u, nombre: x.nombre, sucursal: x.sucursal, dist: x.dist, d: d, dProj: Math.min(totH, d + addD), maxPos: d + restH,
      fol: x.fol, folProj: x.fol + fpd * addD, sop: x.sop, reco: x.reco, fest: x.fest, fpd: fpd, porDia: x.dias, porTipo: x.porTipo };
    t.prodT = t.folProj / IN_META.diasMes;
    t.grupo = t.maxPos < IN_META.dias ? 'r' : (t.dProj >= IN_META.dias - 0.5 && t.prodT >= IN_META.prod ? 'g' : 'a');
    t.faltaFolSem = Math.max(0, Math.ceil((IN_META.prod * IN_META.diasMes - t.folProj) / Math.max(1, restH / 6)));
    var g = D[x.dist] || (D[x.dist] = { dist: x.dist, nombre: x.dn, tecs: [] });
    g.tecs.push(t);
  });
  var out = Object.keys(D).map(function (k) {
    var g = D[k], n = g.tecs.length, s = { d: 0, dProj: 0, fol: 0, folProj: 0, sop: 0, reco: 0, fest: 0 }, G = { r: 0, a: 0, g: 0 };
    g.tecs.forEach(function (t) { Object.keys(s).forEach(function (f) { s[f] += t[f]; }); G[t.grupo]++; });
    return { dist: g.dist, nombre: g.nombre, tecs: g.tecs, activos: n, s: s, G: G, corte: corte, totH: totH, pasH: pasH, restH: restH, cerrado: restH === 0,
      asist: Math.floor(s.dProj / n), prod: Math.floor(s.folProj / n / IN_META.diasMes * 10) / 10 };
  });
  out.sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
  return { monthKey: mk, corte: corte, distritos: out };
}

function inMesTxt() { var k = IN.monthKey; return MESES[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4); }
function inCur() { return IN.distritos[INI]; }

function inResumen() {
  var L = IN.distritos, mk = IN.monthKey, mesN = MESES[+mk.slice(5, 7) - 1], c0 = L[0] || {}, T = { n: 0, d: 0, dP: 0, f: 0, fP: 0, g: 0, a: 0, r: 0 };
  L.forEach(function (c) { T.n += c.activos; T.d += c.s.d; T.dP += c.s.dProj; T.f += c.s.fol; T.fP += c.s.folProj; T.g += c.G.g; T.a += c.G.a; T.r += c.G.r; });
  var fin = c0.cerrado, h = '<div class="pg wide"><div class="pg-h"><div class="ey">Cuadrillas internas · ' + mesN + ' ' + mk.slice(0, 4) + (L.length ? ' · datos al ' + (+c0.corte.slice(8, 10)) + ' de ' + mesN : '') + '</div><h1>Resumen por distrito</h1>';
  if (!L.length) return h + '</div><div class="err">El archivo no trae folios de cuadrillas internas en este mes.</div></div>';
  h += '<div class="meta"><span><b>' + L.length + '</b> distritos</span><span>Técnicos trabajando: <b>' + T.n + '</b></span><span>Folios realizados: <b>' + inN(T.f) + '</b>' + (fin ? '' : ' · estimado al cierre <b>' + inN(T.fP) + '</b>') + '</span><span>Día hábil <b>' + c0.pasH + ' de ' + c0.totH + '</b></span></div></div>';
  h += '<div class="blk"><div class="tw2"><table class="rs"><thead><tr><th>Distrito</th><th class="r">Técnicos</th><th class="r">Días trabajados</th><th class="r">Días / técnico' + (fin ? '' : ' (est.)') + '</th><th class="r">Folios realizados</th>' + (fin ? '' : '<th class="r">Estimado al cierre</th>') + '<th class="r">Folios al día' + (fin ? '' : ' (est.)') + '</th><th class="r">Soporte</th><th class="r">Recolección</th><th class="r">En meta</th></tr></thead><tbody>';
  L.forEach(function (c, i) {
    h += '<tr class="st" onclick="inPick(' + i + ')"><td class="nm">' + esc(c.nombre) + ' <span style="color:var(--g4);font-weight:500">· ' + c.dist + '</span></td><td class="r">' + c.activos + '</td><td class="r">' + inN(c.s.d) + '</td>' +
      '<td class="r ' + (c.asist < IN_META.dias ? 'bad' : '') + '">' + c.asist + '</td><td class="r">' + inN(c.s.fol) + '</td>' + (fin ? '' : '<td class="r">' + inN(c.s.folProj) + '</td>') +
      '<td class="r ' + (c.prod < IN_META.prod ? 'bad' : '') + '">' + c.prod.toFixed(1) + '</td><td class="r">' + inN(c.s.sop) + '</td><td class="r">' + inN(c.s.reco) + '</td><td class="r">' + c.G.g + ' de ' + c.activos + '</td></tr>';
  });
  var aT = Math.floor(T.dP / T.n), pT = Math.floor(T.fP / T.n / IN_META.diasMes * 10) / 10;
  h += '</tbody><tfoot><tr><td>Total</td><td class="r">' + T.n + '</td><td class="r">' + inN(T.d) + '</td><td class="r">' + aT + '</td><td class="r">' + inN(T.f) + '</td>' + (fin ? '' : '<td class="r">' + inN(T.fP) + '</td>') + '<td class="r">' + pT.toFixed(1) + '</td><td></td><td></td><td class="r">' + T.g + ' de ' + T.n + '</td></tr></tfoot></table></div></div>';
  h += '<div class="foot">Metas: 25 días por técnico y 3.5 folios al día (folios sin día festivo ÷ técnicos ÷ 26). Se mide sobre los técnicos que trabajaron en el mes; un técnico con dos usuarios FFM cuenta una vez.</div></div>';
  return h;
}

function inRender(c) {
  var mk = IN.monthKey, mesN = MESES[+mk.slice(5, 7) - 1], cd = +c.corte.slice(8, 10), s = c.s;
  var h = '<div class="pg"><div class="pg-h"><div class="ey">Cuadrillas internas · avance de ' + mesN + ' ' + mk.slice(0, 4) + ' · datos al ' + cd + ' de ' + mesN + '</div><h1>' + esc(c.nombre) + '</h1>';
  h += '<div class="meta"><span>Distrito <b>' + c.dist + '</b></span><span>Técnicos trabajando: <b>' + c.activos + '</b></span><span>Folios realizados: <b>' + inN(s.fol) + '</b>' + (c.cerrado ? '' : ' · estimado al cierre <b>' + inN(s.folProj) + '</b>') + '</span><span>' + (c.cerrado ? '<b>Mes cerrado</b>' : 'Faltan <b>' + c.restH + ' días</b> hábiles') + '</span></div></div>';
  var st = [
    { ok: c.asist >= IN_META.dias, v: c.asist + ' días', t: 'Días por técnico', s: 'Meta: 25 días por técnico.' },
    { ok: c.prod >= IN_META.prod, v: c.prod.toFixed(1) + ' folios', t: 'Folios al día', s: 'Meta: 3.5 folios al día por técnico.' },
    { ok: c.G.g === c.activos, v: c.G.g + ' de ' + c.activos, t: 'Técnicos en meta', s: c.G.r ? c.G.r + ' no llega' + (c.G.r > 1 ? 'n' : '') + ' a 25 días este mes.' : 'Nadie se queda abajo de 25 días.' }];
  h += '<div class="blk"><div class="blk-h"><span class="t">Cómo van contra la meta</span><span class="s">' + (c.cerrado ? 'mes completo' : 'estimado al cierre del mes') + '</span></div><div class="acts3">';
  st.forEach(function (a) { h += '<div class="ac' + (a.ok ? ' ok' : ' warn') + '"><div class="g">' + (a.ok ? '✓ ' : '') + a.v + '</div><b>' + a.t + '</b><span>' + a.s + '</span></div>'; });
  h += '</div></div>';
  // tabla por técnico
  var T = c.tecs.map(function (t, i) { t._i = i; return t; }).slice().sort(function (a, b) { return b.folProj - a.folProj; });
  h += '<div class="blk"><div class="blk-h"><span class="t">Por técnico</span><span class="s">Clic en un técnico para ver su calendario</span></div><div class="tw2"><table class="rs"><thead><tr><th>Técnico</th><th class="r">Días trabajados</th>' + (c.cerrado ? '' : '<th class="r">Días (est.)</th>') + '<th class="r">Folios</th><th class="r">Folios al día' + (c.cerrado ? '' : ' (est.)') + '</th><th class="r">Soporte</th><th class="r">Recolección</th><th class="r">Día festivo</th></tr></thead><tbody>';
  T.forEach(function (t) {
    h += '<tr class="st" onclick="inTec(' + t._i + ')"><td class="nm"><span class="idot ' + t.grupo + '"></span>' + esc(titleName(t.nombre)) + '</td><td class="r">' + t.d + '</td>' + (c.cerrado ? '' : '<td class="r ' + (t.dProj < IN_META.dias - 0.5 ? 'bad' : '') + '">' + Math.round(t.dProj) + '</td>') +
      '<td class="r">' + inN(t.fol) + '</td><td class="r ' + (t.prodT < IN_META.prod ? 'bad' : '') + '">' + t.prodT.toFixed(1) + '</td><td class="r">' + t.sop + '</td><td class="r">' + t.reco + '</td><td class="r">' + (t.fest || '—') + '</td></tr>';
  });
  h += '</tbody><tfoot><tr><td>Total</td><td class="r">' + inN(s.d) + '</td>' + (c.cerrado ? '' : '<td class="r">' + c.asist + ' prom.</td>') + '<td class="r">' + inN(s.fol) + '</td><td class="r">' + c.prod.toFixed(1) + '</td><td class="r">' + inN(s.sop) + '</td><td class="r">' + inN(s.reco) + '</td><td class="r">' + (s.fest || '—') + '</td></tr></tfoot></table></div>' +
    '<div class="how">Folios al día = folios sin día festivo ÷ 26' + (c.cerrado ? '' : ', al ritmo actual hasta el cierre') + '. Punto rojo: no llega a 25 días · ámbar: puede llegar · verde: en meta.</div></div>';
  // equipo en semáforo
  var G = { r: [], a: [], g: [] }; c.tecs.forEach(function (t) { G[t.grupo].push(t); });
  G.r.sort(function (a, b) { return a.d - b.d; }); G.a.sort(function (a, b) { return a.dProj - b.dProj; }); G.g.sort(function (a, b) { return b.prodT - a.prodT; });
  function row(t, msg) { return '<button class="pr" onclick="inTec(' + t._i + ')"><div><div class="nm">' + esc(titleName(t.nombre)) + '</div><div class="ms">' + msg + '</div></div><div class="dd">' + t.d + '<small>días</small></div></button>'; }
  function col(k, tt, sub, L, f, emp) { return '<div class="col ' + k + '"><div class="col-h"><span class="d"></span><span class="t">' + tt + '</span><span class="n">' + L.length + '</span></div><div class="col-s">' + sub + '</div>' + (L.length ? L.map(f).join('') : '<div class="emp">' + emp + '</div>') + '</div>'; }
  h += '<div class="blk"><div class="blk-h"><span class="t">El equipo</span><span class="s">Clic en un técnico para ver su detalle</span></div><div class="cols">' +
    col('r', 'Debajo de la meta', 'No alcanzan 25 días este mes.', G.r, function (t) { return row(t, 'Máximo llega a ' + Math.round(t.maxPos) + ' días'); }, 'Nadie 👏') +
    col('a', 'Cerca de la meta', 'Pueden llegar si mantienen el ritmo.', G.a, function (t) { return row(t, t.dProj < IN_META.dias - 0.5 ? 'Necesita trabajar todos los días que quedan' : 'Le faltan ' + t.faltaFolSem + ' folios por semana para 3.5 al día'); }, 'Nadie') +
    col('g', 'En meta', 'En meta de días y folios.', G.g, function (t) { return row(t, t.prodT.toFixed(1) + ' folios al día'); }, 'Nadie todavía') + '</div></div>';
  h += '<div class="foot">QiORA Conecta · Cuadrillas internas · Documento informativo de productividad. Días y folios estimados al cierre al ritmo actual.</div></div>';
  return h;
}

function inTec(i) {
  var c = inCur(), t = c.tecs[i], mk = IN.monthKey, y = +mk.slice(0, 4), m = +mk.slice(5, 7) - 1;
  var fest = IN_FEST.filter(function (f) { return f.slice(0, 7) === mk; }), cls = t.grupo === 'g' ? 'good' : t.grupo === 'a' ? 'mid' : 'bad';
  var h = '<div class="mh"><div><div class="t">' + esc(titleName(t.nombre)) + '</div><div class="st">' + esc(t.u.join(' · ')) + ' · ' + esc(c.nombre) + '</div></div><button class="x" onclick="closeMo()">✕</button></div><div class="mb">';
  h += '<div class="kp"><div class="k ' + cls + '"><div class="l">Días trabajados</div><div class="v">' + t.d + '</div><div class="s">' + (c.cerrado ? 'mes completo' : 'va a llegar a ' + Math.round(t.dProj)) + ' · meta 25</div></div>' +
    '<div class="k ' + (t.prodT >= IN_META.prod ? 'good' : 'bad') + '"><div class="l">Folios al día</div><div class="v">' + t.prodT.toFixed(1) + '</div><div class="s">' + (c.cerrado ? '' : 'proyectado · ') + 'meta 3.5</div></div>' +
    '<div class="k"><div class="l">Folios</div><div class="v">' + (t.fol + t.fest) + '</div><div class="s">' + t.fpd.toFixed(1) + ' por día que trabajó</div></div>' +
    '<div class="k"><div class="l">Soporte · Recolección</div><div class="v">' + t.sop + ' · ' + t.reco + '</div><div class="s">' + (t.fest ? t.fest + ' en día festivo' : 'sin día festivo') + '</div></div></div>';
  var tipos = Object.keys(t.porTipo).sort(function (a, b) { return t.porTipo[b] - t.porTipo[a]; }), tot = 0; tipos.forEach(function (k) { tot += t.porTipo[k]; });
  h += '<div class="two"><div><div class="h4">Folios por tipo</div><table class="tt">';
  tipos.forEach(function (k) { var n = t.porTipo[k]; h += '<tr><td>' + esc(k) + '<div class="bar"><i style="width:' + Math.round(n / tot * 100) + '%"></i></div></td><td class="r">' + n + '</td></tr>'; });
  h += '<tr class="tot"><td>Total</td><td class="r">' + tot + '</td></tr></table></div>';
  var last = new Date(y, m + 1, 0).getDate(), first = (new Date(y, m, 1).getDay() + 6) % 7, corte = c.corte;
  h += '<div><div class="h4">Folios por día</div><div class="cal">';
  ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(function (d) { h += '<div class="wd">' + d + '</div>'; });
  for (var e = 0; e < first; e++) h += '<div class="c empty"></div>';
  for (var d = 1; d <= last; d++) {
    var key = mk + '-' + String(d).padStart(2, '0'), dow = new Date(y, m, d).getDay(), n = t.porDia[key] || 0, k = 'c';
    if (key > corte) k += ' fut'; else if (dow === 0 && !n) k += ' sun'; else k += n === 0 ? ' f0' : n < 3 ? ' f1' : n < 4 ? ' f2' : ' f3';
    if (fest.indexOf(key) >= 0) k += ' fest';
    h += '<div class="' + k + '"><b>' + (key > corte ? '' : (dow === 0 && !n ? '' : n)) + '</b>' + d + '</div>';
  }
  h += '</div><div class="leg"><span><i style="background:var(--red-lt)"></i>no trabajó</span><span><i style="background:#fbeccf"></i>1–2</span><span><i style="background:var(--qg-md)"></i>3</span><span><i style="background:var(--qg)"></i>4 o más</span>' + (fest.length ? '<span><i style="outline:2px solid var(--amb)"></i>día festivo</span>' : '') + '</div></div></div>';
  var note = t.grupo === 'r' ? ['r', '<b>No va a llegar a 25 días.</b> Lleva ' + t.d + ' días y aunque trabaje los ' + c.restH + ' que quedan llega a ' + Math.round(t.maxPos) + '.']
    : t.grupo === 'a' ? ['a', t.dProj < IN_META.dias - 0.5 ? '<b>Puede llegar.</b> Si no falta ningún día más llega a ' + Math.round(t.maxPos) + ' días.' : '<b>Puede llegar.</b> Viene diario; le faltan unos ' + t.faltaFolSem + ' folios más por semana para llegar a 3.5 al día.']
    : ['g', '<b>Va muy bien.</b> Está en la meta de días y de folios.'];
  h += '<div class="note ' + note[0] + '">' + note[1] + '</div></div>';
  openMo(h);
}
var IN_FEST = Calc.FESTIVOS;

// ----- app -----
function inSide() {
  var pago = INM === 'pago';
  var h = '<div class="pgseg"><button class="' + (pago ? '' : 'on') + '" onclick="inMode(\'prod\')">Productividad</button><button class="' + (pago ? 'on' : '') + '" onclick="inMode(\'pago\')">Preview de pago</button></div>' +
    '<button class="nv' + (INI < 0 ? ' on' : '') + '" onclick="inPick(-1)">▦ ' + (pago ? 'Pago por distrito' : 'Resumen por distrito') + '</button>';
  document.getElementById('innv').innerHTML = h;
  document.getElementById('inmesbox').style.display = pago ? 'none' : '';
  var L = pago ? (PG.distritos || []) : IN.distritos;
  document.getElementById('inlist').innerHTML = L.map(function (c, i) {
    var sub = pago ? '<span>' + c.conBono + ' de ' + c.tecs.length + ' con bono</span><span class="sem"><b>' + pgMoney(c.total) + '</b></span>' :
      '<span>' + c.activos + ' técnicos · ' + c.prod.toFixed(1) + ' folios/día</span><span class="sem">' +
      '<i style="background:var(--red)"></i>' + c.G.r + ' <i style="background:var(--amb);margin-left:4px"></i>' + c.G.a + ' <i style="background:var(--qg);margin-left:4px"></i>' + c.G.g + '</span>';
    return '<button class="ci' + (i === INI ? ' on' : '') + '" onclick="inPick(' + i + ')"><div class="cn">' + esc(c.nombre) + '</div><div class="cm">' + sub + '</div></button>';
  }).join('');
  var d1 = document.getElementById('inDl1'), dA = document.getElementById('inDlAll');
  d1.style.display = INI < 0 || (pago && PG.error) ? 'none' : '';
  d1.textContent = pago ? '⬇ Descargar pago de este distrito' : '⬇ Descargar este distrito';
  dA.textContent = pago ? '⬇ Pago de todos los distritos (.zip)' : '⬇ Descargar todos (.zip)';
  dA.style.display = pago && PG.error ? 'none' : '';
}
function inDraw() {
  inSide();
  var v = document.getElementById('inview');
  if (INM === 'pago') v.innerHTML = PG.error ? '<div class="pg"><div class="err">' + esc(PG.error) + '</div></div>' : INI < 0 ? pgResumen() : pgRender(pgCur());
  else v.innerHTML = INI < 0 ? inResumen() : inRender(inCur());
}
function inPick(i) { INI = i; inDraw(); window.scrollTo(0, 0); }
function inRun() {
  var s = document.getElementById('inmes');
  IN = inCompute(s.value); if (INM === 'prod' && INI >= IN.distritos.length) INI = -1; inDraw();
}
function inStart() {
  var s = document.getElementById('inmes'), cur = s.value;
  s.innerHTML = DATA.months.map(function (k) { return '<option value="' + k + '">' + cap(MESES[+k.slice(5, 7) - 1]) + ' ' + k.slice(0, 4) + '</option>'; }).join('');
  s.value = cur && DATA.months.indexOf(cur) >= 0 ? cur : (typeof RES !== 'undefined' && RES ? RES.monthKey : DATA.months[DATA.months.length - 1]);
  if (!PG || PG._d !== DATA) { PG = pgCompute(); PG._d = DATA; }
  inRun();
}

// ----- descarga -----
function inFile(c) { return 'Internas_' + slug(c.nombre) + '_' + IN.monthKey + '_al' + c.corte.slice(8, 10) + '.html'; }
function inExport(c) {
  var css = document.querySelector('style').textContent;
  var fns = [esc, titleName, inN, inMesTxt, inCur, inRender, inTec, openMo, closeMo].map(function (f) { return f.toString(); }).join('\n');
  var data = 'var MESES=' + JSON.stringify(MESES) + ';var IN_META=' + JSON.stringify(IN_META) + ';var IN_FEST=' + JSON.stringify(IN_FEST) + ';var INI=0;var IN=' +
    JSON.stringify({ monthKey: IN.monthKey, corte: IN.corte, distritos: [c] }).replace(/</g, '\\u003c') + ';';
  var js = data + '\n' + fns + '\nfunction $(id){return document.getElementById(id)}\n' +
    'document.getElementById("mo").onclick=function(e){if(e.target.id==="mo")closeMo()};document.addEventListener("keydown",function(e){if(e.key==="Escape")closeMo()});document.getElementById("inview").innerHTML=inRender(inCur());';
  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Cuadrillas internas ' + esc(c.nombre) + ' ' + inMesTxt() + '</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">' +
    '<style>' + css + '.xbar{background:#fff;border-bottom:1px solid var(--g2)}.xbar div{max-width:1120px;margin:0 auto;padding:16px 48px;display:flex;justify-content:space-between;align-items:center}.xbar img{height:30px}.xbar button{border:none;background:var(--ink);color:#fff;border-radius:10px;padding:9px 14px;font-weight:700}@media print{.xbar button{display:none}}</style></head><body>' +
    '<div class="xbar"><div><img src="' + LOGO + '" alt="QiORA Conecta"><button onclick="window.print()">Imprimir / PDF</button></div></div>' +
    '<div id="inview"></div><div class="mo" id="mo"><div class="mc" id="mc"></div></div><script>' + js + '<\/script></body></' + 'html>';
}
function inDownloadOne() {
  if (INM === 'pago') { var p = pgCur(); if (p) saveBlob(new Blob([pgExport(p)], { type: 'text/html' }), pgFile(p)); return; }
  var c = inCur(); if (c) saveBlob(new Blob([inExport(c)], { type: 'text/html' }), inFile(c)); }
function inDownloadAll() {
  if (INM === 'pago') { var z = new JSZip(); PG.distritos.forEach(function (c) { z.file(pgFile(c), pgExport(c)); });
    z.generateAsync({ type: 'blob' }).then(function (b) { saveBlob(b, 'Pago_cuadrillas_internas_' + pgTag() + '.zip'); }); return; }
  var zip = new JSZip(); IN.distritos.forEach(function (c) { zip.file(inFile(c), inExport(c)); });
  zip.generateAsync({ type: 'blob' }).then(function (b) { saveBlob(b, 'Cuadrillas_internas_' + IN.monthKey + '.zip'); });
}
document.getElementById('inmes').onchange = inRun;
document.getElementById('inDl1').onclick = inDownloadOne;
document.getElementById('inDlAll').onclick = inDownloadAll;
document.getElementById('inChg').onclick = function () { location.reload(); };

// ===== Preview de pago (pestaña 3, modo "Preview de pago") =====
// Bono semanal de internas tal cual lo calcula el archivo de bonos (hojas Detalle de servicios, Motos y Auxiliares).
// No se recalcula: es para que cada distrital coteje y dé visto bueno al pago de sus cuadrillas.
var INM = 'prod', PG = null;
function pgMoney(n) { n = Math.round(n || 0); return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US'); }
function pgFecha(k) { return (+k.slice(8, 10)) + ' ' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][+k.slice(5, 7) - 1]; }
function pgCur() { return PG.distritos[INI]; }
function pgCompute() {
  var P = DATA.pago;
  if (!P || P.error || !P.det) return { error: P && P.error ? P.error : 'El archivo no trae la hoja "Detalle de servicios" con el bono de internas.' };
  var corte = ''; DATA.rows.forEach(function (r) { if (r[1] > corte) corte = r[1]; });
  var idx = [], sem = [];
  P.semanas.forEach(function (s, i) { if (s.ini && s.ini <= corte) { idx.push(i); sem.push({ n: s.n, ini: s.ini, fin: s.fin, abierta: s.fin > corte }); } });
  function isInt(u, ctr) { var t = DATA.tec[u], c = t ? t.contratista : ctr; return String(c || '').trim().toUpperCase() === 'INTERNO'; }
  var D = {};
  function get(u, suc, nom, tipo) {
    var dd = inDist(suc), k = inNorm(nom || u), g = D[dd.k] || (D[dd.k] = { dist: dd.k, nombre: dd.n, map: {}, tecs: [], auxM: {} }), t = g.map[k];
    if (!t) { t = g.map[k] = { nombre: String(nom || u).replace(/\s+/g, ' ').trim(), u: [], tipo: tipo || '', metas: null, w: sem.map(function () { return { dias: 0, ord: 0, extra: 0, base: 0, adic: 0, desc: 0, motoFol: 0, moto: 0, tot: 0 }; }) }; g.tecs.push(t); }
    if (t.u.indexOf(u) < 0) t.u.push(u);
    return t;
  }
  P.det.forEach(function (x) {
    if (!isInt(x.u, x.ctr)) return;
    var t = get(x.u, x.suc, x.nom, x.tipo); if (x.metas && x.metas[0]) t.metas = x.metas;
    idx.forEach(function (i, j) { var a = x.w[i], o = t.w[j]; o.dias += a[0]; o.ord += a[1]; o.extra += a[2]; o.base += a[3]; o.adic += a[4]; o.desc += a[5]; o.tot += a[6]; });
  });
  Object.keys(P.motos || {}).forEach(function (u) {
    var tt = DATA.tec[u]; if (!tt || !isInt(u)) return;
    var m = P.motos[u], t = get(u, tt.sucursal, tt.nombre, 'Moto');
    sem.forEach(function (s, j) { var v = m[s.n]; if (!v) return; t.w[j].motoFol += v[0]; t.w[j].moto += v[1]; t.w[j].tot += v[1]; });
  });
  (P.aux || []).forEach(function (a) {
    var tt = DATA.tec[a.u]; if (!tt || !isInt(a.u)) return;
    var g = D[inDist(tt.sucursal).k]; if (!g) return;
    var x = g.auxM[a.aux] || (g.auxM[a.aux] = { nombre: a.aux, tecs: [], m: sem.map(function () { return 0; }) });
    var tn = String(a.tec || a.u).replace(/\s+/g, ' ').trim(); if (x.tecs.indexOf(tn) < 0) x.tecs.push(tn);
    sem.forEach(function (s, j) { x.m[j] += a.m[s.n] || 0; });
  });
  var out = Object.keys(D).map(function (k) {
    var g = D[k];
    g.tecs = g.tecs.filter(function (t) { return t.w.some(function (o) { return o.dias || o.tot || o.motoFol; }); });
    g.aux = Object.keys(g.auxM).map(function (n) { var a = g.auxM[n]; a.total = 0; a.m.forEach(function (v, j) { if (!sem[j].abierta) a.total += v; }); return a; }).filter(function (a) { return a.m.some(Boolean); });
    delete g.auxM; delete g.map;
    g.tecs.forEach(function (t) { t.total = 0; t.w.forEach(function (o, j) { if (!sem[j].abierta) t.total += o.tot; }); });
    g.tecs.sort(function (a, b) { return titleName(a.nombre).localeCompare(titleName(b.nombre)); });
    g.semTot = sem.map(function (s, j) { var v = 0; g.tecs.forEach(function (t) { v += t.w[j].tot; }); g.aux.forEach(function (a) { v += a.m[j]; }); return v; });
    g.total = 0; g.semTot.forEach(function (v, j) { if (!sem[j].abierta) g.total += v; });
    g.conBono = g.tecs.filter(function (t) { return t.total > 0; }).length;
    return g;
  }).filter(function (g) { return g.tecs.length; });
  out.sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
  return { corte: corte, semanas: sem, distritos: out };
}
function pgSemTxt() {
  var S = PG.semanas.filter(function (s) { return !s.abierta; });
  if (!S.length) return 'sin semanas completas';
  return (S.length > 1 ? 'Semanas ' + S[0].n + ' a ' + S[S.length - 1].n : 'Semana ' + S[0].n) + ' · del ' + pgFecha(S[0].ini) + ' al ' + pgFecha(S[S.length - 1].fin);
}
function pgTh() {
  return PG.semanas.map(function (s) { return '<th class="r' + (s.abierta ? ' pgop' : '') + '">Sem ' + s.n + '<div class="pgsd">' + pgFecha(s.ini) + ' – ' + pgFecha(s.fin) + (s.abierta ? '<br>en curso' : '') + '</div></th>'; }).join('');
}
function pgResumen() {
  var S = PG.semanas, L = PG.distritos, T = { n: 0, b: 0, t: 0, s: S.map(function () { return 0; }) };
  L.forEach(function (c) { T.n += c.tecs.length; T.b += c.conBono; T.t += c.total; c.semTot.forEach(function (v, j) { T.s[j] += v; }); });
  var h = '<div class="pg wide"><div class="pg-h"><div class="ey">Cuadrillas internas · Preview de pago · ' + pgSemTxt() + '</div><h1>Pago por distrito</h1>';
  h += '<div class="meta"><span><b>' + L.length + '</b> distritos</span><span>Cuadrillas con bono: <b>' + T.b + ' de ' + T.n + '</b></span><span>Total a pagar: <b>' + pgMoney(T.t) + '</b></span><span>Datos al <b>' + pgFecha(PG.corte) + '</b></span></div></div>';
  h += '<div class="blk"><div class="tw2"><table class="rs"><thead><tr><th>Distrito</th><th class="r">Cuadrillas con bono</th>' + pgTh() + '<th class="r">Total a pagar</th></tr></thead><tbody>';
  L.forEach(function (c, i) {
    h += '<tr class="st" onclick="inPick(' + i + ')"><td class="nm">' + esc(c.nombre) + ' <span style="color:var(--g4);font-weight:500">· ' + c.dist + '</span></td><td class="r">' + c.conBono + ' de ' + c.tecs.length + '</td>' +
      c.semTot.map(function (v, j) { return '<td class="r' + (S[j].abierta ? ' pgop' : '') + '">' + (v ? pgMoney(v) : '—') + '</td>'; }).join('') + '<td class="r"><b>' + pgMoney(c.total) + '</b></td></tr>';
  });
  h += '</tbody><tfoot><tr><td>Total</td><td class="r">' + T.b + ' de ' + T.n + '</td>' + T.s.map(function (v, j) { return '<td class="r' + (S[j].abierta ? ' pgop' : '') + '">' + pgMoney(v) + '</td>'; }).join('') + '<td class="r">' + pgMoney(T.t) + '</td></tr></tfoot></table></div></div>';
  h += '<div class="foot">Montos tal cual los calcula el archivo de bonos (hojas Detalle de servicios, Motos y Auxiliares).' + (S.some(function (s) { return s.abierta; }) ? ' La semana en curso se muestra pero no entra al total.' : '') + '</div></div>';
  return h;
}
function pgRender(c) {
  var S = PG.semanas, open = S.some(function (s) { return s.abierta; }), hasM = c.tecs.some(function (t) { return t.w.some(function (o) { return o.motoFol; }); });
  var h = '<div class="pg wide"><div class="pg-h"><div class="ey">Cuadrillas internas · Preview de pago · ' + pgSemTxt() + '</div><h1>' + esc(c.nombre) + '</h1>';
  h += '<div class="meta"><span>Distrito <b>' + c.dist + '</b></span><span>Cuadrillas con bono: <b>' + c.conBono + ' de ' + c.tecs.length + '</b></span><span>Total a pagar: <b>' + pgMoney(c.total) + '</b></span><span>Datos al <b>' + pgFecha(PG.corte) + '</b></span></div></div>';
  h += '<div class="note a"><b>Preview para revisión, todavía no es el pago final.</b> Revisa que estén todas tus cuadrillas, sus días, sus órdenes y su bono de cada semana. Si algo no cuadra, márcalo en la columna <b>Revisar</b> y explícalo abajo en el visto bueno.</div>';
  h += '<div class="blk"><div class="blk-h"><span class="t">Total por semana</span><span class="s">' + c.tecs.length + ' cuadrillas' + (c.aux.length ? ' · ' + c.aux.length + ' auxiliares' : '') + '</span></div><div class="pgcards">';
  S.forEach(function (s, j) { h += '<div class="ac' + (s.abierta ? ' pgop' : '') + '"><div class="g">' + pgMoney(c.semTot[j]) + '</div><b>Semana ' + s.n + '</b><span>' + pgFecha(s.ini) + ' – ' + pgFecha(s.fin) + (s.abierta ? ' · en curso, no entra al total' : '') + '</span></div>'; });
  h += '<div class="ac ok"><div class="g">' + pgMoney(c.total) + '</div><b>Total a pagar</b><span>' + pgSemTxt().split(' · ')[0] + '</span></div></div></div>';
  h += '<div class="blk"><div class="blk-h"><span class="t">Bono por cuadrilla</span><span class="s">Clic en el nombre para ver el detalle de cada semana</span></div><div class="tw2"><table class="rs pgt"><thead><tr><th>Cuadrilla</th>' + pgTh() + '<th class="r">Total</th><th class="pgrv">Revisar</th></tr></thead><tbody>';
  c.tecs.forEach(function (t, i) {
    h += '<tr><td class="nm"><a href="javascript:void 0" onclick="pgTec(' + i + ')">' + esc(titleName(t.nombre)) + '</a><div class="pgsd">' + esc(t.u.join(' · ')) + (t.tipo ? ' · ' + esc(t.tipo) : '') + '</div></td>';
    t.w.forEach(function (o, j) {
      var sub = o.motoFol ? o.motoFol + ' folios' : o.dias ? o.dias + ' días · ' + o.ord + ' órd.' : 'no trabajó';
      h += '<td class="r' + (S[j].abierta ? ' pgop' : '') + (!o.tot && o.dias ? ' pgz' : '') + '">' + (o.tot ? pgMoney(o.tot) : '—') + '<div class="pgsd">' + sub + '</div></td>';
    });
    h += '<td class="r"><b>' + (t.total ? pgMoney(t.total) : '—') + '</b></td><td class="pgrv"><input type="checkbox" id="pgrv' + i + '" aria-label="Revisar"></td></tr>';
  });
  var tt = 0; c.tecs.forEach(function (t) { tt += t.total; });
  h += '</tbody><tfoot><tr><td>Total cuadrillas</td>' + S.map(function (s, j) { var v = 0; c.tecs.forEach(function (t) { v += t.w[j].tot; }); return '<td class="r' + (s.abierta ? ' pgop' : '') + '">' + pgMoney(v) + '</td>'; }).join('') + '<td class="r">' + pgMoney(tt) + '</td><td></td></tr></tfoot></table></div></div>';
  if (c.aux.length) {
    h += '<div class="blk"><div class="blk-h"><span class="t">Auxiliares</span><span class="s">Bono del auxiliar por las semanas de sus técnicos</span></div><div class="tw2"><table class="rs"><thead><tr><th>Auxiliar</th>' + pgTh() + '<th class="r">Total</th></tr></thead><tbody>';
    c.aux.forEach(function (a) { h += '<tr><td class="nm">' + esc(titleName(a.nombre)) + '<div class="pgsd">con ' + esc(a.tecs.map(titleName).join(', ')) + '</div></td>' + a.m.map(function (v, j) { return '<td class="r' + (S[j].abierta ? ' pgop' : '') + '">' + (v ? pgMoney(v) : '—') + '</td>'; }).join('') + '<td class="r"><b>' + pgMoney(a.total) + '</b></td></tr>'; });
    h += '</tbody></table></div></div>';
  }
  h += '<div class="blk"><div class="blk-h"><span class="t">Cómo se calcula</span></div><div class="how" style="margin:0">' +
    'Cada semana (lunes a domingo) se cuentan las órdenes de la cuadrilla contra las metas de su distrito' + (c.tecs[0] && c.tecs[0].metas ? ' (' + c.tecs.filter(function (t) { return t.metas; })[0].metas.join(' / ') + ' órdenes: base / media / alta)' : '') + '. ' +
    'Según la meta que alcanza gana el bono base, medio o alto, y cada orden arriba de la meta alta suma un adicional. ' +
    'Si trabajó 5 días en la semana el bono baja a la mitad y con 4 días o menos no hay bono.' + (hasM ? ' Motos: pago por folios de la semana.' : '') + (c.aux.length ? ' Auxiliares: bono por las semanas que el técnico con quien trabaja llega a su meta.' : '') + '</div></div>';
  h += '<div class="blk pgvb"><div class="blk-h"><span class="t">Visto bueno del distrital</span><span class="s">Responde por WhatsApp o correo</span></div>' +
    '<label class="pgl">Observaciones (si algo no cuadra)</label><textarea id="pgObs" rows="3" placeholder="Ej. Juan Pérez sí trabajó el sábado 8, le faltan órdenes en la semana 45"></textarea>' +
    '<div class="pgbtns"><button onclick="pgCopy(true)">✓ Copiar visto bueno</button><button class="sec" onclick="pgCopy(false)">Copiar observaciones</button><span id="pgOk"></span></div>' +
    '<div class="pgfirma"><div>Nombre del distrital</div><div>Firma</div><div>Fecha</div></div></div>';
  h += '<div class="foot">QiORA Conecta · Cuadrillas internas · Preview de pago de bono para revisión del distrital. Montos tal cual los calcula el archivo de bonos con datos al ' + pgFecha(PG.corte) + '; pueden cambiar si se corrige algo en la revisión.' + (open ? ' La semana en curso no entra al total.' : '') + '</div></div>';
  return h;
}
function pgTec(i) {
  var c = pgCur(), t = c.tecs[i], S = PG.semanas, hasM = t.w.some(function (o) { return o.motoFol; }), hasD = t.w.some(function (o) { return o.dias; });
  var h = '<div class="mh"><div><div class="t">' + esc(titleName(t.nombre)) + '</div><div class="st">' + esc(t.u.join(' · ')) + ' · ' + esc(c.nombre) + (t.tipo ? ' · ' + esc(t.tipo) : '') + '</div></div><button class="x" onclick="closeMo()">✕</button></div><div class="mb">';
  h += '<div class="kp"><div class="k good"><div class="l">Total a pagar</div><div class="v">' + pgMoney(t.total) + '</div><div class="s">' + pgSemTxt().split(' · ')[0] + '</div></div>' +
    (t.metas ? '<div class="k"><div class="l">Metas por semana</div><div class="v">' + t.metas.join(' / ') + '</div><div class="s">órdenes: base / media / alta</div></div>' : '') + '</div>';
  h += '<div class="tw2"><table class="rs"><thead><tr><th>Semana</th>' + (hasD ? '<th class="r">Días</th><th class="r">Órdenes</th><th class="r">Arriba de meta</th><th class="r">Bono base</th><th class="r">Adicional</th><th class="r">Descuento</th>' : '') + (hasM ? '<th class="r">Folios moto</th><th class="r">Pago moto</th>' : '') + '<th class="r">Total</th></tr></thead><tbody>';
  t.w.forEach(function (o, j) {
    h += '<tr' + (S[j].abierta ? ' class="pgop"' : '') + '><td>Sem ' + S[j].n + '<div class="pgsd">' + pgFecha(S[j].ini) + ' – ' + pgFecha(S[j].fin) + (S[j].abierta ? ' · en curso' : '') + '</div></td>' +
      (hasD ? '<td class="r' + (o.dias && o.dias <= 5 ? ' bad' : '') + '">' + o.dias + '</td><td class="r">' + o.ord + '</td><td class="r">' + (o.extra || '—') + '</td><td class="r">' + (o.base ? pgMoney(o.base) : '—') + '</td><td class="r">' + (o.adic ? pgMoney(o.adic) : '—') + '</td><td class="r' + (o.desc ? ' bad' : '') + '">' + (o.desc ? pgMoney(o.desc) : '—') + '</td>' : '') +
      (hasM ? '<td class="r">' + (o.motoFol || '—') + '</td><td class="r">' + (o.moto ? pgMoney(o.moto) : '—') + '</td>' : '') + '<td class="r"><b>' + (o.tot ? pgMoney(o.tot) : '—') + '</b></td></tr>';
  });
  h += '</tbody></table></div>';
  if (hasD) h += '<div class="how">Días en rojo: con 5 días el bono baja a la mitad y con 4 o menos no hay bono.</div>';
  h += '</div>';
  openMo(h);
}
function pgMsg(ok) {
  var c = pgCur(), L = [], obs = (document.getElementById('pgObs') || {}).value || '';
  c.tecs.forEach(function (t, i) { var e = document.getElementById('pgrv' + i); if (e && e.checked) L.push('- ' + titleName(t.nombre) + ' (' + t.u.join(', ') + '): ' + pgMoney(t.total)); });
  var m = (ok && !L.length ? '✅ Visto bueno' : '⚠️ Revisión') + ' · Pago cuadrillas internas\nDistrito: ' + c.nombre + ' (' + c.dist + ')\n' + pgSemTxt() + '\nTotal: ' + pgMoney(c.total) + ' · ' + c.conBono + ' cuadrillas con bono\n';
  if (L.length) m += '\nRevisar:\n' + L.join('\n') + '\n';
  if (obs.trim()) m += '\nObservaciones: ' + obs.trim() + '\n';
  if (ok && !L.length && !obs.trim()) m += '\nTodo correcto, se puede pagar.';
  return m;
}
function pgCopy(ok) {
  var m = pgMsg(ok), done = function () { var s = document.getElementById('pgOk'); if (s) { s.textContent = 'Copiado. Pégalo en WhatsApp.'; setTimeout(function () { s.textContent = ''; }, 4000); } };
  function fb() { var ta = document.createElement('textarea'); ta.value = m; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { prompt('Copia este mensaje:', m); } ta.remove(); }
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(m).then(done, fb); else fb();
}
function pgTag() { var S = PG.semanas.filter(function (s) { return !s.abierta; }); return 'sem' + (S.length ? S[0].n + (S.length > 1 ? '-' + S[S.length - 1].n : '') : ''); }
function pgFile(c) { return 'Pago_internas_' + slug(c.nombre) + '_' + pgTag() + '.html'; }
function pgExport(c) {
  var css = document.querySelector('style').textContent;
  var fns = [esc, titleName, pgMoney, pgFecha, pgCur, pgSemTxt, pgTh, pgRender, pgTec, pgMsg, pgCopy, openMo, closeMo].map(function (f) { return f.toString(); }).join('\n');
  var data = 'var INI=0;var PG=' + JSON.stringify({ corte: PG.corte, semanas: PG.semanas, distritos: [c] }).replace(/</g, '\\u003c') + ';';
  var js = data + '\n' + fns + '\nfunction $(id){return document.getElementById(id)}\n' +
    'document.getElementById("mo").onclick=function(e){if(e.target.id==="mo")closeMo()};document.addEventListener("keydown",function(e){if(e.key==="Escape")closeMo()});document.getElementById("inview").innerHTML=pgRender(pgCur());';
  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Pago cuadrillas internas ' + esc(c.nombre) + '</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">' +
    '<style>' + css + '.xbar{background:#fff;border-bottom:1px solid var(--g2)}.xbar div{max-width:1120px;margin:0 auto;padding:16px 48px;display:flex;justify-content:space-between;align-items:center}.xbar img{height:30px}.xbar button{border:none;background:var(--ink);color:#fff;border-radius:10px;padding:9px 14px;font-weight:700}@media print{.xbar button{display:none}}</style></head><body>' +
    '<div class="xbar"><div><img src="' + LOGO + '" alt="QiORA Conecta"><button onclick="window.print()">Imprimir / PDF</button></div></div>' +
    '<div id="inview"></div><div class="mo" id="mo"><div class="mc" id="mc"></div></div><script>' + js + '<\/script></body></' + 'html>';
}
function inMode(m) {
  var cur = INI >= 0 ? (INM === 'pago' ? PG.distritos : IN.distritos)[INI] : null;
  INM = m; INI = -1;
  if (cur) { var L = m === 'pago' ? (PG.distritos || []) : IN.distritos; for (var i = 0; i < L.length; i++) if (L[i].dist === cur.dist) INI = i; }
  inDraw(); window.scrollTo(0, 0);
}
