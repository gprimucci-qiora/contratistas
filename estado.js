// ===== Estado de cuenta de cierre de mes (nuevo esquema) =====
// Solo VISUALIZA el archivo "COMISIONES CONTRATISTA <MES> CIERRE": no recalcula nada, porque ahí se ajustan cosas a mano.
// De cada hoja se lee:
//  · la tabla por distrito (bloque que empieza en "Ingreso Bruto": rally, descuentos, subtotal, IVA y retenciones, total),
//  · la tabla de cuadrillas del nuevo esquema (Usuario para pago, Precio base, Soporte, Recolección…), si la trae.
// Hojas del mismo contratista (p.ej. Marco Anaya: GDL, Tepic, Colima, León) se juntan en un estado.
var EC = null, ECI = 0, ECSUC = 'ALL', ECOPEN = {}, TAB = 'a';
var EC_MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function ecU(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function ecL(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
function ecN(v) { var n = +v; return isFinite(n) ? n : 0; }
function ecIso(d) { d = new Date(d.getTime() + 12 * 3600e3); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
// "GS2-OCC-GDL GDL ESTADIO" → "GDL Estadio" · "CBA CORDOBA ORIZABA" → "Córdoba Orizaba" · "GS2-BAJ-LON LEON" → "León"
function ecDistName(s) {
  var n = ecU(s).replace(/^.*-[A-Z]{2,4}\s+/, '').replace(/^(?!GDL\b)[A-Z]{3}\s+(?=\S)/, '');
  var fix = { LEON: 'León', LOPEZ: 'López', CORDOBA: 'Córdoba', QUERETARO: 'Querétaro', SAN: 'San' };
  return n.split(' ').map(function (w) { return w === 'GDL' ? 'GDL' : fix[w] || w.charAt(0) + w.slice(1).toLowerCase(); }).join(' ');
}

function ecParseSheet(rows, sheet) {
  var S = { hoja: sheet.trim(), nombre: '', fechas: [], cols: null, cuad: [], resumen: null };
  var lc = 2;
  for (var i = 0; i < Math.min(rows.length, 20) && !S.nombre; i++) { var r = rows[i] || [];
    for (var j = 0; j < r.length; j++) if (ecU(r[j]) === 'ESTADO DE CUENTA CONTRATISTA') { lc = j; S.nombre = ecL(r[j + 1]); break; } }
  if (!S.nombre) S.nombre = S.hoja;
  // Tabla de cuadrillas (formato nuevo)
  var h = -1;
  for (i = 0; i < rows.length; i++) { r = rows[i] || [];
    if (r.some(function (x) { return ecU(x) === 'USUARIO PARA PAGO'; }) && r.some(function (x) { return ecU(x) === 'PRECIO BASE'; })) { h = i; break; } }
  var top = h >= 0 ? h : Math.min(rows.length, 60);
  // Resumen de la izquierda (columna de etiquetas): fechas y, como respaldo, pago / adicionales / subtotal / IVA / total
  var R = { adic: [], pago: 0, descTot: 0, sub: 0, iva: 0, total: 0 }, mode = '';
  for (i = 0; i < top; i++) { r = rows[i] || []; var L = ecU(r[lc]), V = r[lc + 1];
    if (V instanceof Date) S.fechas.push(ecIso(V));
    if (!L) continue;
    if (L === 'ADICIONALES Y DESCUENTOS') { mode = 'adic'; continue; }
    if (mode === 'adic') { if (L === 'TOTAL') { R.descTot = ecN(V); mode = 'post'; } else R.adic.push({ c: ecL(r[lc]), m: ecN(V) }); continue; }
    if (mode === 'post') { if (L === 'SUBTOTAL A FACTURAR') R.sub = ecN(V); else if (L === 'IVA Y RETENCIONES') R.iva = ecN(V); else if (L === 'TOTAL') { R.total = ecN(V); mode = 'fin'; } continue; }
    if (L === 'PAGO TOTAL') R.pago = ecN(V);
  }
  S.resumen = R;
  // Tabla por distrito: etiqueta "Ingreso Bruto" a la derecha del resumen; encabezados de distrito en la fila de arriba
  var br = -1, bc = -1;
  for (i = 0; i < top && br < 0; i++) { r = rows[i] || [];
    for (j = lc + 2; j < r.length; j++) if (ecU(r[j]).indexOf('INGRESO BRUTO') === 0) { br = i; bc = j; break; } }
  if (br > 0) {
    var hdr = rows[br - 1] || [], cs = [];
    for (j = bc + 1; j < Math.max(hdr.length, (rows[br] || []).length); j++) if (ecL(hdr[j])) cs.push(j);
    var cols = cs.map(function (j) { return { name: ecDistName(hdr[j]), raw: ecU(hdr[j]), ingreso: 0, items: [], descTot: 0, sub: 0, iva: 0, total: 0 }; });
    for (i = br; i < rows.length; i++) { r = rows[i] || []; L = ecU(r[bc]); if (!L) continue;
      var vals = cs.map(function (j) { return ecN(r[j]); });
      if (L.indexOf('INGRESO BRUTO') === 0) vals.forEach(function (v, k) { cols[k].ingreso = v; });
      else if (L.indexOf('PAGO PROMEDIO') === 0) continue;
      else if (L.indexOf('TOTAL DE DESCUENTO') === 0) vals.forEach(function (v, k) { cols[k].descTot = v; });
      else if (L === 'SUBTOTAL A FACTURAR') vals.forEach(function (v, k) { cols[k].sub = v; });
      else if (L === 'IVA Y RETENCIONES') vals.forEach(function (v, k) { cols[k].iva = v; });
      else if (L === 'TOTAL') { vals.forEach(function (v, k) { cols[k].total = v; }); break; }
      else { var t = ecL(r[bc]); vals.forEach(function (v, k) { cols[k].items.push({ c: t, m: v }); }); }
    }
    S.cols = cols;
  }
  if (h >= 0) {
    var H = (rows[h] || []).map(ecU);
    var C = {}; [['u', 'USUARIO PARA PAGO'], ['suc', 'SUCURSAL'], ['p', 'PRECIO BASE'], ['ps', 'PRECIO SOPORTE'], ['pr', 'PRECIO RECOLECCION'], ['fol', 'FOLIOS TOTAL'],
      ['d', '# ASISTENCIAS'], ['sop', 'SOPORTE'], ['reco', 'RECOLECCION'], ['otras', 'OTRAS OS'], ['fest', 'DIA FESTIVO'], ['sopM', '$$$ SOPORTE'],
      ['recoM', '$$$ RECOLECCION'], ['otrasM', '$$$ OTRAS OS'], ['boost', 'BOOST DIA FESTIVO'], ['festM', '$$$ DIA FESTIVO'], ['tot', 'TOTAL']].forEach(function (x) { C[x[0]] = H.indexOf(x[1]); });
    for (i = h + 1; i < rows.length; i++) { r = rows[i] || []; var u = ecL(C.u >= 0 ? r[C.u] : '');
      if (!u) { if (S.cuad.length) break; else continue; }
      var o = { u: u }; Object.keys(C).forEach(function (k) { if (k !== 'u') o[k] = k === 'suc' ? ecL(r[C[k]]) : ecN(C[k] >= 0 ? r[C[k]] : 0); });
      o.dist = Calc.distDe(o.suc); S.cuad.push(o);
    }
  }
  if (!S.cols && !S.cuad.length) {
    var old = rows.some(function (r) { return r && r.some(function (x) { return ecU(x).indexOf('ESTRELLAS') >= 0; }); });
    return { skip: true, hoja: sheet, por: old ? 'formato anterior (estrellas)' : 'sin datos' };
  }
  S.fechas.sort();
  return S;
}

function ecParse(wb) {
  var G = {}, ord = [], skip = [];
  wb.SheetNames.forEach(function (n) {
    var S = ecParseSheet(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }), n);
    if (S.skip) { skip.push(S); return; }
    var k = ecU(S.nombre);
    if (!G[k]) { G[k] = { nombre: titleName(S.nombre).replace(/\bGdl\b/g, 'GDL'), hojas: [] }; ord.push(k); }
    G[k].hojas.push(S);
  });
  var L = ord.map(function (k) { var c = G[k], cols = [], fs = [];
    c.cuad = []; c.hojas.forEach(function (S) { c.cuad = c.cuad.concat(S.cuad); fs = fs.concat(S.fechas); if (S.cols) cols = cols.concat(S.cols); });
    // Hoja sin tabla por distrito y que ninguna otra tabla cubre (p.ej. distrito con su propia hoja): usa su resumen de la izquierda
    c.hojas.forEach(function (S) {
      if (S.cols) return;
      var nm = S.cuad.map(function (t) { return ecU(t.suc).replace(/^.*INT-[A-Z]{2,4}\s*/, ''); });
      var cubierta = nm.length && nm.every(function (x) { return cols.some(function (cl) { return x && cl.raw.indexOf(x) >= 0; }); });
      if (cubierta) return;
      var R = S.resumen; cols.push({ name: titleName(S.hoja), ingreso: R.pago, items: R.adic, descTot: R.descTot, sub: R.sub, iva: R.iva, total: R.total });
    });
    c.cols = cols.filter(function (cl) { return [cl.ingreso, cl.sub, cl.total].some(function (v) { return Math.round(v); }) || cl.items.some(function (x) { return Math.round(x.m); }); });
    ['ingreso', 'descTot', 'sub', 'iva', 'total'].forEach(function (f) { c[f] = c.cols.reduce(function (a, cl) { return a + cl[f]; }, 0); });
    fs.sort(); c.inicio = fs[0] || ''; c.fin = fs[fs.length - 1] || '';
    c.cuadrillas = c.cuad.length; c.folios = ecSum(c.cuad, 'fol'); c.dias = ecSum(c.cuad, 'd');
    delete c.hojas;
    return c; });
  L.sort(function (a, b) { return a.nombre < b.nombre ? -1 : 1; });
  return { contratistas: L, omitidas: skip };
}
// Revisiones internas (solo en la pantalla, no en el HTML del contratista)
function ecChecks(c) {
  var w = [];
  c.cols.forEach(function (cl) {
    var s = cl.items.reduce(function (a, x) { return a + x.m; }, 0);
    if (Math.abs(cl.ingreso + s - cl.sub) > 1) w.push(cl.name + ': ingreso bruto ' + ecF(cl.ingreso) + ' + conceptos ' + ecF(s) + ' no da el subtotal ' + ecF(cl.sub) + '.');
    if (Math.abs(cl.sub + cl.iva - cl.total) > 1) w.push(cl.name + ': subtotal + IVA no da el total.');
  });
  var tc = ecSum(c.cuad, 'tot');
  if (c.cuad.length && Math.abs(tc - c.ingreso) > 1) w.push('La suma de las cuadrillas (' + ecF(tc) + ') no es igual al ingreso bruto de la tabla por distrito (' + ecF(c.ingreso) + ').');
  return w;
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
function ecSuc(s) { return ecDistName(String(s || '').replace(/^.*?INT-/, '')); }
function ecSum(L, f) { return L.reduce(function (a, x) { return a + (x[f] || 0); }, 0); }
function ecPrecios(cuad, f) { var o = {}; cuad.forEach(function (c) { o[c[f || 'p']] = (o[c[f || 'p']] || 0) + c.fol + 1; });
  return Object.keys(o).map(Number).filter(function (x) { return x; }).sort(function (a, b) { return o[b] - o[a]; }); }

// Tabla por distrito tal cual el archivo: ingreso bruto, conceptos (rally, descuentos…), total de descuentos, subtotal, IVA, total
function ecResultados(c) {
  var K = c.cols, multi = K.length > 1, con = [], idx = {};
  K.forEach(function (cl) { cl.items.forEach(function (x) { var k = ecU(x.c); if (!(k in idx)) { idx[k] = con.length; con.push({ t: x.c, k: k }); } }); });
  function v(cl, k) { return cl.items.filter(function (x) { return ecU(x.c) === k; }).reduce(function (a, x) { return a + x.m; }, 0); }
  function row(lbl, get, cls) { var vals = K.map(get), tot = vals.reduce(function (a, x) { return a + x; }, 0);
    return '<tr class="' + (cls || '') + '"><td class="nm">' + lbl + '</td>' + vals.map(function (x) { return '<td class="r' + (x < -0.5 && !cls ? ' neg' : '') + '">' + ecDash(x) + '</td>'; }).join('') +
      (multi ? '<td class="r tc' + (tot < -0.5 && !cls ? ' neg' : '') + '">' + ecDash(tot) + '</td>' : '') + '</tr>'; }
  var b = row('Ingreso bruto<small>pago por folios del mes</small>', function (cl) { return cl.ingreso; }, 'sub'), n = 0;
  con.forEach(function (x) { if (K.every(function (cl) { return Math.round(v(cl, x.k)) === 0; })) return; n++;
    b += row(esc(x.t.charAt(0).toUpperCase() + x.t.slice(1)), function (cl) { return v(cl, x.k); }); });
  if (!n) b += '<tr><td class="nm" colspan="' + (K.length + (multi ? 2 : 1)) + '"><span class="z">Sin rally, adicionales ni descuentos este mes</span></td></tr>';
  b += row('Total de descuentos y adicionales', function (cl) { return cl.descTot; }, 'sub') +
    row('Subtotal a facturar', function (cl) { return cl.sub; }, 'sub') +
    row('IVA y retenciones', function (cl) { return cl.iva; }) +
    row('Total a facturar', function (cl) { return cl.total; }, 'grand');
  return '<div class="tw2"><table class="rs ecr"><thead><tr><th>Concepto</th>' + K.map(function (cl) { return '<th class="r">' + esc(cl.name) + '</th>'; }).join('') +
    (multi ? '<th class="r">Total</th>' : '') + '</tr></thead><tbody>' + b + '</tbody></table></div>';
}

function ecPriceCard(c) {
  if (!c.cuad.length) return '';
  var D = {}, O = [];
  c.cuad.forEach(function (t) { var k = t.dist || t.suc; if (!D[k]) { D[k] = { suc: t.suc, t: [] }; O.push(k); } D[k].t.push(t); });
  O.sort(function (a, b) { return ecSum(D[b].t, 'fol') - ecSum(D[a].t, 'fol'); });
  var h = '<div class="c-price"><div class="top"><span class="l">Precio por folio</span></div><table class="ecpt"><thead><tr><th></th><th class="r">Folio</th><th class="r">Soporte</th><th class="r">Recolección</th></tr></thead><tbody>';
  O.forEach(function (k) { var t = D[k].t;
    h += '<tr><td>' + esc(ecSuc(D[k].suc)) + '</td><td class="r big">' + ecPrecios(t).map(function (x) { return '$' + x; }).join(' / ') + '</td><td class="r">' +
      ecPrecios(t, 'ps').map(function (x) { return '$' + x; }).join(' / ') + '</td><td class="r">' + ecPrecios(t, 'pr').map(function (x) { return '$' + x; }).join(' / ') + '</td></tr>'; });
  return h + '</tbody></table><div class="ecp-f">Precio del mes según el esquema destajo con póliza (días por cuadrilla y folios al día sobre tu HC autorizado).</div></div>';
}

function ecSetSuc(k) { ECSUC = k; if (k !== 'ALL') ECOPEN[k] = true; ecDetDraw(); }
function ecTog(k) { ECOPEN[k] = !ECOPEN[k]; ecDetDraw(); }
function ecDetDraw() { var el = document.getElementById('ecdet'); if (el) el.innerHTML = ecDet(ecCur()); }
function ecDet(c) {
  var all = c.cuad, D = {}, O = [];
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
  function nn(x) { return (x || 0).toLocaleString('en-US'); }
  function cells(x, pr) { return '<td class="r">' + nn(x.d) + '</td><td class="r">' + nn(x.fol) + '</td><td class="r">' + (x.pd != null ? x.pd : '') + '</td><td class="r">' + nn(x.sop) + '</td><td class="r">' + nn(x.reco) + '</td><td class="r">' + nn(x.otras) + '</td>' +
      (fest ? '<td class="r">' + ecDash(x.fe) + '</td>' : '') + '<td class="r">' + pr + '</td><td class="r"><b>' + ecF(x.tot) + '</b></td>'; }
  O.forEach(function (k) {
    if (ECSUC !== 'ALL' && ECSUC !== k) return;
    var g = D[k], open = O.length === 1 || !!ECOPEN[k];
    var s = { d: ecSum(g.t, 'd'), fol: ecSum(g.t, 'fol'), sop: ecSum(g.t, 'sop'), reco: ecSum(g.t, 'reco'), otras: ecSum(g.t, 'otras'), fe: ecSum(g.t, 'festM') + ecSum(g.t, 'boost'), tot: ecSum(g.t, 'tot') };
    T.n += g.t.length; ['d', 'fol', 'sop', 'reco', 'otras', 'fe', 'tot'].forEach(function (f) { T[f] += s[f]; });
    if (O.length > 1) h += '<tr class="sg" onclick="ecTog(\'' + k + '\')"><td class="nm"><span class="car">' + (open ? '▾' : '▸') + '</span>' + esc(ecSuc(g.suc)) + ' <span class="z">· ' + g.t.length + '</span></td>' + cells(s, ecPrecios(g.t).map(function (x) { return '$' + x; }).join(' / ')) + '</tr>';
    if (open) g.t.slice().sort(function (a, b) { return b.tot - a.tot; }).forEach(function (t) {
      var x = { d: t.d, fol: t.fol, pd: (t.fol / 26).toFixed(1), sop: t.sop, reco: t.reco, otras: t.otras, fe: t.festM + t.boost, tot: t.tot };
      h += '<tr class="' + (O.length > 1 ? 'st' : '') + '"><td class="nm">' + esc(ecName(t.u)) + (ecName(t.u) !== t.u ? '<small>' + esc(t.u) + '</small>' : '') + '</td>' + cells(x, '$' + t.p) + '</tr>'; });
  });
  h += '</tbody><tfoot><tr><td>' + (ECSUC === 'ALL' ? 'Total' : 'Total ' + esc(ecSuc(D[ECSUC].suc))) + ' <span class="z">· ' + T.n + ' cuadrillas</span></td>' + cells(T, '') + '</tr></tfoot></table></div>';
  return h + '<div class="how">Folios al día = folios del técnico ÷ 26.</div>';
}

function renderEC(c) {
  var mes = ecMesTxt(c), multi = c.cols.length > 1;
  var h = '<div class="pg ecpg"><div class="pg-h"><div class="ey">Estado de cuenta · ' + mes + '</div><h1>' + esc(c.nombre) + '</h1>' +
    '<div class="meta"><span>Periodo <b>' + ecPeriodo(c) + '</b></span>' + (c.cuad.length ? '<span><b>' + c.cuadrillas + '</b> cuadrillas</span><span><b>' + c.folios.toLocaleString('en-US') + '</b> folios</span><span><b>' + c.dias.toLocaleString('en-US') + '</b> días trabajados</span>' : '') +
    (multi ? '<span>' + c.cols.map(function (cl) { return esc(cl.name); }).join(' · ') + '</span>' : '') + '</div></div>';
  h += '<div class="hero"><div class="c-money"><div><div class="l">Total a facturar</div><div class="v">' + ecF(c.total) + '</div>' +
    '<div class="ecm"><div><span>Ingreso bruto</span><b>' + ecF(c.ingreso) + '</b></div><div><span>Descuentos y adicionales</span><b>' + ecF(c.descTot) + '</b></div>' +
    '<div class="sb"><span>Subtotal a facturar</span><b>' + ecF(c.sub) + '</b></div><div><span>IVA y retenciones</span><b>' + ecF(c.iva) + '</b></div></div></div>' +
    '<div class="n">Cierre oficial del mes · esquema destajo con póliza.</div></div>' + ecPriceCard(c) + '</div>';
  h += '<div class="blk"><div class="blk-h"><span class="t">Estado de resultados' + (multi ? ' por distrito' : '') + '</span><span class="s">' + mes + '</span></div>' + ecResultados(c) + '</div>';
  if (c.cuad.length) h += '<div class="blk"><div class="blk-h"><span class="t">Detalle por cuadrilla</span><span class="s">clic en una sucursal para ver sus técnicos</span></div><div id="ecdet">' + ecDet(c) + '</div></div>';
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
    var bad = ecChecks(x).length;
    h += '<button class="ci' + (i === ECI ? ' on' : '') + '" onclick="ecPick(' + i + ')"><div class="cn">' + esc(x.nombre) + (bad ? ' <span class="dirty">revisar</span>' : '') + '</div><div class="cm"><span>' + ecF(x.total) + ' a facturar</span></div></button>'; });
  if (EC.omitidas.length) h += '<div class="ecom">No se incluyeron: ' + EC.omitidas.map(function (s) { return '<b>' + esc(s.hoja.trim()) + '</b> (' + s.por + ')'; }).join(', ') + '</div>';
  document.getElementById('eclist').innerHTML = h;
  document.getElementById('ecmes').textContent = ecMesTxt(c);
  var warn = ecChecks(c).map(esc);
  if (warn.length) warn.unshift('<b>Revisar en el Excel</b> (este aviso no sale en el HTML del contratista):');
  if (c.cuad.length && !Object.keys(EC_NAMES).length) warn.push('Para ver nombres de técnicos en lugar del usuario, carga también el archivo de bonos en la pestaña Avance de póliza.');
  document.getElementById('ecview').innerHTML = (warn.length ? '<div class="ecwarn">' + warn.join('<br>') + '</div>' : '') + renderEC(c);
}
function ecLoad(f) {
  var st = document.getElementById('ecstatus'); st.textContent = 'Abriendo ' + f.name + '…';
  f.arrayBuffer().then(function (buf) {
    try {
      var R = ecParse(XLSX.read(buf, { type: 'array', cellDates: true }));
      if (!R.contratistas.length) throw new Error('No encontré hojas con la tabla por distrito ni la tabla de cuadrillas del nuevo esquema.');
      EC = R; ECI = 0; ECSUC = 'ALL'; ECOPEN = {};
      document.getElementById('ecLoader').hidden = true; document.getElementById('ecApp').hidden = false;
      ecDraw();
    } catch (e) { st.innerHTML = '<span style="color:var(--red)">' + esc(e.message) + '</span>'; }
  });
}
function ecFile(c) { return 'Estado_de_cuenta_' + slug(c.nombre) + '_' + (c.fin || c.inicio || '').slice(0, 7) + '.html'; }
function ecExport(c) {
  var css = document.querySelector('style').textContent, names = {};
  c.cuad.forEach(function (t) { if (EC_NAMES[t.u]) names[t.u] = EC_NAMES[t.u]; });
  var fns = [esc, titleName, ecU, ecF, ecDash, ecDistName, ecPeriodo, ecMesTxt, ecName, ecSuc, ecSum, ecPrecios, ecResultados, ecPriceCard, ecSetSuc, ecTog, ecDetDraw, ecDet, renderEC, ecCur]
    .map(function (f) { return f.toString(); }).join('\n');
  var data = 'var EC_MES=' + JSON.stringify(EC_MES) + ';var EC={contratistas:[' + JSON.stringify(c).replace(/</g, '\\u003c') + ']};var ECI=0,ECSUC="ALL",ECOPEN={};var EC_NAMES=' + JSON.stringify(names).replace(/</g, '\\u003c') + ';';
  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Estado de cuenta ' + esc(c.nombre) + ' ' + ecMesTxt(c) + '</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">' +
    '<style>' + css + '.xbar{background:#fff;border-bottom:1px solid var(--g2)}.xbar div{max-width:1120px;margin:0 auto;padding:16px 48px;display:flex;justify-content:space-between;align-items:center}.xbar img{height:30px}.xbar button{border:none;background:var(--ink);color:#fff;border-radius:10px;padding:9px 14px;font-weight:700}@media print{.xbar button{display:none}}</style></head><body>' +
    '<div class="xbar"><div><img src="' + LOGO + '" alt="QiORA Conecta"><button onclick="window.print()">Imprimir / PDF</button></div></div>' +
    '<div id="ecview"></div><script>' + data + '\n' + fns + '\ndocument.getElementById("ecview").innerHTML=renderEC(ecCur());<\/script></body></' + 'html>';
}
function ecDownloadOne() { var c = ecCur(); saveBlob(new Blob([ecExport(c)], { type: 'text/html' }), ecFile(c)); }
function ecDownloadAll() {
  var zip = new JSZip(); EC.contratistas.forEach(function (c) { zip.file(ecFile(c), ecExport(c)); });
  var c = EC.contratistas[0]; zip.generateAsync({ type: 'blob' }).then(function (b) { saveBlob(b, 'Estados_de_cuenta_' + (c.fin || c.inicio || '').slice(0, 7) + '.zip'); });
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
