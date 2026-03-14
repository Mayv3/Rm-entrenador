import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

// ── Posiciones X fijas de este template de PDF ────────────────────────────────
// Detectadas analizando el PDF real con pdfjs.
const COL = {
  actual:     [258, 275],   // x ≈ 263-268
  ajustado:   [300, 320],   // x ≈ 307-312  (se omite en display)
  anterior:   [348, 363],   // x ≈ 355-357
  diferencia: [486, 500],   // x ≈ 492
  scoreZ:     [530, 545],   // x ≈ 536-537
};
const MASA_COL = {
  kgAnterior: [178, 193],   // x ≈ 183-187
  porcentaje: [212, 227],   // x ≈ 218-220
  kgActual:   [258, 272],   // x ≈ 264-266
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const IS_NUMBER  = /^-?\d+([,.]\d+)?$/;
const IS_PERCENT = /^-?\d+([,.]\d+)?%$/;

function inRange(x, [min, max]) {
  return x >= min && x <= max;
}

// Busca el primer ítem de la fila cuyo x está en [min,max] y es número puro
function valAt(row, range) {
  const hit = row.find(it => inRange(it.x, range) && IS_NUMBER.test(it.text));
  return hit?.text ?? null;
}

// Para la columna porcentaje de masas (lleva % al final)
function pctAt(row, range) {
  const hit = row.find(it => inRange(it.x, range) && (IS_NUMBER.test(it.text) || IS_PERCENT.test(it.text)));
  return hit ? hit.text.replace("%", "") : null;
}

// ── Extracción de texto con posición ─────────────────────────────────────────

async function getItems(buffer) {
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0 });
  const pdf  = await task.promise;
  const seen = new Set();
  const items = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items) {
      const str = item.str?.trim();
      if (!str) continue;
      const key = `${str}|${Math.round(item.transform[4])}|${Math.round(item.transform[5])}`;
      if (seen.has(key)) continue;          // deduplicar (el PDF tiene 5 páginas iguales)
      seen.add(key);
      items.push({ text: str, x: Math.round(item.transform[4]), y: Math.round(item.transform[5]) });
    }
  }
  return items;
}

// Agrupa en filas por Y exacto (tolerance=0)
// Los ítems de cada fila del PDF comparten exactamente el mismo y-coordinate.
function groupRows(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  let cur = [], cy = null;
  for (const it of sorted) {
    if (cy === null || it.y === cy) {
      cur.push(it);
      if (cy === null) cy = it.y;
    } else {
      rows.push(cur);
      cur = [it];
      cy = it.y;
    }
  }
  if (cur.length) rows.push(cur);
  return rows;
}

function rowText(row) { return row.map(i => i.text).join(" "); }

// ── Busca la fila que contiene el campo y extrae los valores ──────────────────
// Requiere que el label esté en la columna izquierda (x < 200) para evitar
// falsos positivos de la columna derecha del PDF (x ≈ 480).
// exact=true: el texto del ítem debe ser exactamente fieldName (para evitar
//   que "Pantorrilla" matchee "Pantorrilla (máxima)").

function getRow(rows, fieldName, exact = false) {
  return rows.find(row =>
    row.some(it =>
      it.x < 200 && (exact ? it.text === fieldName : it.text.includes(fieldName))
    )
  ) ?? [];
}

// Muslo (medial) aparece 2 veces: 1ra = perímetro, 2da = pliegue
function getRowN(rows, fieldName, n) {
  let count = 0;
  for (const row of rows) {
    if (row.some(it => it.x < 200 && it.text.includes(fieldName))) {
      count++;
      if (count === n) return row;
    }
  }
  return [];
}

function med5(row) {
  return {
    actual:     valAt(row, COL.actual),
    anterior:   valAt(row, COL.anterior),
    diferencia: valAt(row, COL.diferencia),
    scoreZ:     valAt(row, COL.scoreZ),
  };
}

function med3(row) {
  return {
    actual:     valAt(row, COL.actual),
    anterior:   null,
    diferencia: null,
    scoreZ:     valAt(row, COL.scoreZ),
  };
}

function med1(row) {
  return { actual: valAt(row, COL.actual), anterior: null, diferencia: null, scoreZ: null };
}

function masa(row) {
  return {
    kgAnterior: valAt(row, MASA_COL.kgAnterior),
    porcentaje: pctAt(row, MASA_COL.porcentaje),
    kgActual:   valAt(row, MASA_COL.kgActual),
  };
}

// ── Parser principal ──────────────────────────────────────────────────────────

export async function parseAntropometriaPdf(buffer) {
  const items   = await getItems(buffer);
  const rows    = groupRows(items);
  const fullTxt = rows.map(rowText).join("\n");

  // Encabezado
  const nombre    = fullTxt.match(/Nombre:\s*([A-ZÁÉÍÓÚÑA-Za-záéíóúña-z ]+?)(?:\s+Edad|$)/m)?.[1]?.trim() ?? null;
  const edad      = fullTxt.match(/Edad:\s*([\d,]+)/)?.[1] ?? null;
  const nMedicion = fullTxt.match(/[Nn]úmero de medici[oó]n:\s*(\d+)/)?.[1] ?? null;
  const fecha     = fullTxt.match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] ?? null;

  const r  = (field, fmt) => fmt(getRow(rows, field));
  const rm = (field, n, fmt) => fmt(getRowN(rows, field, n));

  return {
    nombre, edad, nMedicion, fecha,

    basicos: {
      peso:         r("Peso (kg)",           med5),
      talla:        r("Talla (cm)",           med1),
      tallaSentado: r("Talla sentado (cm)",   med3),
    },

    diametros: {
      biacromial:           r("Biacromial",              med3),
      toraxTransverso:      r("Tórax Transverso",        med3),
      toraxAnteroposterior: r("Tórax Anteroposterior",   med3),
      biIliocrestideo:      r("Bi-iliocrestídeo",        med3),
      humeralBiepicondilar: r("Humeral (biepicondilar)", med3),
      femoralBiepicondilar: r("Femoral (biepicondilar)", med3),
    },

    perimetros: {
      cabeza:            r("Cabeza",                      med3),
      brazoRelajado:     r("Brazo Relajado",              med5),
      brazoFlexionado:   r("Brazo Flexionado en Tensión", med5),
      antebrazo:         r("Antebrazo",                   med5),
      toraxMesoesternal: r("Tórax Mesoesternal",          med5),
      cintura:           r("Cintura (mínima)",            med5),
      caderas:           r("Caderas (máxima)",            med5),
      musloSuperior:     r("Muslo (superior)",            med5),
      musloMedial:       rm("Muslo (medial)", 1,          med5),
      pantorrillaMaxima: r("Pantorrilla (máxima)",        med5),
    },

    pliegues: {
      triceps:      r("Tríceps",      med5),
      subescapular: r("Subescapular", med5),
      supraespinal: r("Supraespinal", med5),
      abdominal:    r("Abdominal",    med5),
      musloMedial:  rm("Muslo (medial)", 2, med5),
      pantorrilla:  med5(getRow(rows, "Pantorrilla", true)),
    },

    masas: {
      adiposa:  masa(getRow(rows, "Masa Adiposa")),
      muscular: masa(getRow(rows, "Masa Muscular")),
      residual: masa(getRow(rows, "Masa Residual")),
      osea:     masa(getRow(rows, "Masa Ósea")),
      piel:     masa(getRow(rows, "Masa de la Piel")),
    },
  };
}
