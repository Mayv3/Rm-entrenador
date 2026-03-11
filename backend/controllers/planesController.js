import { supabase } from "../lib/supabase.js";

export async function getPlanes(req, res) {
  const { data, error } = await supabase.from("planes").select("*").order("id");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function addPlan(req, res) {
  const { nombre, precio, descripcion, color } = req.body;
  if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });

  const { data, error } = await supabase
    .from("planes")
    .insert([{ nombre, precio: precio ?? 0, descripcion: descripcion ?? null, color: color ?? null }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
}

export async function updatePlan(req, res) {
  const { id } = req.params;
  const { nombre, precio, descripcion, color } = req.body;

  const { data, error } = await supabase
    .from("planes")
    .update({ nombre, precio, descripcion, color })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function deletePlan(req, res) {
  const { id } = req.params;
  const { data, error } = await supabase.from("planes").delete().eq("id", id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}
