const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function getAccessToken(serviceAccount: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${unsignedToken}.${signatureB64}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token as string;
}

function getTodaySheetName(): string {
  const now = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[now.getMonth()]} ${now.getDate()}`;
}

function normalizeShift(raw: string): string {
  const lower = (raw || '').toLowerCase().trim();
  if (lower === 'morning' || lower.includes('morning')) return 'morning';
  if (lower === 'afternoon' || lower.includes('afternoon')) return 'afternoon';
  if (lower === 'night' || lower.includes('night')) return 'night';
  return '';
}

async function getSheetId(spreadsheetId: string, sheetName: string, accessToken: string): Promise<number | null> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  const sheet = (meta.sheets || []).find((s: any) => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : null;
}

async function ensureSheetExists(spreadsheetId: string, sheetName: string, accessToken: string) {
  const existingId = await getSheetId(spreadsheetId, sheetName, accessToken);
  if (existingId !== null) return;

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      }),
    }
  );
}

async function clearSheet(spreadsheetId: string, sheetName: string, accessToken: string) {
  const sheetId = await getSheetId(spreadsheetId, sheetName, accessToken);
  if (sheetId === null) return;

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        requests: [{
          updateCells: {
            range: { sheetId, startRowIndex: 0, startColumnIndex: 0 },
            fields: 'userEnteredValue,userEnteredFormat',
          },
        }],
      }),
    }
  );
}

async function generateScheduleView(spreadsheetId: string, accessToken: string) {
  // 1. GET RAW DATA
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('RAW_DATA')}!A:F`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('Failed to read RAW_DATA:', err);
    return;
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];
  const records = rows.slice(1); // skip header

  if (records.length === 0) {
    console.log('No records found in RAW_DATA');
    return;
  }

  // Filter to today's date only
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const todayRecords = records.filter(row => {
    const rowDate = (row[0] || '').trim();
    return rowDate === todayStr;
  });

  if (todayRecords.length === 0) {
    console.log('No records found for today in RAW_DATA');
    return;
  }

  // 2. GROUP by shift and time
  const grouped: Record<string, Record<string, string[]>> = {
    morning: {},
    afternoon: {},
    night: {},
  };

  for (const row of todayRecords) {
    const shift = normalizeShift(row[1]);
    const name = row[2] || '';
    const time = row[3] || '';

    if (!shift || !name || !time) continue;
    if (!grouped[shift]) continue;

    if (!grouped[shift][time]) {
      grouped[shift][time] = [];
    }
    // Avoid duplicate names in the same slot
    if (!grouped[shift][time].includes(name)) {
      grouped[shift][time].push(name);
    }
  }

  // 3. FORMAT each shift section — track row positions for styling
  interface ShiftSection { titleRow: number; headerRow: number; dataStartRow: number; dataEndRow: number; shift: string; }
  const sections: ShiftSection[] = [];
  let currentRow = 0;
  const SPACER_ROWS = 3; // visible gap between shifts

  function formatShift(title: string, shiftKey: string, shiftData: Record<string, string[]>) {
    const output: string[][] = [];
    const sortedTimes = Object.keys(shiftData).sort();

    // Skip entirely empty shifts
    if (sortedTimes.length === 0) return output;

    const titleRow = currentRow;
    output.push([title]);
    currentRow++;
    const headerRow = currentRow;
    output.push(['Time Slot', 'Agent 1', 'Agent 2', 'Agent 3']);
    currentRow++;
    const dataStartRow = currentRow;

    for (const time of sortedTimes) {
      const agents = shiftData[time];
      output.push([time, agents[0] || '', agents[1] || '', agents[2] || '']);
      currentRow++;
    }
    const dataEndRow = currentRow;

    // Add spacer rows for visual separation
    for (let s = 0; s < SPACER_ROWS; s++) {
      output.push(['']);
      currentRow++;
    }

    sections.push({ titleRow, headerRow, dataStartRow, dataEndRow, shift: shiftKey });
    return output;
  }

  const finalData = [
    ...formatShift('Morning Shift', 'morning', grouped.morning),
    ...formatShift('Afternoon Shift', 'afternoon', grouped.afternoon),
    ...formatShift('Night Shift', 'night', grouped.night),
  ];

  if (finalData.length === 0) {
    console.log('No shift data to write');
    return;
  }

  // 4. WRITE to today's formatted sheet
  const sheetName = getTodaySheetName();
  await ensureSheetExists(spreadsheetId, sheetName, accessToken);

  // Clear existing content and formatting
  await clearSheet(spreadsheetId, sheetName, accessToken);

  // Unmerge all cells first to avoid conflicts
  const preSheetId = await getSheetId(spreadsheetId, sheetName, accessToken);
  if (preSheetId !== null) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          requests: [{
            unmergeCells: {
              range: { sheetId: preSheetId, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 10 },
            },
          }],
        }),
      }
    );
  }

  const encodedSheet = encodeURIComponent(sheetName);

  // Write new data
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}!A1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ values: finalData }),
    }
  );

  if (!writeRes.ok) {
    const err = await writeRes.text();
    console.error(`Failed to write schedule to "${sheetName}":`, err);
    return;
  }

  console.log(`Schedule view written to "${sheetName}" sheet`);

  // 5. APPLY FORMATTING
  const sheetId = await getSheetId(spreadsheetId, sheetName, accessToken);
  if (sheetId === null) {
    console.error('Could not find sheetId for formatting');
    return;
  }

  const c = (r: number, g: number, b: number) => ({ red: r, green: g, blue: b });

  // Color palette
  const shiftColors: Record<string, { title: ReturnType<typeof c>; headerBg: ReturnType<typeof c>; dataBg: ReturnType<typeof c>; timeBg: ReturnType<typeof c> }> = {
    morning: {
      title: c(1, 0.84, 0.4),
      headerBg: c(0.98, 0.93, 0.75),
      dataBg: c(1, 0.97, 0.88),
      timeBg: c(0.96, 0.88, 0.65),
    },
    afternoon: {
      title: c(0.36, 0.72, 0.82),
      headerBg: c(0.78, 0.92, 0.96),
      dataBg: c(0.9, 0.96, 0.98),
      timeBg: c(0.65, 0.85, 0.92),
    },
    night: {
      title: c(0.47, 0.35, 0.75),
      headerBg: c(0.82, 0.78, 0.94),
      dataBg: c(0.92, 0.9, 0.97),
      timeBg: c(0.72, 0.65, 0.88),
    },
  };

  const formatRequests: any[] = [];

  const cellFormat = (startRow: number, endRow: number, startCol: number, endCol: number, bgColor: ReturnType<typeof c>, bold = false, fontSize = 10, textColor?: ReturnType<typeof c>) => ({
    repeatCell: {
      range: { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startCol, endColumnIndex: endCol },
      cell: {
        userEnteredFormat: {
          backgroundColor: bgColor,
          textFormat: { bold, fontSize, foregroundColor: textColor || c(0.1, 0.1, 0.1) },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          borders: {
            top: { style: 'SOLID', color: c(0.8, 0.8, 0.8) },
            bottom: { style: 'SOLID', color: c(0.8, 0.8, 0.8) },
            left: { style: 'SOLID', color: c(0.8, 0.8, 0.8) },
            right: { style: 'SOLID', color: c(0.8, 0.8, 0.8) },
          },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,borders)',
    },
  });

  for (const section of sections) {
    const colors = shiftColors[section.shift];
    if (!colors) continue;

    // Shift title row — bold, large, shift color bg, white text
    formatRequests.push(cellFormat(section.titleRow, section.titleRow + 1, 0, 4, colors.title, true, 14, c(1, 1, 1)));
    // Merge title across columns
    formatRequests.push({ mergeCells: { range: { sheetId, startRowIndex: section.titleRow, endRowIndex: section.titleRow + 1, startColumnIndex: 0, endColumnIndex: 4 }, mergeType: 'MERGE_ALL' } });

    // Column header row (Time Slot, Agent 1-3) — bold, header bg
    formatRequests.push(cellFormat(section.headerRow, section.headerRow + 1, 0, 4, colors.headerBg, true, 11));

    if (section.dataEndRow > section.dataStartRow) {
      // Time slot column (col A) — distinct time bg
      formatRequests.push(cellFormat(section.dataStartRow, section.dataEndRow, 0, 1, colors.timeBg, true, 10));
      // Agent columns (cols B-D) — light data bg
      formatRequests.push(cellFormat(section.dataStartRow, section.dataEndRow, 1, 4, colors.dataBg, false, 10));
    }
  }

  // Auto-resize columns
  formatRequests.push({
    autoResizeDimensions: {
      dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 4 },
    },
  });
  // Set minimum column widths
  formatRequests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 4 },
      properties: { pixelSize: 160 },
      fields: 'pixelSize',
    },
  });

  const fmtRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ requests: formatRequests }),
    }
  );

  if (!fmtRes.ok) {
    const err = await fmtRes.text();
    console.error('Failed to format sheet:', err);
  } else {
    console.log(`Sheet "${sheetName}" formatted successfully`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const saKeyJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!saKeyJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured');
    }

    const serviceAccount = JSON.parse(saKeyJson);
    const accessToken = await getAccessToken(serviceAccount);

    const { spreadsheetId, rows } = await req.json();

    if (!spreadsheetId) {
      throw new Error('spreadsheetId is required');
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      throw new Error('rows array is required and must not be empty');
    }

    // Ensure RAW_DATA sheet exists with headers
    await ensureSheetExists(spreadsheetId, 'RAW_DATA', accessToken);

    // Check if RAW_DATA has headers, if not add them
    const headerCheck = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('RAW_DATA')}!A1:F1`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const headerData = await headerCheck.json();
    if (!headerData.values || headerData.values.length === 0) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('RAW_DATA')}!A1:F1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ values: [['Date', 'Shift', 'Employee', 'Time', 'Status', 'Timestamp']] }),
        }
      );
    }

    // Append rows to RAW_DATA
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('RAW_DATA')}!A:F:append?valueInputOption=USER_ENTERED`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ values: rows }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Google Sheets API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    // Generate formatted schedule view after successful append
    await generateScheduleView(spreadsheetId, accessToken);

    return new Response(JSON.stringify({ success: true, updatedRows: data.updates?.updatedRows }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Sync to sheets error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
