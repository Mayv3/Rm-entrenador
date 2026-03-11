export const parseLocalDate = (dateString: any): Date | null => {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;

  if (typeof dateString === "string" && dateString.includes("/")) {
    const [day, month, year] = dateString.split("/");
    const parsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split("-");
    const parsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const iso = new Date(dateString);
  return isNaN(iso.getTime()) ? null : iso;
};

export const determineSubscriptionStatus = (pago: any): string => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fechaVencimiento = parseLocalDate(pago.fecha_de_vencimiento);
  if (!fechaVencimiento || isNaN(fechaVencimiento.getTime())) return "Indefinido";

  fechaVencimiento.setHours(0, 0, 0, 0);
  if (hoy > fechaVencimiento) return "Vencido";

  const fechaPago = parseLocalDate(pago.fecha_de_pago);
  if (fechaPago && !isNaN(fechaPago.getTime())) return "Pagado";

  return "Pendiente";
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case "Pagado": return "#22c55e";
    case "Vencido": return "#ef4444";
    case "Indefinido": return "#000000";
    default:        return "#ef4444";
  }
};

export const formatDate = (date: any): string => {
  if (!date) return "No definido";
  const parsed = date instanceof Date ? date : parseLocalDate(date);
  if (!parsed || isNaN(parsed.getTime())) return "Fecha inválida";
  const d = String(parsed.getDate()).padStart(2, "0");
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${parsed.getFullYear()}`;
};
