import { addClientToSheet, getClientsFromSheet, deleteClientFromSheet, updateClientInSheet } from "../services/googleSheetsService.js"; // Importa con nombres distintos

export const getClients = async (req, res) => {
  try {
    await getClientsFromSheet(req, res);
  } catch (error) {
    console.error("Error en el controlador al obtener los clientes:", error);
    res.status(500).json({ message: "Error al obtener los clientes" });
  }
};

export const addClient = async (req, res) => {
  try {
    const result = await addClientToSheet(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteClient = async (req, res) => {
  try {
    const result = await deleteClientFromSheet(req, res); // Pasa res aquí
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const editClient = async (req, res) => {
  try {
    const result = await updateClientInSheet(req, res); // Pasa res aquí
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};