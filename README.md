# Avance de Contratistas — QiORA Conecta

Herramienta web para ver el avance del mes de cada contratista bajo el esquema **destajo con póliza** y descargar un HTML individual por contratista.

## Uso
1. Abre la página (GitHub Pages o `index.html` local).
2. Arrastra el archivo de cálculo de bonos (`.xlsx`) con las hojas **Cierre Iguala** y **Tecnicos**.
3. Elige mes y contratista. Descarga uno o todos (ZIP).

El Excel se lee **solo en el navegador**; nada se sube a ningún servidor. Sin el archivo la página no muestra datos.

## Reglas que usa
- Periodo: del día 1 al último día del mes, por "Fecha Termino". Folios de otros meses no cuentan.
- Contratista de cada técnico: columna **Contratista** de la hoja `Tecnicos` ("Interno" se excluye). Marco Anaya se excluye por ahora.
- Días trabajados: días distintos con al menos 1 folio. Productividad: folios ÷ (HC autorizado × 26).
- Precio Tipo A 450/480/520, Tipo B 410/440/480, López Mateos 500/530/570. Asistencia: 24 días −$15, ≤23 −$30. Productividad: +$20 por cada 0.1 arriba de 3.5, hasta el techo. Soporte −$40, recolección $150, festivo bono $350 con ≥3 folios.
- Pronóstico: cada técnico sigue su propio ritmo del mes hasta el cierre.

## Mantenimiento
- **HC autorizado por mes**: `calc.js` → `HC_MES`. Un mes sin valores usa el último mes anterior.
- **Nombres de contratista**: `calc.js` → `CONTRATISTAS` (expresiones que reconocen cómo viene escrito en el archivo).
- **Días festivos**: `calc.js` → `FESTIVOS`.

Montos estimados antes de descuentos; no son oficiales ni garantizados.
