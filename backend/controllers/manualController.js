import { supabase } from "../lib/supabase.js";

// El manual es contenido editable por el entrenador: capítulos ordenados, cada
// uno con su captura y una lista de pasos.

export async function getManual(req, res) {
  const { data, error } = await supabase
    .from("manual_capitulos")
    .select("*, pasos:manual_pasos(*)")
    .order("orden", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Supabase no ordena las relaciones anidadas: los pasos vienen sin garantía.
  const capitulos = (data ?? []).map((cap) => ({
    ...cap,
    pasos: [...(cap.pasos ?? [])].sort((a, b) => a.orden - b.orden),
  }));

  res.json(capitulos);
}

// Guardado completo: el editor manda el manual entero y acá se sincroniza.
// Los capítulos sin id son nuevos; los que ya no vienen se borran (los pasos
// caen por el ON DELETE CASCADE).
export async function saveManual(req, res) {
  const { capitulos } = req.body;
  if (!Array.isArray(capitulos)) {
    return res.status(400).json({ error: "Se espera un array de capítulos" });
  }

  try {
    const { data: existentes, error: errExist } = await supabase
      .from("manual_capitulos")
      .select("id");
    if (errExist) throw new Error(errExist.message);

    const idsEnviados = capitulos.map((c) => c.id).filter(Boolean);
    const idsABorrar = (existentes ?? [])
      .map((c) => c.id)
      .filter((id) => !idsEnviados.includes(id));

    if (idsABorrar.length) {
      const { error } = await supabase.from("manual_capitulos").delete().in("id", idsABorrar);
      if (error) throw new Error(error.message);
    }

    for (const [index, cap] of capitulos.entries()) {
      const fila = {
        orden: index + 1,
        eyebrow: cap.eyebrow ?? null,
        titulo: cap.titulo ?? "",
        resumen: cap.resumen ?? null,
        imagen_url: cap.imagen_url ?? null,
        imagen_path: cap.imagen_path ?? null,
      };

      let capituloId = cap.id;

      if (capituloId) {
        const { error } = await supabase
          .from("manual_capitulos")
          .update(fila)
          .eq("id", capituloId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from("manual_capitulos")
          .insert([fila])
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        capituloId = data.id;
      }

      // Los pasos se reescriben enteros: son pocos y evita diffear por id.
      const { error: errDel } = await supabase
        .from("manual_pasos")
        .delete()
        .eq("capitulo_id", capituloId);
      if (errDel) throw new Error(errDel.message);

      const pasos = (cap.pasos ?? []).map((paso, i) => ({
        capitulo_id: capituloId,
        orden: i + 1,
        titulo: paso.titulo ?? "",
        texto: paso.texto ?? "",
      }));

      if (pasos.length) {
        const { error } = await supabase.from("manual_pasos").insert(pasos);
        if (error) throw new Error(error.message);
      }
    }

    return getManual(req, res);
  } catch (err) {
    console.error("Error guardando el manual:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function createCapitulo(req, res) {
  const { eyebrow, titulo, resumen, imagen_url, imagen_path } = req.body;

  const { data: ultimo, error: errOrden } = await supabase
    .from("manual_capitulos")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errOrden) return res.status(500).json({ error: errOrden.message });

  const { data, error } = await supabase
    .from("manual_capitulos")
    .insert([{
      orden: (ultimo?.orden ?? 0) + 1,
      eyebrow: eyebrow ?? null,
      titulo: titulo ?? "Nuevo capítulo",
      resumen: resumen ?? null,
      imagen_url: imagen_url ?? null,
      imagen_path: imagen_path ?? null,
    }])
    .select("*, pasos:manual_pasos(*)")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ...data, pasos: data.pasos ?? [] });
}

export async function updateCapitulo(req, res) {
  const { id } = req.params;
  const { eyebrow, titulo, resumen, imagen_url, imagen_path, orden } = req.body;

  const cambios = {};
  if (eyebrow !== undefined) cambios.eyebrow = eyebrow;
  if (titulo !== undefined) cambios.titulo = titulo;
  if (resumen !== undefined) cambios.resumen = resumen;
  if (imagen_url !== undefined) cambios.imagen_url = imagen_url;
  if (imagen_path !== undefined) cambios.imagen_path = imagen_path;
  if (orden !== undefined) cambios.orden = orden;

  const { data, error } = await supabase
    .from("manual_capitulos")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

// Devuelve imagen_path para que el frontend pueda borrar el archivo del bucket.
export async function deleteCapitulo(req, res) {
  const { id } = req.params;
  const { data, error } = await supabase
    .from("manual_capitulos")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}
