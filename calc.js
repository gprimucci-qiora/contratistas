// Motor de cálculo — nuevo esquema contratistas (destajo con póliza). SPIKE.
(function (root) {
  // HC autorizado por contratista y mes. `re` reconoce el nombre aunque cada archivo lo escriba distinto.
  // Mes sin valores propios usa el último mes anterior definido.
  var CONTRATISTAS = [
    { id: 'OMAR', nombre: 'Omar Rivera', re: /OMAR RIVERA/ },
    { id: 'CARLOS', nombre: 'Carlos Martínez Palacio / Alejandro del Valle', re: /CARLOS MARTINEZ/ },
    { id: 'MGG', nombre: 'María Gpe González / Mario Hipólito González', re: /GONZALEZ ADAME|MARIA GPE GONZALEZ|MARIO HIPOLITO/ },
    { id: 'ESM', nombre: 'Esmeralda Vargas / Jesús Vargas', re: /ESMERALDA VARGAS/ },
    { id: 'ELI', nombre: 'Elizabeth Zavala / Mario Maciel', re: /ELIZABETH ZAVALA/ },
    { id: 'ORT', nombre: 'María Gpe Ortiz / Andrés Ortiz', re: /ORTIZ/ },
    { id: 'MIG', nombre: 'Miguel Ángel Esquivel', re: /MIGUEL ANGEL ESQUIVEL/ },
    { id: 'JPV', nombre: 'Juan Pablo Valencia / Grupo Onwars', re: /JUAN PABLO VALENCIA|AGUSTIN VALENCIA|ONWARS/ }
  ];
  var HC_MES = {
    '2026-09': { OMAR: 17, CARLOS: 13, MGG: 11, ESM: 10, ELI: 10, ORT: 8, MIG: 5, JPV: 4 },
    '2026-10': { OMAR: 17, CARLOS: 13, MGG: 11, ESM: 10, ELI: 10, ORT: 8, MIG: 5, JPV: 4 }
  };
  function matchC(name) { var n = norm(name); for (var i = 0; i < CONTRATISTAS.length; i++) if (CONTRATISTAS[i].re.test(n)) return CONTRATISTAS[i]; return null; }
  function hcFor(id, monthKey) {
    var ks = Object.keys(HC_MES).filter(function (k) { return k <= monthKey; }).sort();
    if (!ks.length) return null;
    var row = HC_MES[ks[ks.length - 1]]; return row[id] || null;
  }
  var FESTIVOS = ['2026-01-01', '2026-02-02', '2026-03-16', '2026-05-01', '2026-09-16', '2026-11-16', '2026-12-25'];
  var P = { base: { A: 480, B: 440, LM: 530 }, soporte: 40, reco: 150, festMin: 3, festBono: 350,
            metaDias: 25, metaProd: 3.5, diasMes: 26, pasoProd: 20, penal: 15 };

  function titleCase(s) { return String(s).trim().toLowerCase().replace(/(^|[\s\/])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }); }
  function norm(s) { return String(s || '').trim().toUpperCase(); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function habiles(y, m, hasta) { // lunes a sábado del mes hasta día `hasta`
    var n = 0; for (var d = 1; d <= hasta; d++) { if (new Date(y, m, d).getDay() !== 0) n++; } return n;
  }

  // Precio Tipo A según escalón (como la tabla del PDF y la hoja Resultados)
  function precioA(asistProm, prod) {
    var base = P.base.A, lo = base - 2 * P.penal, hi = base + 2 * P.pasoProd;
    var k = asistProm >= P.metaDias ? base : base - (P.metaDias - Math.max(asistProm, P.metaDias - 2)) * P.penal;
    var steps = Math.min(3, Math.max(0, Math.round((prod - P.metaProd) * 10)));
    return Math.min(hi, Math.max(lo, k + steps * P.pasoProd));
  }
  function ajusteTipo(tipo) { return tipo === 'LM' ? 50 : tipo === 'B' ? -40 : 0; }

  // rows: [usuario, 'YYYY-MM-DD', servicio]; tecnicos: {usuario: {nombre, contratista, tipo, sucursal}}
  function compute(rows, tecnicos, monthKey) {
    var y = +monthKey.slice(0, 4), m = +monthKey.slice(5, 7) - 1;
    var lastDay = new Date(y, m + 1, 0).getDate();
    var fest = FESTIVOS.filter(function (f) { return f.slice(0, 7) === monthKey; });
    var corte = '';
    var per = {};
    rows.forEach(function (r) {
      if (r[1].slice(0, 7) !== monthKey) return;
      var t = tecnicos[r[0]]; if (!t || norm(t.contratista) === 'INTERNO') return;
      if (r[1] > corte) corte = r[1];
      var x = per[r[0]] || (per[r[0]] = { u: r[0], dias: {}, fol: 0, sop: 0, reco: 0, fest: 0, porTipo: {} });
      x.dias[r[1]] = (x.dias[r[1]] || 0) + 1;
      x.porTipo[r[2] || 'Sin tipo'] = (x.porTipo[r[2] || 'Sin tipo'] || 0) + 1;
      if (fest.indexOf(r[1]) >= 0) { if (r[2] !== 'Recoleccion') x.fest++; return; }
      x.fol++; if (r[2] === 'Soporte') x.sop++; if (r[2] === 'Recoleccion') x.reco++;
    });
    if (!corte) return { monthKey: monthKey, contratistas: [] };
    var corteDia = +corte.slice(8, 10);
    var totH = habiles(y, m, lastDay), pasH = habiles(y, m, corteDia), restH = Math.max(0, totH - pasH);

    var byC = {};
    Object.keys(per).forEach(function (u) {
      var x = per[u], t = tecnicos[u], c = norm(t.contratista);
      if (c === 'MARCO ANAYA') return;
      var d = Object.keys(x.dias).length;
      var rate = Math.min(1, d / Math.max(1, pasH));
      var addD = rate * restH;
      var fpd = d ? (x.fol / d) : 0;
      var k = addD > 0 && d ? (x.fol + fpd * addD) / x.fol : 1;
      var tipo = /GLM|LOPEZ MATEOS/i.test(t.sucursal) ? 'LM' : (t.tipo === 'A' || /INT-(GBA|GES|GPR)/.test(t.sucursal) ? 'A' : 'B');
      var tec = { u: u, nombre: t.nombre || u, sucursal: t.sucursal, dist: (t.sucursal.match(/INT-([A-Z]+)/) || [, ''])[1], tipo: tipo,
        d: d, dProj: Math.min(totH, d + addD), maxPos: d + restH,
        fol: x.fol, folProj: x.fol + fpd * addD, sop: x.sop, reco: x.reco, fest: x.fest, k: k,
        porDia: x.dias, porTipo: x.porTipo, fpd: fpd };
      var ent = matchC(c), key = ent ? ent.id : c;
      (byC[key] = byC[key] || { id: ent && ent.id, nombre: ent ? ent.nombre : titleCase(t.contratista), tecs: [] }).tecs.push(tec);
    });

    var out = Object.keys(byC).map(function (c) {
      var C = byC[c], hc = C.id ? hcFor(C.id, monthKey) : null;
      var sumD = 0, sumDP = 0, sumF = 0, sumFP = 0;
      C.tecs.forEach(function (t) { sumD += t.d; sumDP += t.dProj; sumF += t.fol; sumFP += t.folProj; });
      var r = { nombre: C.nombre, hc: hc, activos: C.tecs.length, corte: corte, totH: totH, pasH: pasH, restH: restH, tecs: C.tecs };
      if (!hc) { r.error = 'Sin HC autorizado'; return r; }
      function evalPrice(sDP, sFP) {
        var a = Math.floor(sDP / hc), p = Math.floor(sFP / hc / P.diasMes * 10) / 10;
        return { asist: a, prod: p, precio: precioA(a, p), asistReal: sDP / hc, prodReal: sFP / hc / P.diasMes };
      }
      function pay(precioA_, proj, store) {
        var tot = 0;
        C.tecs.forEach(function (t) {
          var before = tot;
          var pr = precioA_ + ajusteTipo(t.tipo), s = t.sop, rc = t.reco, f = t.fol, fe = t.fest;
          if (proj) { s *= t.k; rc *= t.k; f = t.folProj; }
          var otras = f - s - rc;
          tot += otras * pr + s * (pr - P.soporte) + rc * P.reco + fe * pr + (fe >= P.festMin ? P.festBono : 0);
          if (store) { t[store] = tot - before; t.precio = pr; }
        });
        return tot;
      }
      var hoy = evalPrice(sumD, sumF), proy = evalPrice(sumDP, sumFP);
      r.hoy = { dias: sumD, folios: sumF, asistProm: sumD / hc, prodProm: sumF / hc / Math.max(1, pasH) };
      r.proy = proy; r.dias = sumDP; r.folios = sumFP;
      r.metaDias = hc * P.metaDias; r.poliza = hc * P.metaProd * P.diasMes;
      r.tipoPrincipal = mainTipo(C.tecs);
      r.base = P.base.A;
      r.adjAsist = precioA(proy.asist, 3.5) - P.base.A;
      r.adjProd = proy.precio - (P.base.A + r.adjAsist);
      r.cobrado = pay(proy.precio, false, 'pago');
      r.cierre = pay(proy.precio, true, 'pagoProj');
      r.precioTipo = proy.precio + ajusteTipo(r.tipoPrincipal);
      // Oportunidad 1: subir un escalón de asistencia
      if (proy.asist < P.metaDias) {
        var nextA = proy.asist <= P.metaDias - 2 ? P.metaDias - 1 : P.metaDias;
        var need = Math.ceil(nextA * hc - sumDP);
        var precioNext = precioA(nextA, proy.prod);
        r.opAsist = { faltan: need, porCuadrilla: Math.ceil(need / hc), precioNuevo: precioNext + ajusteTipo(r.tipoPrincipal),
                      gana: pay(precioNext, true) - r.cierre };
      }
      // Oportunidad 2: vacantes
      var vac = hc - C.tecs.length;
      if (vac > 0) {
        var avgRate = sumD / Math.max(1, C.tecs.length) / Math.max(1, pasH), avgFpd = sumF / Math.max(1, sumD);
        var addD = vac * avgRate * restH, addF = addD * avgFpd;
        var p2 = evalPrice(sumDP + addD, sumFP + addF);
        var avgPay = r.cierre / Math.max(1, sumFP);
        r.opVac = { vacantes: vac, gana: pay(p2.precio, true) - r.cierre + addF * (p2.precio + ajusteTipo(r.tipoPrincipal)) };
      }
      // Grupos de técnicos
      C.tecs.forEach(function (t) {
        var prodT = t.folProj / P.diasMes;
        if (t.maxPos < P.metaDias) t.grupo = 'r';
        else if (t.dProj >= P.metaDias - 0.5 && prodT >= P.metaProd) t.grupo = 'g';
        else t.grupo = 'a';
        t.prodT = prodT;
        t.faltaFolSem = Math.max(0, Math.ceil((P.metaProd * P.diasMes - t.folProj) / Math.max(1, restH / 6)));
      });
      r.vacantes = Math.max(0, vac);
      return r;
    });
    out.sort(function (a, b) { return a.nombre < b.nombre ? -1 : 1; });
    return { monthKey: monthKey, corte: corte, contratistas: out };
  }
  function mainTipo(tecs) { var c = {}; tecs.forEach(function (t) { c[t.tipo] = (c[t.tipo] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0] || 'A'; }

  root.Calc = { compute: compute, iso: iso, P: P, FESTIVOS: FESTIVOS, precioA: precioA };
  if (typeof module !== 'undefined') module.exports = root.Calc;
})(typeof self !== 'undefined' ? self : this);
