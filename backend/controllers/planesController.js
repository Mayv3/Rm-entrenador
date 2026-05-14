import { supabase } from "../lib/supabase.js";

export async function getPlanes(req, res) {
  const { data, error } = await supabase.from("planes").select("*").order("id");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function addPlan(req, res) {
  const { nombre, precio, descripcion, color } = req.body;
  if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });

  const precioBase = precio ?? 0;

  const { data: base, error } = await supabase
    .from("planes")
    .insert([{
      nombre,
      precio: precioBase,
      descripcion: descripcion ?? null,
      color: color ?? null,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const subplans = [
    {
      nombre,
      precio: Math.round(precioBase * 3 * 0.9),
      descripcion: null,
      color: color ?? null,
      parent_id: base.id,
      duracion_meses: 3,
      descuento: 10,
    },
    {
      nombre,
      precio: Math.round(precioBase * 6 * 0.85),
      descripcion: null,
      color: color ?? null,
      parent_id: base.id,
      duracion_meses: 6,
      descuento: 15,
    },
  ];

  const { error: subError } = await supabase.from("planes").insert(subplans);
  if (subError) return res.status(500).json({ error: subError.message });

  res.status(201).json(base);
}

export async function updatePlan(req, res) {
  const { id } = req.params;
  const { nombre, precio, descripcion, color, subplans } = req.body;

  const { data: plan, error } = await supabase
    .from("planes")
    .update({ nombre, precio, descripcion, color })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  if (subplans?.length) {
    for (const sub of subplans) {
      await supabase
        .from("planes")
        .update({ nombre, color, descuento: sub.descuento, precio: sub.precio })
        .eq("id", sub.id);
    }
  }

  res.json(plan);
}

export async function deletePlan(req, res) {
  const { id } = req.params;
  const { data, error } = await supabase.from("planes").delete().eq("id", id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}
