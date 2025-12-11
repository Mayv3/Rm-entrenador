import { getPaymentsFromSheet, addPaymentToSheet, deletePaymentFromSheet, updatePaymentInSheet } from "../services/googleSheetsPayments.js";
import { supabase } from "../lib/supabase.js";

export const getPayments = async (req, res) => {
  try {
    await getPaymentsFromSheet(req, res);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los pagos" });
  }
}

export const addPayment = async (req, res) => {
  try {
    const result = await addPaymentToSheet(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deletePayment = async (req, res) => {
  try {
    const result = await deletePaymentFromSheet(req, res);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const editPayment = async (req, res) => {
  try {
    const result = await updatePaymentInSheet(req, res);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// supabase

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
