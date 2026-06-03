// Regla de acceso al portal del alumno.
// Un alumno pierde acceso cuando su vencimiento más lejano pasó hace
// más de GRACE_MONTHS (mes de gracia tras vencer el plan).

export const GRACE_MONTHS = 1;

// Normaliza una fecha de vencimiento ("YYYY-MM-DD" o ISO) a medianoche local.
function parseVencimiento(value) {
  if (!value) return null;
  const s = String(value);
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  const d = m ? new Date(`${m[0]}T00:00:00`) : new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// true si la membresía venció hace más de `graceMonths` meses.
// Sin pagos o sin fechas válidas => false (la regla no aplica).
export function isMembershipExpired(pagos, graceMonths = GRACE_MONTHS) {
  if (!Array.isArray(pagos) || pagos.length === 0) return false;

  const vencimientos = pagos
    .map((p) => parseVencimiento(p?.fecha_de_vencimiento))
    .filter(Boolean);

  if (vencimientos.length === 0) return false;

  // Vencimiento más lejano: el último plan que cubre al alumno.
  const ultimoVencimiento = new Date(Math.max(...vencimientos.map((d) => d.getTime())));

  // Límite de acceso = vencimiento + mes(es) de gracia.
  const limite = new Date(ultimoVencimiento);
  limite.setMonth(limite.getMonth() + graceMonths);
  limite.setHours(0, 0, 0, 0);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return hoy > limite;
}
