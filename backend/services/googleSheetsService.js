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
      range: `${SHEET_NAME}!A1:I`,
    });

    let rows = response.data.values;

    if (!rows || rows.length === 0) {
      return res.json([]);
    }

    const headers = rows[0];

    const data = response.data.values.slice(1)
      .filter(row => row.some(cell => cell && cell.trim() !== ""))
      .map((row) => {
        const client = {};
        headers.forEach((header, i) => {
          client[header] = row[i] || "";
        });
        return client;
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

    // Crear el string con días y hora
    const selectedDays = Object.entries(schedule)
      .filter(([_, value]) => value)
      .map(([day]) => daysMap[day])
      .join(", ");

    const scheduleString = selectedDays ? `${selectedDays} - ${time}` : "No definido";

    // Obtener IDs existentes para calcular el máximo
    const responseIds = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!I2:I`, // IDs sin encabezado
    });

    const ids = responseIds.data.values?.flat()
      .map(id => parseInt(id))
      .filter(n => !isNaN(n)) || [];

    const maxId = ids.length > 0 ? Math.max(...ids) : 0;
    const newID = maxId + 1;

    // Preparar valores para insertar (9 columnas, columna I = ID)
    const values = [[
      name,          // A
      modality,      // B
      birthDate,     // C
      whatsapp,      // D
      planUrl,       // E
      scheduleString,// F
      startService,  // G
      lastAntro,     // H
      newID          // I
    ]];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:I`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });

    // Extraer número de fila insertada para devolver
    const updatedRange = response.data.updates.updatedRange;
    const rowNumber = parseInt(updatedRange.match(/[A-Z]+(\d+)/)[1]);
    console.log(values)

    return {
      success: true,
      status: 200,
      message: "Cliente agregado con éxito",
      id: newID,
      rowNumber
    };

  } catch (error) {
    console.error("Error al agregar cliente:", error);
    throw new Error("No se pudo agregar el cliente a la hoja");
  }
};

export const deleteClientFromSheet = async (req) => {
  const { id } = req.params;
  console.log("ID recibido:", id);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:I`,
  });

  const rows = response.data.values;

  if (!rows || rows.length === 0) {
    throw new Error("No se encontraron clientes");
  }

  // Buscar en columna I (índice 8) la fila con ese ID
  const rowIndex = rows.findIndex(row => row[8] === id);
  console.log("rowIndex encontrado:", rowIndex);

  if (rowIndex === -1) {
    throw new Error("Cliente no encontrado");
  }

  const rowToDelete = rows[rowIndex];
  const rowNumber = rowIndex + 2; // A2 es la primera fila de datos

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

  return {
    success: true,
    message: "Cliente eliminado con éxito",
    deletedClient: {
      id,
      ...Object.fromEntries(
        ['name', 'modality', 'birthDate', 'whatsapp', 'planUrl', 'schedule', 'lastTraining']
          .map((key, i) => [key, rowToDelete[i]])
      )
    }
  };
};

export const updateClientInSheet = async (req) => {
  const { id } = req.params;
  const clientData = req.body;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:I`,
  });

  const rows = response.data.values;

  const rowIndex = rows.findIndex(row => row[8] === id);
  console.log("rowIndex encontrado para update:", rowIndex);

  if (rowIndex === -1) {
    throw new Error("Cliente no encontrado");
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

  const selectedDays = Object.entries(schedule || {})
    .filter(([_, value]) => value)
    .map(([day]) => daysMap[day])
    .join(", ");

  const scheduleString = `${selectedDays} - ${time}`;

  const rowNumber = rowIndex + 2;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A${rowNumber}:H${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[name, modality, birthDate, whatsapp, planUrl, scheduleString, startService, lastAntro]],
    },
  });

  return {
    success: true,
    message: "Cliente actualizado con éxito",
    updatedData: clientData,
  };
};
