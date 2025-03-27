import { getPaymentsFromSheet, addPaymentToSheet, deletePaymentFromSheet } from "../services/googleSheetsPayments.js";

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
    const result = await deletePaymentFromSheet(req, res); // Pasa res aquí
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
