import { supabase } from "../lib/supabase.js";

export const getPaymentsSupabase = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pagos")
      .select("*");

    if (error) {
      throw new Error("Error al obtener pagos");
    }

    const sorted = (data || []).sort((a, b) => {
      const nameA = a.nombre?.toLowerCase() || "";
      const nameB = b.nombre?.toLowerCase() || "";
      return nameA.localeCompare(nameB);
    });

    return res.json(sorted);
  } catch (error) {
    console.error("Error al obtener pagos:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const addPaymentSupabase = async (req, res) => {
  console.log("📥 PaymentData recibido:", req.body);

  try {
    const {
      alumno_id,
      nombre,
      monto,
      fecha_de_pago,
      fecha_de_vencimiento,
      modalidad,
      whatsapp
    } = req.body;

    const newPayment = {
      alumno_id,
      nombre,
      monto,
      fecha_de_pago,
      fecha_de_vencimiento,
      modalidad,
      whatsapp
    };

    const { data, error } = await supabase
      .from("pagos")
      .insert([newPayment])
      .select()
      .single();

    if (error) {
      console.error("SUPABASE ERROR:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({
      success: true,
      message: "Pago agregado con éxito",
      id: data.id,
      data
    });

  } catch (error) {
    console.error("Error al agregar pago:", error);
    return res.status(500).json({
      error: "No se pudo agregar el pago",
    });
  }
};

export const deletePaymentSupabase = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ message: "ID inválido" });
    }

    const { data: payment, error: fetchError } = await supabase
      .from("pagos")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !payment) {
      return res.status(404).json({ message: "Pago no encontrado" });
    }

    const { error: deleteError } = await supabase
      .from("pagos")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("SUPABASE DELETE ERROR:", deleteError);
      return res.status(400).json({ message: deleteError.message });
    }

    return res.json({
      success: true,
      message: "Pago eliminado con éxito",
      deletedPayment: payment
    });

  } catch (error) {
    console.error("Error al eliminar pago:", error);
    res.status(500).json({ message: "Error al eliminar el pago" });
  }
};

export const deleteHistoryEntry = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from("historial_pagos").delete().eq("id", id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: "Error al eliminar el registro" });
  }
};

export const updateHistoryEntry = async (req, res) => {
  const { id } = req.params;
  const { monto, fecha_de_pago, fecha_de_vencimiento, modalidad } = req.body;
  try {
    // Actualizar el registro en historial_pagos
    const { data, error } = await supabase
      .from("historial_pagos")
      .update({ monto: Number(monto), fecha_de_pago, fecha_de_vencimiento, modalidad })
      .eq("id", id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });

    // Verificar si este es el registro más reciente para su pago_id
    const { data: latest } = await supabase
      .from("historial_pagos")
      .select("id")
      .eq("pago_id", data.pago_id)
      .order("changed_at", { ascending: false })
      .limit(1)
      .single();

    if (latest?.id === data.id) {
      await supabase
        .from("pagos")
        .update({ monto: Number(monto), modalidad, fecha_de_pago, fecha_de_vencimiento })
        .eq("id", data.pago_id);
    }

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ message: "Error al actualizar el registro" });
  }
};

export const getAllPaymentHistory = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("historial_pagos")
      .select("*")
      .order("changed_at", { ascending: false });

    if (error) {
      console.error("SUPABASE ERROR:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.json(data || []);
  } catch (error) {
    console.error("Error al obtener historial global:", error);
    return res.status(500).json({ message: "Error al obtener el historial" });
  }
};

export const getPaymentHistory = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ message: "ID inválido" });
    }

    const { data, error } = await supabase
      .from("historial_pagos")
      .select("*")
      .eq("pago_id", id)
      .order("changed_at", { ascending: false });

    if (error) {
      console.error("SUPABASE ERROR:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.json(data || []);
  } catch (error) {
    console.error("Error al obtener historial:", error);
    return res.status(500).json({ message: "Error al obtener el historial" });
  }
};

export const updatePaymentInSupabase = async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  console.log("📥 Datos recibidos para actualizar en Supabase:", body);

  try {
    const updatedFields = {
      alumno_id: req.body.studentId,
      nombre: body.name || null,
      monto: body.amount ? Number(body.amount) : null,
      fecha_de_pago: body.date || null,
      fecha_de_vencimiento: body.dueDate || null,
      modalidad: body.modality || null,
      whatsapp: body.whatsapp || body.phone || null,
    };

    // 🔍 Eliminar nulls para evitar errores
    Object.keys(updatedFields).forEach(
      (key) => updatedFields[key] === null && delete updatedFields[key]
    );

    const { data, error } = await supabase
      .from("pagos")
      .update(updatedFields)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("❌ SUPABASE UPDATE ERROR:", error);
      return res.status(500).json({ message: error.message });
    }

    return res.json({
      success: true,
      message: "Pago actualizado con éxito",
      updatedData: data,
    });

  } catch (error) {
    console.error("❌ Error al actualizar pago:", error);
    return res.status(500).json({ message: "Error al editar el pago" });
  }
};
