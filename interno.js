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
  var h = '<button class="nv' + (INI < 0 ? ' on' : '') + '" onclick="inPick(-1)">▦ Resumen por distrito</button>';
  document.getElementById('innv').innerHTML = h;
  document.getElementById('inlist').innerHTML = IN.distritos.map(function (c, i) {
    return '<button class="ci' + (i === INI ? ' on' : '') + '" onclick="inPick(' + i + ')"><div class="cn">' + esc(c.nombre) + '</div><div class="cm"><span>' + c.activos + ' técnicos · ' + c.prod.toFixed(1) + ' folios/día</span><span class="sem">' +
      '<i style="background:var(--red)"></i>' + c.G.r + ' <i style="background:var(--amb);margin-left:4px"></i>' + c.G.a + ' <i style="background:var(--qg);margin-left:4px"></i>' + c.G.g + '</span></div></button>';
  }).join('');
  document.getElementById('inDl1').style.display = INI < 0 ? 'none' : '';
}
function inDraw() {
  inSide();
  document.getElementById('inview').innerHTML = INI < 0 ? inResumen() : inRender(inCur());
}
function inPick(i) { INI = i; inDraw(); window.scrollTo(0, 0); }
function inRun() {
  var s = document.getElementById('inmes');
  IN = inCompute(s.value); if (INI >= IN.distritos.length) INI = -1; inDraw();
}
function inStart() {
  var s = document.getElementById('inmes'), cur = s.value;
  s.innerHTML = DATA.months.map(function (k) { return '<option value="' + k + '">' + cap(MESES[+k.slice(5, 7) - 1]) + ' ' + k.slice(0, 4) + '</option>'; }).join('');
  s.value = cur && DATA.months.indexOf(cur) >= 0 ? cur : (typeof RES !== 'undefined' && RES ? RES.monthKey : DATA.months[DATA.months.length - 1]);
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
function inDownloadOne() { var c = inCur(); if (c) saveBlob(new Blob([inExport(c)], { type: 'text/html' }), inFile(c)); }
function inDownloadAll() {
  var zip = new JSZip(); IN.distritos.forEach(function (c) { zip.file(inFile(c), inExport(c)); });
  zip.generateAsync({ type: 'blob' }).then(function (b) { saveBlob(b, 'Cuadrillas_internas_' + IN.monthKey + '.zip'); });
}
document.getElementById('inmes').onchange = inRun;
document.getElementById('inDl1').onclick = inDownloadOne;
document.getElementById('inDlAll').onclick = inDownloadAll;
document.getElementById('inChg').onclick = function () { location.reload(); };
