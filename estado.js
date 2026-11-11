// ===== Estado de cuenta de cierre de mes (nuevo esquema) =====
// Lee el archivo "COMISIONES CONTRATISTA <MES>": una hoja por contratista (o por distrito, como Marco Anaya),
// con la tabla de cuadrillas del nuevo esquema (Usuario para pago, Precio base, Soporte, Recolección…) y los
// adicionales y descuentos. Hojas con el formato anterior (estrellas) o sin tabla se omiten.
var EC = null, ECI = 0, ECSUC = 'ALL', ECOPEN = {}, TAB = 'a';
var EC_MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function ecU(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function ecL(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
function ecN(v) { var n = +v; return isFinite(n) ? n : 0; }
function ecIso(d) { d = new Date(d.getTime() + 12 * 3600e3); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }

function ecParseSheet(rows, sheet) {
  var h = -1;
  for (var i = 0; i < rows.length; i++) { var r = rows[i] || [];
    if (r.some(function (x) { return ecU(x) === 'USUARIO PARA PAGO'; }) && r.some(function (x) { return ecU(x) === 'PRECIO BASE'; })) { h = i; break; } }
  if (h < 0) {
    var old = rows.some(function (r) { return r && r.some(function (x) { return ecU(x).indexOf('ESTRELLAS') >= 0; }); });
    return { skip: true, hoja: sheet, por: old ? 'formato anterior (estrellas)' : 'sin tabla de cuadrillas' };
  }
  var lc = 2, nombre = '';
  for (i = 0; i < h && !nombre; i++) { r = rows[i] || [];
    for (var j = 0; j < r.length; j++) if (ecU(r[j]) === 'ESTADO DE CUENTA CONTRATISTA') { lc = j; nombre = ecL(r[j + 1]); break; } }
  var S = { hoja: sheet.trim(), nombre: nombre || sheet.trim(), fechas: [], adic: [], cuad: [], cuadrillas: 0, asist: 0, os: 0, pago: 0, descTot: 0, subtotal: 0, iva: 0, total: 0 };
  var mode = '';
  for (i = 0; i < h; i++) { r = rows[i] || []; var L = ecU(r[lc]), V = r[lc + 1];
    if (V instanceof Date) S.fechas.push(ecIso(V));
    if (!L) continue;
    if (L === 'ADICIONALES Y DESCUENTOS') { mode = 'adic'; continue; }
    if (mode === 'adic') { if (L === 'TOTAL') { S.descTot = ecN(V); mode = 'post'; } else S.adic.push({ c: ecL(r[lc]), m: ecN(V) }); continue; }
    if (mode === 'post') { if (L === 'SUBTOTAL A FACTURAR') S.subtotal = ecN(V); else if (L === 'IVA Y RETENCIONES') S.iva = ecN(V); else if (L === 'TOTAL') { S.total = ecN(V); mode = 'fin'; } continue; }
    if (L === 'CUADRILLAS ACTIVAS') S.cuadrillas = ecN(V);
    else if (L === 'ASISTENCIAS TOTALES') S.asist = ecN(V);
    else if (L === 'OS TOTALES') S.os = ecN(V);
    else if (L === 'PAGO TOTAL') S.pago = ecN(V);
  }
  var H = (rows[h] || []).map(ecU);
  function col(n) { return H.indexOf(n); }
  var C = { u: col('USUARIO PARA PAGO'), suc: col('SUCURSAL'), tipo: col('TIPO DISTRITO'), ctr: col('CONTRATISTA'), p: col('PRECIO BASE'), ps: col('PRECIO SOPORTE'),
    pr: col('PRECIO RECOLECCION'), fol: col('FOLIOS TOTAL'), d: col('# ASISTENCIAS'), sop: col('SOPORTE'), reco: col('RECOLECCION'), otras: col('OTRAS OS'),
    fest: col('DIA FESTIVO'), sopM: col('$$$ SOPORTE'), recoM: col('$$$ RECOLECCION'), otrasM: col('$$$ OTRAS OS'), boost: col('BOOST DIA FESTIVO'),
    festM: col('$$$ DIA FESTIVO'), tot: col('TOTAL') };
  function g(r, k) { return C[k] >= 0 ? r[C[k]] : null; }
  for (i = h + 1; i < rows.length; i++) { r = rows[i] || []; var u = ecL(g(r, 'u'));
    if (!u) { if (S.cuad.length) break; else continue; }
    var suc = ecL(g(r, 'suc'));
    S.cuad.push({ u: u, suc: suc, dist: Calc.distDe(suc), ctr: ecL(g(r, 'ctr')), p: ecN(g(r, 'p')), ps: ecN(g(r, 'ps')), pr: ecN(g(r, 'pr')),
      fol: ecN(g(r, 'fol')), d: ecN(g(r, 'd')), sop: ecN(g(r, 'sop')), reco: ecN(g(r, 'reco')), otras: ecN(g(r, 'otras')), fest: ecN(g(r, 'fest')),
      sopM: ecN(g(r, 'sopM')), recoM: ecN(g(r, 'recoM')), otrasM: ecN(g(r, 'otrasM')), boost: ecN(g(r, 'boost')), festM: ecN(g(r, 'festM')), tot: ecN(g(r, 'tot')) });
  }
  if (!S.cuad.length) return { skip: true, hoja: sheet, por: 'sin cuadrillas' };
  var sumT = S.cuad.reduce(function (a, c) { return a + c.tot; }, 0);
  if (!S.pago) S.pago = sumT;
  S.dif = Math.round(sumT - S.pago);
  // Ajuste del precio: con el HC autorizado del mes se reproduce el precio del archivo (días por cuadrilla y folios al día)
  S.fechas.sort(); S.inicio = S.fechas[0] || ''; S.fin = S.fechas[S.fechas.length - 1] || '';
  var mk = (S.inicio || '').slice(0, 7), ent = Calc.matchC(S.cuad[0].ctr, S.cuad[0].dist) || Calc.matchC(S.nombre, S.cuad[0].dist) || Calc.matchC(sheet, S.cuad[0].dist);
  S.parteNombre = ent && ent.corto ? ent.corto : titleName(S.hoja);
  var hc = ent && mk ? Calc.hcFor(ent.id, mk) : null;
  if (hc) {
    var A = 0, F = 0; S.cuad.forEach(function (c) { A += c.d; F += c.fol; });
    var a = Math.floor(A / hc), pr = Math.floor(F / hc / Calc.P.diasMes * 10) / 10, pa = Calc.precioA(a, pr);
    var adjA = a >= Calc.P.metaDias ? 0 : -(Calc.P.metaDias - Math.max(a, Calc.P.metaDias - 2)) * Calc.P.penal;
    var ok = S.cuad.every(function (c) { var tp = Calc.tipoDist(c.dist), o = Calc.baseFor(ent.id, c.dist, mk);
      var base = o != null ? o : Calc.P.base.A + (tp === 'LM' ? 50 : tp === 'B' ? -40 : 0); return Math.abs(base + pa - Calc.P.base.A - c.p) < 0.5; });
    S.regla = { hc: hc, dias: a, prod: pr, adjA: adjA, adjP: pa - Calc.P.base.A - adjA, ok: ok };
  }
  return S;
}

function ecParse(wb) {
  var G = {}, ord = [], skip = [];
  wb.SheetNames.forEach(function (n) {
    var rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null });
    var S = ecParseSheet(rows, n);
    if (S.skip) { skip.push(S); return; }
    var k = ecU(S.nombre);
    if (!G[k]) { G[k] = { nombre: titleName(S.nombre), partes: [] }; ord.push(k); }
    G[k].partes.push(S);
  });
  var L = ord.map(function (k) { var c = G[k];
    c.partes.sort(function (a, b) { return b.pago - a.pago; });
    ['cuadrillas', 'asist', 'os', 'pago', 'descTot', 'subtotal', 'iva', 'total'].forEach(function (f) { c[f] = c.partes.reduce(function (a, p) { return a + p[f]; }, 0); });
    var fs = []; c.partes.forEach(function (p) { fs = fs.concat(p.fechas); }); fs.sort();
    c.inicio = fs[0] || ''; c.fin = fs[fs.length - 1] || '';
    return c; });
  L.sort(function (a, b) { return a.nombre < b.nombre ? -1 : 1; });
  return { contratistas: L, omitidas: skip };
}

// ---------- vista ----------
function ecF(n) { var r = Math.round(n || 0); return (r < 0 ? '−$' : '$') + Math.abs(r).toLocaleString('en-US'); }
function ecDash(n) { return Math.round(n || 0) === 0 ? '<span class="z">—</span>' : ecF(n); }
function ecPeriodo(c) {
  if (!c.inicio) return '';
  var a = c.inicio, b = c.fin || a, m = EC_MES[+b.slice(5, 7) - 1];
  return (+a.slice(8, 10)) + (a.slice(0, 7) === b.slice(0, 7) ? '' : ' ' + EC_MES[+a.slice(5, 7) - 1]) + ' al ' + (+b.slice(8, 10)) + ' de ' + m + ' ' + b.slice(0, 4);
}
function ecMesTxt(c) { var k = c.fin || c.inicio; return k ? EC_MES[+k.slice(5, 7) - 1].replace(/^./, function (x) { return x.toUpperCase(); }) + ' ' + k.slice(0, 4) : ''; }
function ecName(u) { return (typeof EC_NAMES !== 'undefined' && EC_NAMES[u]) ? titleName(EC_NAMES[u]) : u; }
function ecSuc(s) { var n = String(s || '').replace(/^.*?INT-[A-Z]{2,3}\s*/, '').trim(); return n ? titleName(n).replace(/\bGdl\b/g, 'GDL') : s; }
function ecSum(L, f) { return L.reduce(function (a, x) { return a + (x[f] || 0); }, 0); }
function ecPrecios(cuad) { // precios distintos dentro de un grupo de cuadrillas
  var o = {}; cuad.forEach(function (c) { o[c.p] = (o[c.p] || 0) + c.fol; });
  return Object.keys(o).map(Number).sort(function (a, b) { return o[b] - o[a]; });
}
function ecAdj(n) { return n > 0 ? '+$' + n : n < 0 ? '−$' + (-n) : '$0'; }

function ecPriceCard(c) {
  var multi = c.partes.length > 1;
  var h = '<div class="c-price"><div class="top"><span class="l">Tu precio por folio</span></div>';
  c.partes.forEach(function (p) {
    var R = p.regla, pr = ecPrecios(p.cuad);
    h += '<div class="ecp">' + (multi ? '<div class="ecp-n">' + esc(p.parteNombre) + '</div>' : '') +
      '<div class="ecp-v">' + pr.map(function (x) { return '$' + x; }).join(' · ') + '</div>';
    if (R && R.ok) h += '<div class="ecp-w"><span>' + R.dias + ' días por cuadrilla <b class="' + (R.adjA < 0 ? 'dn' : 'z') + '">' + ecAdj(R.adjA) + '</b></span>' +
      '<span>' + R.prod.toFixed(1) + ' folios al día <b class="' + (R.adjP > 0 ? 'up' : 'z') + '">' + ecAdj(R.adjP) + '</b></span><span>HC autorizado ' + R.hc + '</span></div>';
    h += '<div class="ecp-s">Soporte ' + ecPrecios(p.cuad.map(function (x) { return { p: x.ps, fol: x.fol }; })).map(function (x) { return '$' + x; }).join(' · ') + ' · Recolección $' + (p.cuad[0].pr || 150) + '</div></div>';
  });
  return h + '<div class="ecp-f">Días por cuadrilla y folios al día se miden sobre el HC autorizado (meta 25 días y 3.5 folios al día).</div></div>';
}

function ecResultados(c) {
  var P_ = c.partes, multi = P_.length > 1;
  function cnt(p, k) { return ecSum(p.cuad, k); }
  var lines = [
    { t: 'Folios', s: 'instalaciones, cambios y demás', k: 'otras', m: 'otrasM' },
    { t: 'Soporte', s: 'precio − $40', k: 'sop', m: 'sopM' },
    { t: 'Recolección', s: '$150 cada una', k: 'reco', m: 'recoM' },
    { t: 'Día festivo', s: 'folios a precio + bono $350', k: 'fest', m: 'festM' }
  ];
  var th = '<tr><th>Concepto</th>' + (multi ? P_.map(function (p) { return '<th class="r">' + esc(p.parteNombre) + '</th>'; }).join('') + '<th class="r">Total</th>' : '<th class="r">Cantidad</th><th class="r">Precio</th><th class="r">Monto</th>') + '</tr>';
  var b = '';
  lines.forEach(function (L) {
    var any = P_.some(function (p) { return cnt(p, L.k) || cnt(p, L.m) || (L.k === 'fest' && cnt(p, 'boost')); });
    if (!any && L.k === 'fest') return;
    function mon(p) { return cnt(p, L.m) + (L.k === 'fest' ? 0 : 0); }
    if (multi) {
      b += '<tr><td class="nm">' + L.t + '<small>' + L.s + '</small></td>' + P_.map(function (p) { var n = cnt(p, L.k);
        return '<td class="r">' + ecDash(mon(p)) + (n ? '<small>' + n.toLocaleString('en-US') + '</small>' : '') + '</td>'; }).join('') +
        '<td class="r"><b>' + ecDash(P_.reduce(function (a, p) { return a + mon(p); }, 0)) + '</b><small>' + P_.reduce(function (a, p) { return a + cnt(p, L.k); }, 0).toLocaleString('en-US') + '</small></td></tr>';
    } else { var p = P_[0], n = cnt(p, L.k), m = mon(p), pr = L.k === 'otras' ? ecPrecios(p.cuad) : L.k === 'sop' ? ecPrecios(p.cuad.map(function (x) { return { p: x.ps, fol: x.fol }; })) : L.k === 'reco' ? [p.cuad[0].pr || 150] : [];
      b += '<tr><td class="nm">' + L.t + '<small>' + L.s + '</small></td><td class="r">' + n.toLocaleString('en-US') + '</td><td class="r">' + (pr.length === 1 ? '$' + pr[0] : pr.length ? '$' + pr.join(' / $') : '') + '</td><td class="r">' + ecDash(m) + '</td></tr>'; }
  });
  // Pago total por folios (incluye bono de festivo si lo hay)
  function totRow(lbl, f, cls) { return '<tr class="' + cls + '"><td class="nm">' + lbl + '</td>' + (multi ? P_.map(function (p) { return '<td class="r">' + ecDash(p[f]) + '</td>'; }).join('') + '<td class="r">' + ecDash(c[f]) + '</td>' : '<td></td><td></td><td class="r">' + ecDash(c[f]) + '</td>') + '</tr>'; }
  var boost = P_.reduce(function (a, p) { return a + cnt(p, 'boost'); }, 0);
  if (boost) b += '<tr><td class="nm">Bono día festivo</td>' + (multi ? P_.map(function (p) { return '<td class="r">' + ecDash(cnt(p, 'boost')) + '</td>'; }).join('') + '<td class="r"><b>' + ecDash(boost) + '</b></td>' : '<td></td><td></td><td class="r">' + ecDash(boost) + '</td>') + '</tr>';
  b += totRow('Pago por folios', 'pago', 'sub');
  // Adicionales y descuentos: conceptos con monto en algún distrito, en el orden del archivo
  var con = [], idx = {};
  P_.forEach(function (p) { p.adic.forEach(function (a) { var k = ecU(a.c); if (!(k in idx)) { idx[k] = con.length; con.push({ t: a.c, k: k }); } }); });
  var shown = 0;
  con.forEach(function (x) {
    var vals = P_.map(function (p) { return p.adic.filter(function (a) { return ecU(a.c) === x.k; }).reduce(function (s, a) { return s + a.m; }, 0); });
    var tot = vals.reduce(function (a, v) { return a + v; }, 0);
    if (vals.every(function (v) { return Math.round(v) === 0; })) return;
    shown++;
    b += '<tr class="ad"><td class="nm">' + esc(x.t) + '</td>' + (multi ? vals.map(function (v) { return '<td class="r ' + (v < 0 ? 'neg' : '') + '">' + ecDash(v) + '</td>'; }).join('') + '<td class="r ' + (tot < 0 ? 'neg' : '') + '"><b>' + ecDash(tot) + '</b></td>' : '<td></td><td></td><td class="r ' + (tot < 0 ? 'neg' : '') + '">' + ecDash(tot) + '</td>') + '</tr>';
  });
  if (!shown) b += '<tr class="ad"><td class="nm" colspan="' + (multi ? P_.length + 2 : 4) + '"><span class="z">Sin adicionales ni descuentos este mes</span></td></tr>';
  else b += totRow('Total adicionales y descuentos', 'descTot', 'sub');
  b += totRow('Subtotal a facturar', 'subtotal', 'sub') + totRow('IVA y retenciones', 'iva', '') + totRow('Total a facturar', 'total', 'grand');
  return '<div class="tw2"><table class="rs ecr">' + '<thead>' + th + '</thead><tbody>' + b + '</tbody></table></div>';
}

function ecSetSuc(k) { ECSUC = k; if (k !== 'ALL') ECOPEN[k] = true; ecDetDraw(); }
function ecTog(k) { ECOPEN[k] = !ECOPEN[k]; ecDetDraw(); }
function ecDetDraw() { var el = document.getElementById('ecdet'); if (el) el.innerHTML = ecDet(ecCur()); }
function ecDet(c) {
  var all = []; c.partes.forEach(function (p) { all = all.concat(p.cuad); });
  var D = {}, O = [];
  all.forEach(function (t) { var k = t.dist || t.suc; if (!D[k]) { D[k] = { suc: t.suc, t: [] }; O.push(k); } D[k].t.push(t); });
  O.sort(function (a, b) { return ecSum(D[b].t, 'tot') - ecSum(D[a].t, 'tot'); });
  if (ECSUC !== 'ALL' && !D[ECSUC]) ECSUC = 'ALL';
  var fest = all.some(function (t) { return t.fest || t.festM || t.boost; });
  var h = '';
  if (O.length > 1) h += '<div class="sucf"><button class="' + (ECSUC === 'ALL' ? 'on' : '') + '" onclick="ecSetSuc(\'ALL\')">Todas<i>' + all.length + '</i></button>' +
    O.map(function (k) { return '<button class="' + (ECSUC === k ? 'on' : '') + '" onclick="ecSetSuc(\'' + k + '\')">' + esc(ecSuc(D[k].suc)) + '<i>' + D[k].t.length + '</i></button>'; }).join('') + '</div>';
  h += '<div class="tw2"><table class="rs sucT ecd"><thead><tr><th>' + (O.length > 1 ? 'Sucursal / técnico' : 'Técnico') + '</th><th class="r">Días trabajados</th><th class="r">Folios</th><th class="r">Folios al día</th><th class="r">Soporte</th><th class="r">Recolección</th><th class="r">Otros folios</th>' +
    (fest ? '<th class="r">Día festivo</th>' : '') + '<th class="r">Precio por folio</th><th class="r">Pago</th></tr></thead><tbody>';
  var T = { n: 0, d: 0, fol: 0, sop: 0, reco: 0, otras: 0, fe: 0, tot: 0 };
  function cells(x, pr) { return '<td class="r">' + x.d.toLocaleString('en-US') + '</td><td class="r">' + x.fol.toLocaleString('en-US') + '</td><td class="r">' + (x.pd != null ? x.pd : '') + '</td><td class="r">' + x.sop + '</td><td class="r">' + x.reco + '</td><td class="r">' + x.otras.toLocaleString('en-US') + '</td>' +
      (fest ? '<td class="r">' + ecDash(x.fe) + '</td>' : '') + '<td class="r">' + pr + '</td><td class="r"><b>' + ecF(x.tot) + '</b></td>'; }
  O.forEach(function (k) {
    if (ECSUC !== 'ALL' && ECSUC !== k) return;
    var g = D[k], open = O.length === 1 || !!ECOPEN[k];
    var s = { d: ecSum(g.t, 'd'), fol: ecSum(g.t, 'fol'), sop: ecSum(g.t, 'sop'), reco: ecSum(g.t, 'reco'), otras: ecSum(g.t, 'otras'), fe: ecSum(g.t, 'festM') + ecSum(g.t, 'boost'), tot: ecSum(g.t, 'tot') };
    T.n += g.t.length; ['d', 'fol', 'sop', 'reco', 'otras', 'fe', 'tot'].forEach(function (f) { T[f] += s[f]; });
    if (O.length > 1) h += '<tr class="sg" onclick="ecTog(\'' + k + '\')"><td class="nm"><span class="car">' + (open ? '▾' : '▸') + '</span>' + esc(ecSuc(g.suc)) + ' <span class="z">· ' + g.t.length + '</span></td>' + cells(s, ecPrecios(g.t).map(function (x) { return '$' + x; }).join(' / ')) + '</tr>';
    if (open) g.t.slice().sort(function (a, b) { return b.tot - a.tot; }).forEach(function (t) {
      var x = { d: t.d, fol: t.fol, pd: (t.fol / Calc.P.diasMes).toFixed(1), sop: t.sop, reco: t.reco, otras: t.otras, fe: t.festM + t.boost, tot: t.tot };
      h += '<tr class="' + (O.length > 1 ? 'st' : '') + '"><td class="nm">' + esc(ecName(t.u)) + (ecName(t.u) !== t.u ? '<small>' + esc(t.u) + '</small>' : '') + '</td>' + cells(x, '$' + t.p) + '</tr>'; });
  });
  h += '</tbody><tfoot><tr><td>' + (ECSUC === 'ALL' ? 'Total' : 'Total ' + esc(ecSuc(D[ECSUC].suc))) + ' <span class="z">· ' + T.n + ' cuadrillas</span></td>' + cells(T, '') + '</tr></tfoot></table></div>';
  return h + '<div class="how">Folios al día = folios del técnico ÷ 26. El precio de cada folio sale de la tabla del esquema con el ajuste del mes.</div>';
}

function renderEC(c) {
  var mes = ecMesTxt(c), multi = c.partes.length > 1;
  var h = '<div class="pg ecpg"><div class="pg-h"><div class="ey">Estado de cuenta · ' + mes + '</div><h1>' + esc(c.nombre) + '</h1>' +
    '<div class="meta"><span>Periodo <b>' + ecPeriodo(c) + '</b></span><span><b>' + c.cuadrillas + '</b> cuadrillas</span><span><b>' + c.os.toLocaleString('en-US') + '</b> folios</span><span><b>' + c.asist.toLocaleString('en-US') + '</b> días trabajados</span>' +
    (multi ? '<span>' + c.partes.map(function (p) { return esc(p.parteNombre); }).join(' · ') + '</span>' : '') + '</div></div>';
  h += '<div class="hero"><div class="c-money"><div><div class="l">Total a facturar</div><div class="v">' + ecF(c.total) + '</div>' +
    '<div class="ecm"><div><span>Pago por folios</span><b>' + ecF(c.pago) + '</b></div><div><span>Adicionales y descuentos</span><b>' + ecF(c.descTot) + '</b></div>' +
    '<div class="sb"><span>Subtotal a facturar</span><b>' + ecF(c.subtotal) + '</b></div><div><span>IVA y retenciones</span><b>' + ecF(c.iva) + '</b></div></div></div>' +
    '<div class="n">Cierre del mes con el esquema destajo con póliza. Factura por el subtotal más IVA y retenciones.</div></div>' + ecPriceCard(c) + '</div>';
  h += '<div class="blk"><div class="blk-h"><span class="t">Cómo se arma tu pago</span><span class="s">' + (multi ? 'por distrito' : mes) + '</span></div>' + ecResultados(c) + '</div>';
  h += '<div class="blk"><div class="blk-h"><span class="t">Detalle por cuadrilla</span><span class="s">' + (c.partes.some(function (p) { return p.cuad.some(function (t) { return t.dist !== c.partes[0].cuad[0].dist; }); }) ? 'clic en una sucursal para ver sus técnicos' : '') + '</span></div><div id="ecdet">' + ecDet(c) + '</div></div>';
  h += '<div class="foot">Generado por QiORA Conecta · Planeación Financiera · <b>CONFIDENCIAL</b>, uso exclusivo del contratista</div></div>';
  return h;
}

// ---------- pantalla y archivo ----------
function ecCur() { return EC.contratistas[ECI]; }
function ecPick(i) { ECI = i; ECSUC = 'ALL'; ECOPEN = {}; ecDraw(); window.scrollTo(0, 0); }
function ecNames() { var o = {}; if (typeof DATA !== 'undefined' && DATA && DATA.tec) Object.keys(DATA.tec).forEach(function (u) { if (DATA.tec[u].nombre) o[u] = DATA.tec[u].nombre; }); return o; }
var EC_NAMES = {};
function ecDraw() {
  EC_NAMES = ecNames();
  var c = ecCur(), h = '';
  EC.contratistas.forEach(function (x, i) {
    h += '<button class="ci' + (i === ECI ? ' on' : '') + '" onclick="ecPick(' + i + ')"><div class="cn">' + esc(x.nombre) + '</div><div class="cm"><span>' + ecF(x.total) + ' a facturar</span></div></button>'; });
  if (EC.omitidas.length) h += '<div class="ecom">No se incluyeron: ' + EC.omitidas.map(function (s) { return '<b>' + esc(s.hoja.trim()) + '</b> (' + s.por + ')'; }).join(', ') + '</div>';
  document.getElementById('eclist').innerHTML = h;
  document.getElementById('ecmes').textContent = ecMesTxt(c);
  var warn = c.partes.filter(function (p) { return p.dif; }).map(function (p) { return 'En la hoja <b>' + esc(p.hoja) + '</b> la suma de las cuadrillas (' + ecF(p.pago + p.dif) + ') no cuadra con el pago total (' + ecF(p.pago) + ').'; });
  var noRegla = c.partes.filter(function (p) { return !p.regla || !p.regla.ok; }).map(function (p) { return esc(p.parteNombre); });
  if (noRegla.length) warn.push('El precio de ' + noRegla.join(', ') + ' no coincide con el HC autorizado de la página; se muestra el precio del archivo sin el detalle de ajustes.');
  if (!Object.keys(EC_NAMES).length) warn.push('Para ver nombres de técnicos en lugar del usuario, carga también el archivo de bonos en la pestaña Avance de póliza.');
  document.getElementById('ecview').innerHTML = (warn.length ? '<div class="ecwarn">' + warn.join('<br>') + '</div>' : '') + renderEC(c);
}
function ecLoad(f) {
  var st = document.getElementById('ecstatus'); st.textContent = 'Abriendo ' + f.name + '…';
  f.arrayBuffer().then(function (buf) {
    try {
      var wb = XLSX.read(buf, { type: 'array', cellDates: true });
      var R = ecParse(wb);
      if (!R.contratistas.length) throw new Error('No encontré hojas con la tabla del nuevo esquema (Usuario para pago, Precio base…).');
      EC = R; ECI = 0; ECSUC = 'ALL'; ECOPEN = {};
      document.getElementById('ecLoader').hidden = true; document.getElementById('ecApp').hidden = false;
      HC_READY.then(ecDraw);
    } catch (e) { st.innerHTML = '<span style="color:var(--red)">' + esc(e.message) + '</span>'; }
  });
}
function ecFile(c) { return 'Estado_de_cuenta_' + slug(c.nombre) + '_' + (c.fin || c.inicio).slice(0, 7) + '.html'; }
function ecExport(c) {
  var css = document.querySelector('style').textContent, names = {};
  c.partes.forEach(function (p) { p.cuad.forEach(function (t) { if (EC_NAMES[t.u]) names[t.u] = EC_NAMES[t.u]; }); });
  var fns = [esc, titleName, ecU, ecF, ecDash, ecPeriodo, ecMesTxt, ecName, ecSuc, ecSum, ecPrecios, ecAdj, ecPriceCard, ecResultados, ecSetSuc, ecTog, ecDetDraw, ecDet, renderEC, ecCur]
    .map(function (f) { return f.toString(); }).join('\n');
  var data = 'var EC_MES=' + JSON.stringify(EC_MES) + ';var Calc={P:{diasMes:' + Calc.P.diasMes + '}};var EC={contratistas:[' + JSON.stringify(c).replace(/</g, '\\u003c') + ']};var ECI=0,ECSUC="ALL",ECOPEN={};var EC_NAMES=' + JSON.stringify(names).replace(/</g, '\\u003c') + ';';
  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Estado de cuenta ' + esc(c.nombre) + ' ' + ecMesTxt(c) + '</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">' +
    '<style>' + css + '.xbar{background:#fff;border-bottom:1px solid var(--g2)}.xbar div{max-width:1120px;margin:0 auto;padding:16px 48px;display:flex;justify-content:space-between;align-items:center}.xbar img{height:30px}.xbar button{border:none;background:var(--ink);color:#fff;border-radius:10px;padding:9px 14px;font-weight:700}@media print{.xbar button{display:none}}</style></head><body>' +
    '<div class="xbar"><div><img src="' + LOGO + '" alt="QiORA Conecta"><button onclick="window.print()">Imprimir / PDF</button></div></div>' +
    '<div id="ecview"></div><script>' + data + '\n' + fns + '\ndocument.getElementById("ecview").innerHTML=renderEC(ecCur());<\/script></body></' + 'html>';
}
function ecDownloadOne() { var c = ecCur(); saveBlob(new Blob([ecExport(c)], { type: 'text/html' }), ecFile(c)); }
function ecDownloadAll() {
  var zip = new JSZip(); EC.contratistas.forEach(function (c) { zip.file(ecFile(c), ecExport(c)); });
  var c = EC.contratistas[0]; zip.generateAsync({ type: 'blob' }).then(function (b) { saveBlob(b, 'Estados_de_cuenta_' + (c.fin || c.inicio).slice(0, 7) + '.zip'); });
}

function setTab(t) {
  TAB = t;
  document.getElementById('tabA').classList.toggle('on', t === 'a'); document.getElementById('tabE').classList.toggle('on', t === 'e');
  var hasA = typeof DATA !== 'undefined' && DATA;
  document.getElementById('loader').hidden = t !== 'a' || hasA; document.getElementById('app').hidden = t !== 'a' || !hasA;
  document.getElementById('ec').hidden = t !== 'e';
  if (t === 'e' && EC) ecDraw();
  window.scrollTo(0, 0);
}
(function () {
  var d = document.getElementById('ecDrop'), f = document.getElementById('ecFileIn');
  ['dragenter', 'dragover'].forEach(function (e) { d.addEventListener(e, function (ev) { ev.preventDefault(); d.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (e) { d.addEventListener(e, function (ev) { ev.preventDefault(); d.classList.remove('over'); }); });
  d.addEventListener('drop', function (ev) { if (ev.dataTransfer.files[0]) ecLoad(ev.dataTransfer.files[0]); });
  f.addEventListener('change', function () { if (f.files[0]) ecLoad(f.files[0]); });
  document.getElementById('ecDl1').onclick = ecDownloadOne; document.getElementById('ecDlAll').onclick = ecDownloadAll;
  document.getElementById('ecChg').onclick = function () { EC = null; document.getElementById('ecApp').hidden = true; document.getElementById('ecLoader').hidden = false; document.getElementById('ecstatus').textContent = ''; f.value = ''; };
})();
