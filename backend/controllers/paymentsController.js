import { getPaymentsFromSheet } from "../services/googleSheetsPayments.js";

export const getPayments = async (req, res) => {
    try {
        await getPaymentsFromSheet(req, res);
    } catch (error) {
        console.error("Error en el controlador al obtener los pagos:", error);
        res.status(500).json({ message: "Error al obtener los pagos" });
    }
}