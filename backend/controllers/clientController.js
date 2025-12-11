import { supabase } from "../lib/supabase.js";

export const getMembersSupabase = async (req, res) => {

  let { data: alumnos, error } = await supabase
    .from('alumnos')
    .select('*')
    .order("nombre", { ascending: true });

if (error) {
  console.error("Error al obtener miembros de Supabase:", error);
  return res.status(500).json({ message: "Error al obtener los miembros" });
}

let response = res.json(alumnos);

return response;
}

export const addClientSupabase = async (req, res) => {

  try {
    const addClientToSupabase = async (clientData) => {
      const {
        birthDate,
        modality,
        name,
        planUrl,
        schedule,
        time,
        whatsapp,
        email,
        startService,
        lastAntro
      } = clientData;

      const daysMap = {
        monday: "Lun",
        tuesday: "Mar",
        wednesday: "Mié",
        thursday: "Jue",
        friday: "Vie",
        saturday: "Sáb",
        sunday: "Dom",
      };

      const selectedDays = Object.entries(schedule)
        .filter(([_, value]) => value)
        .map(([day]) => daysMap[day])
        .join(", ");

      const scheduleString = selectedDays ? `${selectedDays} - ${time}` : "No definido";

      const newClient = {
        nombre: name,
        modalidad: modality,
        fecha_de_nacimiento: birthDate || null,
        telefono: whatsapp || null,
        email: email || null,
        plan: planUrl || null,
        dias: scheduleString,
        fecha_de_inicio: startService || null,
        ultima_antro: lastAntro || null,
      };

      const { data, error } = await supabase
        .from("alumnos")
        .insert([newClient])
        .select()
        .single();

      if (error) {
        console.error("❌ Error Supabase:", error);
        throw new Error("No se pudo agregar el cliente a Supabase");
      }

      return {
        success: true,
        status: 200,
        message: "Cliente agregado con éxito",
        id: data.id, // ID generado automáticamente
      };
    };

    const result = await addClientToSupabase(req.body);
    return res.json(result);

  } catch (error) {
    console.error("❌ Error en el controller addClientSupabase:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const deleteClientSupabase = async (req, res) => {
  const { id } = req.params;

  try {
    console.log("ID recibido:", id);

    const { data: clientToDelete, error: fetchError } = await supabase
      .from("alumnos")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !clientToDelete) {
      throw new Error("Cliente no encontrado");
    }

    const { error: deleteError } = await supabase
      .from("alumnos")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error al eliminar:", deleteError);
      throw new Error("No se pudo eliminar el cliente");
    }

    const deletedClient = {
      id,
      name: clientToDelete.nombre,
      modality: clientToDelete.modalidad,
      birthDate: clientToDelete.fecha_de_nacimiento,
      whatsapp: clientToDelete.telefono,
      planUrl: clientToDelete.plan,
      schedule: clientToDelete.dias,
      startService: clientToDelete.fecha_de_inicio,
      lastAntro: clientToDelete.ultima_antro,
    };

    return res.json({
      success: true,
      message: "Cliente eliminado con éxito",
      deletedClient,
    });

  } catch (error) {
    console.error("❌ Error en deleteClient:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const updateClientSupabase = async (req, res) => {
  const { id } = req.params;
  const clientData = req.body;

  try {
    const { data: existingClient, error: fetchError } = await supabase
      .from("alumnos")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingClient) {
      throw new Error("Cliente no encontrado");
    }

    const {
      name,
      modality,
      birthDate,
      whatsapp,
      email,
      planUrl,
      schedule,
      time,
      startService,
      lastAntro
    } = clientData;

    const daysMap = {
      monday: "Lun",
      tuesday: "Mar",
      wednesday: "Mié",
      thursday: "Jue",
      friday: "Vie",
      saturday: "Sáb",
      sunday: "Dom",
    };

    const selectedDays = Object.entries(schedule || {})
      .filter(([_, value]) => value)
      .map(([day]) => daysMap[day])
      .join(", ");

    const scheduleString = `${selectedDays} - ${time}`;

    const updatedClient = {
      nombre: name,
      modalidad: modality,
      fecha_de_nacimiento: birthDate || null,
      telefono: whatsapp,
      email: email || null,
      plan: planUrl,
      dias: scheduleString,
      fecha_de_inicio: startService || null,
      ultima_antro: lastAntro || null,
    };

    const { error: updateError } = await supabase
      .from("alumnos")
      .update(updatedClient)
      .eq("id", id);

    if (updateError) {
      throw new Error("No se pudo actualizar el alumno");
    }

    return res.json({
      success: true,
      message: "Cliente actualizado con éxito",
      updatedData: clientData,
    });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};