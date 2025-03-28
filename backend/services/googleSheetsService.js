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
const SPREADSHEET_ID = "1huhphdJkYImMuRhWjq7IhVm_QiG-l2C-RumFPkoLGYc";
const SHEET_NAME = "Hoja 1";


// Alumnos

export const getClientsFromSheet = async (req, res) => {
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

    // Filtrar filas vacías y mapear datos
    const data = rows.slice(1)
      .filter(row => row.some(cell => cell && cell.trim() !== ""))
      .map((row, index) => {
        const client = {};
        headers.forEach((header, i) => {
          client[header] = row[i] || "";
        });
        return {
          id: index + 1, // ID basado en posición
          rowNumber: index + 2, // Fila real en Sheets (fila 2 = índice 0)
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

export const addClientToSheet = async (clientData) => {
  try {
    const { birthDate, modality, name, planUrl, schedule, time, whatsapp, startService, lastAntro } = clientData;

    // Mapeo de días a formato abreviado
    const daysMap = {
      monday: "Lun",
      tuesday: "Mar",
      wednesday: "Mié",
      thursday: "Jue",
      friday: "Vie",
      saturday: "Sáb",
      sunday: "Dom",
    };

    // Construir string de días seleccionados
    const selectedDays = Object.entries(schedule)
      .filter(([_, value]) => value)
      .map(([day]) => daysMap[day])
      .join(", ");

    const scheduleString = selectedDays ? `${selectedDays} - ${time}` : "No definido";

    // Preparar los valores para insertar
    const values = [[name, modality, birthDate, whatsapp, planUrl, scheduleString, startService, lastAntro]];

    // Insertar en la hoja
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:H`, 
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS", 
      requestBody: { values },
    });

    // Obtener el ID de la fila insertada
    const updatedRange = response.data.updates.updatedRange;
    const rowId = parseInt(updatedRange.match(/A(\d+)/)[1]);

    return {
      success: true,
      status: 200,
      message: "Cliente agregado con éxito",
      id: rowId - 1, // ID basado en índice (fila - 2)
      rowNumber: rowId // Número de fila real en Sheets
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
      range: `${SHEET_NAME}!A2:H`,  // Rango de las filas que contienen los pagos
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
    const rowNumber = numericId + 1; // Fila real en Sheets (fila 2 = ID 1)

    // Obtener el sheetId
    const sheetMetadata = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheetId = sheetMetadata.data.sheets[0].properties.sheetId;

    // Eliminar la fila desplazando las demás filas
    const request = {
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,  // Aquí pasamos el sheetId correcto
                dimension: "ROWS",
                startIndex: rowNumber - 1,  // Índice de la fila a eliminar (convertido a base 0)
                endIndex: rowNumber,  // El índice final es el mismo
              },
            },
          },
        ],
      },
    };

    // Realizar la eliminación
    await sheets.spreadsheets.batchUpdate(request);

    res.json({
      success: true,
      message: "Pago eliminado correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar pago:", error);
    res.status(500).json({ message: "Error al eliminar el pago" });
  }
};


export const updateClientInSheet = async (req, res) => {
  const { id } = req.params;
  const clientData = req.body;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:H`,
    });

    const rows = response.data.values;
    const rowIndex = parseInt(id) - 1;

    if (rowIndex < 0 || rowIndex >= rows.length) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const { name, modality, birthDate, whatsapp, planUrl, schedule, time, startService, lastAntro } = clientData;

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

    const scheduleString = `${selectedDays} - ${time}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${rowIndex + 2}:h${rowIndex + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[name, modality, birthDate, whatsapp, planUrl, scheduleString, startService, lastAntro]],
      },
    });

    res.json({
      success: true,
      message: "Cliente actualizado con éxito",
      updatedData: clientData,
    });

  } catch (error) {
    console.error("Error al actualizar:", error);
    res.status(500).json({ message: "Error al editar el cliente" });
  }
};


