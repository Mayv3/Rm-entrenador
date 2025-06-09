import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const auth = new google.auth.GoogleAuth({
  credentials: {
    type: "service_account",
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY,
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: process.env.GOOGLE_AUTH_URI,
    token_uri: process.env.GOOGLE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = "1ZLS7WBzhW2L9mcrzrMpc4j3G2EgEq_VsMasPz5hlWp0";
const SHEET_NAME = "Hoja 1";

// Pagos

export const getPaymentsFromSheet = async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:H`,
    });

    let rows = response.data.values;

    if (!rows || rows.length === 0) {
      return res.json([]);
    }

    const headers = rows[0];

    const data = rows.slice(1)
      .filter(row => row.some(cell => cell && cell.trim() !== ""))
      .map((row, index) => {
        const client = {};
        headers.forEach((header, i) => {
          client[header] = row[i] || "";
        });
        return {
          id: index + 1, 
          rowNumber: index + 2, 
          ...client
        };
      });

    data.sort((a, b) => {
      const nameA = a.nombre?.toLowerCase() || '';
      const nameB = b.nombre?.toLowerCase() || '';
      return nameA.localeCompare(nameB);
    });

    res.json(data);
  } catch (error) {
    console.error("Error al obtener clientes:", error);
    res.status(500).json({ message: "Error al obtener los clientes" });
  }
};

export const addPaymentToSheet = async (PaymentData) => {
  try {
    const { studentId, name, modality,  amount, date, dueDate, phone} = PaymentData;

    console.log(PaymentData)
    
    const values = [[studentId, name, amount, date, dueDate, modality, phone]];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:H`, 
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS", 
      requestBody: { values },
    });

    const updatedRange = response.data.updates.updatedRange;
    const rowId = parseInt(updatedRange.match(/A(\d+)/)[1]);

    return {
      success: true,
      status: 200,
      message: "Cliente agregado con éxito",
      id: rowId - 1,
      rowNumber: rowId 
    };
  } catch (error) {
    console.error("Error al agregar cliente:", error);
    throw new Error("No se pudo agregar el cliente a la hoja");
  }
};

export const deletePaymentFromSheet = async (req, res) => {
  const { id } = req.params;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:H`,
    });

    const rows = response.data.values;
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "No se encontraron pagos" });
    }

    const numericId = parseInt(id);
    if (isNaN(numericId) || numericId < 1 || numericId > rows.length) {
      return res.status(400).json({ message: "ID del pago inválido" });
    }

    const rowToDelete = rows[numericId - 1];
    const rowNumber = numericId + 1; 

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: 0,
              dimension: "ROWS",
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        }],
      },
    });

    res.json({
      success: true,
      message: "Pago eliminado con éxito",
      deletedPayment: {
        id: numericId,
        ...Object.fromEntries(
          ['id_student', 'name', 'amount', 'date', 'dueDate','phone','modality', 'status']
            .map((key, i) => [key, rowToDelete[i]])
        )
      }
    });
  } catch (error) {
    console.error("Error al eliminar cliente:", error);
    res.status(500).json({ message: "Error al eliminar el cliente" });
  }
};
  
export const updatePaymentInSheet = async (req, res) => {
  const { id } = req.params;
  const paymentData = req.body;
  console.log("Datos recibidos para actualizar:", paymentData);

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:H`,
    });

    const rows = response.data.values;

    const rowIndex = rows.findIndex(row => row[0] === id.toString());

    if (rowIndex === -1) {
      return res.status(404).json({ message: "Pago no encontrado" });
    }

    const { studentId, name, modality, amount, date, dueDate, status, phone } = paymentData;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${rowIndex + 2}:H${rowIndex + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[studentId, name, amount, date, dueDate, modality, phone, status]],
      },
    });

    res.json({
      success: true,
      message: "Pago actualizado con éxito",
      updatedData: paymentData,
    });
  } catch (error) {
    console.error("Error al actualizar:", error);
    res.status(500).json({ message: "Error al editar el pago" });
  }
};
