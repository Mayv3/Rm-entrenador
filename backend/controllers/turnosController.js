import { supabase } from "../lib/supabase.js";

export const getTurnos = async (req, res) => {
  const { data, error } = await supabase
    .from("turnos")
    .select("*, alumnos(id, nombre, telefono)")
    .order("fecha", { ascending: true })
    .order("hora", { ascending: true });

  if (error) return res.status(500).json({ message: "Error al obtener turnos" });
  return res.json(data);
};

export const getTurnosByAlumno = async (req, res) => {
  const { alumnoId } = req.params;
  const { data, error } = await supabase
    .from("turnos")
    .select("id, fecha, hora, notas")
    .eq("alumno_id", alumnoId)
    .order("fecha", { ascending: true })
    .order("hora", { ascending: true });

  if (error) return res.status(500).json({ message: "Error al obtener turnos" });
  return res.json(data);
};

export const createTurno = async (req, res) => {
  const { alumno_id, fecha, hora, notas } = req.body;

  if (!alumno_id || !fecha || !hora) {
    return res.status(400).json({ message: "alumno_id, fecha y hora son requeridos" });
  }

  const { data, error } = await supabase
    .from("turnos")
    .insert([{ alumno_id, fecha, hora, notas: notas || null }])
    .select("*, alumnos(id, nombre, telefono)")
    .single();

  if (error) return res.status(500).json({ message: "Error al crear el turno" });
  return res.json(data);
};

export const deleteTurno = async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.from("turnos").delete().eq("id", id);
  if (error) return res.status(500).json({ message: "Error al eliminar el turno" });
  return res.json({ success: true });
};
