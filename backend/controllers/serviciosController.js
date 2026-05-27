import { supabase } from "../lib/supabase.js";

export async function getServicios(req, res) {
  const { data, error } = await supabase.from("servicios").select("*").order("id");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function addServicio(req, res) {
  const { nombre, precio, descripcion, color } = req.body;
  if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });

  const { data, error } = await supabase
    .from("servicios")
    .insert([{
      nombre,
      precio: precio ?? 0,
      descripcion: descripcion ?? null,
      color: color ?? null,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
}

export async function updateServicio(req, res) {
  const { id } = req.params;
  const { nombre, precio, descripcion, color } = req.body;

  const { data, error } = await supabase
    .from("servicios")
    .update({
      nombre,
      precio: precio ?? 0,
      descripcion: descripcion ?? null,
      color: color ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function deleteServicio(req, res) {
  const { id } = req.params;
  const { data, error } = await supabase.from("servicios").delete().eq("id", id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}
