import { supabase } from "../lib/supabase.js";

export const getNutricionByAlumno = async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("nutricion")
    .select("*")
    .eq("alumno_id", id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ message: "Error al obtener PDFs de nutrición" });
  return res.json(data);
};

export const getAllNutricionCounts = async (req, res) => {
  const { data, error } = await supabase
    .from("nutricion")
    .select("alumno_id");

  if (error) return res.status(500).json({ message: "Error al obtener conteos" });

  const counts = {};
  for (const row of data) {
    counts[row.alumno_id] = (counts[row.alumno_id] || 0) + 1;
  }

  return res.json(counts);
};

export const createNutricion = async (req, res) => {
  const { id } = req.params;
  const { nombre_archivo, pdf_path } = req.body;

  if (!nombre_archivo || !pdf_path) {
    return res.status(400).json({ message: "nombre_archivo y pdf_path son requeridos" });
  }

  const { data, error } = await supabase
    .from("nutricion")
    .insert([{ alumno_id: id, nombre_archivo, pdf_path }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: "Error al guardar el PDF de nutrición" });

  return res.json(data);
};

export const updateNutricionNombre = async (req, res) => {
  const { id } = req.params;
  const { nombre_archivo } = req.body;

  if (!nombre_archivo?.trim()) return res.status(400).json({ message: "El nombre no puede estar vacío" });

  const { error } = await supabase
    .from("nutricion")
    .update({ nombre_archivo: nombre_archivo.trim() })
    .eq("id", id);

  if (error) return res.status(500).json({ message: "Error al actualizar el nombre" });
  return res.json({ success: true });
};

export const deleteNutricion = async (req, res) => {
  const { id } = req.params;

  const { data: record, error: fetchError } = await supabase
    .from("nutricion")
    .select("pdf_path")
    .eq("id", id)
    .single();

  if (fetchError || !record) return res.status(404).json({ message: "Registro no encontrado" });

  const { error } = await supabase.from("nutricion").delete().eq("id", id);
  if (error) return res.status(500).json({ message: "Error al eliminar" });

  return res.json({ success: true, pdf_path: record.pdf_path });
};
