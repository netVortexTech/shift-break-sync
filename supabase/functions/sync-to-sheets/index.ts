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

async function ensureSheetExists(spreadsheetId: string, sheetName: string, accessToken: string) {
  // Check if sheet exists
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  const sheets = (meta.sheets || []).map((s: any) => s.properties.title);

  if (!sheets.includes(sheetName)) {
    // Create the sheet
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
}

async function generateScheduleView(spreadsheetId: string, accessToken: string) {
  // 1. GET RAW DATA
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/RAW_DATA!A:F`,
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

  // 2. GROUP by shift and time
  const grouped: Record<string, Record<string, string[]>> = {
    morning: {},
    afternoon: {},
    night: {},
  };

  for (const row of records) {
    const shift = normalizeShift(row[1]);
    const name = row[2] || '';
    const time = row[3] || '';

    if (!shift || !name || !time) continue;
    if (!grouped[shift]) continue;

    if (!grouped[shift][time]) {
      grouped[shift][time] = [];
    }
    grouped[shift][time].push(name);
  }

  // 3. FORMAT each shift section
  function formatShift(title: string, shiftData: Record<string, string[]>) {
    const output: string[][] = [];
    output.push([title]);
    output.push(['Time Slot', 'Agent 1', 'Agent 2', 'Agent 3']);

    const sortedTimes = Object.keys(shiftData).sort();
    for (const time of sortedTimes) {
      const agents = shiftData[time];
      output.push([time, agents[0] || '', agents[1] || '', agents[2] || '']);
    }

    output.push(['']); // spacer row
    return output;
  }

  const finalData = [
    ...formatShift('Morning Shift', grouped.morning),
    ...formatShift('Afternoon Shift', grouped.afternoon),
    ...formatShift('Night Shift', grouped.night),
  ];

  // 4. WRITE to today's formatted sheet
  const sheetName = getTodaySheetName();
  await ensureSheetExists(spreadsheetId, sheetName, accessToken);

  // Clear the sheet first, then write
  const encodedSheet = encodeURIComponent(sheetName);

  // Clear existing content
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}!A:Z:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  // Write new data
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}!A1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ values: finalData }),
    }
  );

  if (!writeRes.ok) {
    const err = await writeRes.text();
    console.error(`Failed to write schedule to "${sheetName}":`, err);
  } else {
    console.log(`Schedule view written to "${sheetName}" sheet`);
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

    // Append rows to RAW_DATA
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/RAW_DATA!A:F:append?valueInputOption=USER_ENTERED`;

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
