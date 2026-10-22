# CONTEXT — Avance de Contratistas (QiORA Conecta)

> Leer esto al retomar el proyecto. Última actualización: 2026-10-22.

## Qué es
Página web estática (GitHub Pages) para que la **coordinadora de contratistas** vea cómo va cada contratista en el mes bajo el **nuevo esquema "destajo con póliza"** y descargue un HTML individual por contratista para mandárselo (WhatsApp, captura).

- Repo: `github.com/gprimucci-qiora/contratistas` (público) · Pages: https://gprimucci-qiora.github.io/contratistas/
- Repo local oficial: `~/contratistas` (no en el Escritorio: la Terminal no tiene permiso para Desktop).
- Prototipo histórico: `~/Desktop/QiORA/2026/INSTALACIONES/PROYECTOS/BI Contratistas/spike-avance/` (index-v1, index-v2 = diseños descartados). La copia `BI Contratistas/avance-contratistas/` quedó desactualizada; usar `~/contratistas`.
- Push: lo hace Giacomo desde Terminal (`cd ~/contratistas` → `git push`, user `gprimucci-qiora`, password = token). No hay token guardado en la máquina.

## Principios (decididos con Giacomo)
- **Sin el archivo no hay datos.** La página no guarda nada; el Excel se lee en el navegador y no se sube a ningún lado. El link puede circular sin exponer información.
- **El HTML descargado de cada contratista lleva solo SUS datos** (resumen, técnicos, calendario). Sin Excel, sin lista ni HC de otros contratistas. Funciona offline y se ve bien en celular y computadora.
- **Narrativa de estado, no de incentivo:** "así vas / cómo vas contra tu meta". No mostrar montos de "lo que podrías ganar" (evitar que el costo a contratistas suba por sobre-motivación).
- Lenguaje muy simple: el lector final es personal operativo (muchos sin preparatoria).
- Montos siempre con asterisco: *antes de descuentos, estimados, no oficiales ni garantizados*.
- Diseño: marca QiORA (logo, verde #3f873f, negro), tipografía Plus Jakarta Sans; limpio, ordenado por importancia.

## Datos de entrada
Archivo de cálculo de bonos (ej. `Archivo de cálculo esqumea OS v7.xlsx`, `...al 11 de Octubre OS v6.xlsx`), ~25–50 MB. Hojas usadas:
- **Cierre Iguala**: `Fecha Termino`, `Usuario para pago`, `Servicio`.
- **Tecnicos**: fila de encabezado con `USUARIO FFM`, `SUCURSAL`, `NOMBRE DEL TÉCNICO`, `Contratista` ("Interno" o nombre), `Tipo` (A/B).
El contratista se cruza por "Usuario para pago" ↔ `USUARIO FFM`. El Cierre Iguala NO trae columna Contratista.

## Reglas de cálculo (calc.js)
- **Periodo mensual**: del día 1 al último día del mes por `Fecha Termino`. Folios de otros meses nunca cuentan, aunque la semana de bonos cruce meses. Corte = última fecha del mes presente en el archivo. Meses que no empiezan en día ≤3 se marcan "incompleto".
- Días trabajados por técnico = días distintos con ≥1 folio (validado al 100% vs hoja Resultados de sep-2026, 136 cuadrillas).
- Folios: excluyen día festivo; soporte y recolección se separan. Festivo: folios a precio (sin descuento soporte) + bono $350 si ≥3 folios (sin recolecciones).
- Asistencia contratista = floor(Σ días / HC autorizado). Productividad = floor1(Σ folios / HC / 26).
- Precio Tipo A: normal 480, piso 450, techo 520. 24 días −15, ≤23 −30. +20 por cada 0.1 arriba de 3.5 (hasta 3.8), con tope techo. Tipo B = A − 40 (410/440/480). López Mateos = A + 50 (500/530/570).
- Tipo por técnico: GLM → LM; GBA/GES/GPR o Tipo=A → A; resto B. El precio se calcula **por contratista** (un ajuste) y se aplica por tipo de distrito de cada técnico.
- Soporte = precio − 40. Recolección = $150.
- **Pronóstico**: días hábiles = lunes–sábado del mes (octubre 2026 = 27). Cada técnico sigue su ritmo: días_proy = d + (d/días_pasados)·días_restantes (tope total del mes); folios/día trabajado constante.
- Grupos técnico: **Debajo de la meta** (máx posible < 25 días), **Cerca de la meta**, **En meta** (≥24.5 días proy y ≥3.5 folios/día sobre 26).
- **Marco Anaya excluido** (se trabajará aparte: debería medirse por distrito; HC PDF 59 vs Excel 48).
- Festivos 2026 en `FESTIVOS`.

## HC autorizado
- Vive en **`hc.json`** (`{"2026-09": {"OMAR":17,...}, ...}`). Herencia por contratista: mes sin valor usa el último mes anterior definido.
- Valores sep-26 = oct-26: OMAR 17, CARLOS 13, MGG 11, ESM 10, ELI 10, ORT 8, MIG 5, JPV 4.
- Pantalla **"HC autorizado"**: matriz sep-26…dic-27 editable; recalcula al instante; cambios en localStorage ("sin publicar"); botón **Publicar en GitHub** (PUT a contents API con token del usuario, opcionalmente recordado en ese navegador); descargar / descartar.
- En `file://` no puede leer hc.json → usa los valores embebidos en `calc.js` (`HC_MES`), mantenerlos sincronizados.
- Nombres: `CONTRATISTAS` en calc.js con regex, porque cada archivo los escribe distinto (p.ej. "CARLOS MARTINEZ PALACI" vs "...PALACIO / ALEJANDRO DEL VALLE"). **Agustín Valencia Casillas + Juan Pablo Valencia se agrupan como "Grupo Onwars" (HC 4)** — pendiente confirmar con Giacomo.

## Pantallas
1. **Carga**: arrastrar Excel. Lectura en Web Worker embebido (blob) con fallback al hilo principal; ~6 s para 52 MB.
2. **Resumen del mes** (landing): costo estimado del mes, costo a la fecha, precio promedio ponderado, días/cuadrilla, folios/día, folios vs póliza, tabla por contratista con totales.
3. **Contratista**: encabezado (HC, trabajando X de HC, tipo, días restantes) · "Así vas" (cobrado a la fecha; estimado al cierre secundario) · precio por folio con ajustes · "Cómo vas contra tu meta" (cuadrillas, días, folios) · su equipo en 3 columnas · pop-up por técnico (KPIs, folios por tipo, calendario diario) · pop-up Reglas (póliza, ajustes, tabla A/B/LM con casilla actual, soporte/reco/festivo, vigencia 3 meses).
4. **HC autorizado**: matriz editable.
Descargas: "Descargar este contratista" (HTML) y "Descargar todos (.zip)" (JSZip).

## Archivos
- `index.html` — UI, lector Excel embebido (`#wsrc`), vistas, exportación.
- `calc.js` — motor de cálculo, CONTRATISTAS, HC_MES por defecto, FESTIVOS.
- `hc.json` — HC autorizado por mes (fuente en Pages).
- CDNs: SheetJS 0.18.5, JSZip 3.10.1 (cdnjs), Google Fonts.

## Pendientes / preguntas abiertas
- Confirmar agrupación Agustín Valencia + JP Valencia (HC 4).
- Omar (18 de 17) y Esmeralda (11 de 10) traen más cuadrillas que HC en octubre: ¿correcto o cambió el HC?
- Octubre tiene 27 días hábiles lun–sáb; productividad se mide sobre 26. Confirmar criterio.
- Pronóstico: ritmo de todo el mes vs más peso a última semana (no decidido; hoy = todo el mes).
- Marco Anaya: esquema por distrito, versión aparte.
- Estado de cuenta oficial de cierre de mes del nuevo esquema (segundo proyecto, mismo motor).
- Logo en alta resolución/SVG (hoy recorte de PNG de la hoja de marca).
- Hallazgos del Excel de cálculo de sep-2026 (columna "Real" desalineada en Glosario, recolecciones en festivo no pagadas, fila Total hasta 162, flotantes sin ROUND) — ver memoria del proyecto.
