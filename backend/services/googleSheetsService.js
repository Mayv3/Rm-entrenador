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
const SPREADSHEET_ID = "1rACXVuc-T1D7oKfr6RYmRG3w8CKM19lfDNGb9uICyxI";
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

export const addClientToSheet = async (clientData) => {
  try {
    const { birthDate, modality, name, planUrl, schedule, time, whatsapp, startService, lastAntro } = clientData;

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

    const values = [[name, modality, birthDate, whatsapp, planUrl, scheduleString, startService, lastAntro]];
    
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

export const deleteClientFromSheet = async (req, res) => {
  const { id } = req.params;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:H`,
    });

    const rows = response.data.values;
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "No se encontraron clientes" });
    }

    const numericId = parseInt(id);
    if (isNaN(numericId) || numericId < 1 || numericId > rows.length) {
      return res.status(400).json({ message: "ID de cliente inválido" });
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
      message: "Cliente eliminado con éxito",
      deletedClient: {
        id: numericId,
        ...Object.fromEntries(
          ['name', 'modality', 'birthDate', 'whatsapp', 'planUrl', 'schedule', 'lastTraining']
            .map((key, i) => [key, rowToDelete[i]])
        )
      }
    });
  } catch (error) {
    console.error("Error al eliminar cliente:", error);
    res.status(500).json({ message: "Error al eliminar el cliente" });
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


