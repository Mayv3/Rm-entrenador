import { supabase } from "../lib/supabase.js";
import { parseAntropometriaPdf } from "./pdfAntroParser.js";

export const getAntrosByAlumno = async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("antropometrias")
    .select("*")
    .eq("alumno_id", id)
    .order("fecha", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ message: "Error al obtener antropometrías" });
  return res.json(data);
};

export const getAllAntrosCounts = async (req, res) => {
  const { data, error } = await supabase
    .from("antropometrias")
    .select("alumno_id");

  if (error) return res.status(500).json({ message: "Error al obtener conteos" });

  const counts = {};
  for (const row of data) {
    counts[row.alumno_id] = (counts[row.alumno_id] || 0) + 1;
  }

  return res.json(counts);
};

export const createAntro = async (req, res) => {
  const { id } = req.params;
  const { nombre_archivo, pdf_path } = req.body;

  if (!nombre_archivo || !pdf_path) {
    return res.status(400).json({ message: "nombre_archivo y pdf_path son requeridos" });
  }

  const { data, error } = await supabase
    .from("antropometrias")
    .insert([{ alumno_id: id, nombre_archivo, pdf_path }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: "Error al guardar la antropometría" });

  await supabase
    .from("alumnos")
    .update({ ultima_antro: new Date().toISOString().split("T")[0] })
    .eq("id", id);

  // Parsear y cachear en background sin bloquear la respuesta
  (async () => {
    try {
      const { data: signed } = await supabase.storage
        .from("antropometrias")
        .createSignedUrl(pdf_path, 120);
      if (!signed?.signedUrl) return;
      const buffer = Buffer.from(await fetch(signed.signedUrl).then(r => r.arrayBuffer()));
      const parsed = await parseAntropometriaPdf(buffer);
      await supabase.from("antropometrias").update({ parsed_data: parsed }).eq("id", data.id);
    } catch (e) {
      console.error("Error parsing antro on upload:", e);
    }
  })();

  return res.json(data);
};

export const updateAntroNombre = async (req, res) => {
  const { id } = req.params;
  const { nombre_archivo } = req.body;

  if (!nombre_archivo?.trim()) return res.status(400).json({ message: "El nombre no puede estar vacío" });

  const { error } = await supabase
    .from("antropometrias")
    .update({ nombre_archivo: nombre_archivo.trim() })
    .eq("id", id);

  if (error) return res.status(500).json({ message: "Error al actualizar el nombre" });
  return res.json({ success: true });
};

export const getParsedAntro = async (req, res) => {
  const { id } = req.params;

  const { data: record, error } = await supabase
    .from("antropometrias")
    .select("pdf_path, parsed_data")
    .eq("id", id)
    .single();

  if (error || !record) return res.status(404).json({ message: "Registro no encontrado" });

  // Cache hit: devolver inmediatamente
  if (record.parsed_data) return res.json(record.parsed_data);

  // Cache miss: el backend descarga el PDF directamente desde Supabase
  const { data: signed, error: signedError } = await supabase.storage
    .from("antropometrias")
    .createSignedUrl(record.pdf_path, 120);

  if (signedError || !signed?.signedUrl)
    return res.status(500).json({ message: "Error al generar URL del PDF" });

  const response = await fetch(signed.signedUrl);
  const buffer = Buffer.from(await response.arrayBuffer());

  const parsed = await parseAntropometriaPdf(buffer);

  // Guardar en cache para próximas vistas
  await supabase
    .from("antropometrias")
    .update({ parsed_data: parsed })
    .eq("id", id);

  return res.json(parsed);
};

export const updateAntroFecha = async (req, res) => {
  const { id } = req.params;
  const { fecha } = req.body;

  if (!fecha) return res.status(400).json({ message: "La fecha es requerida" });

  const { error } = await supabase
    .from("antropometrias")
    .update({ fecha })
    .eq("id", id);

  if (error) return res.status(500).json({ message: "Error al actualizar la fecha" });
  return res.json({ success: true });
};

export const deleteAntro = async (req, res) => {
  const { id } = req.params;

  const { data: record, error: fetchError } = await supabase
    .from("antropometrias")
    .select("pdf_path")
    .eq("id", id)
    .single();

  if (fetchError || !record) return res.status(404).json({ message: "Registro no encontrado" });

  const { error } = await supabase.from("antropometrias").delete().eq("id", id);
  if (error) return res.status(500).json({ message: "Error al eliminar" });

  return res.json({ success: true, pdf_path: record.pdf_path });
};
