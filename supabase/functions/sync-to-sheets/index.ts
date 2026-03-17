const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Create a JWT for Google Service Account auth
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

  // Import the private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange JWT for access token
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

async function generateScheduleView(spreadsheetId: string, accessToken: string) {
  // 1. GET RAW DATA
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/RAW_DATA!A:F`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const data = await res.json();
  const rows = data.values || [];

  const records = rows.slice(1); // remove header

  const grouped: any = {
    morning: {},
    afternoon: {},
    night: {},
  };

  // 2. GROUP DATA
  records.forEach((row: string[]) => {
    const rawShift = row[1];

    let shift = "";

if (rawShift.toLowerCase().includes("morning")) {
  shift = "morning";
} else if (rawShift.toLowerCase().includes("afternoon")) {
  shift = "afternoon";
} else if (rawShift.toLowerCase().includes("night")) {
  shift = "night";
}
    const name = row[2];
    const time = row[3];

    if (!grouped[shift]) return;

    if (!grouped[shift][time]) {
      grouped[shift][time] = [];
    }

    grouped[shift][time].push(name);
  });

  // 3. FORMAT FUNCTION
  function formatShift(title: string, shiftData: any) {
    const output: any[] = [];

    output.push([title]);
    output.push(["Time slot", "Agent 1", "Agent 2", "Agent 3"]);

    Object.keys(shiftData)
      .sort()
      .forEach((time) => {
        const agents = shiftData[time];

        output.push([
          time,
          agents[0] || "",
          agents[1] || "",
          agents[2] || "",
        ]);
      });

    output.push([""]);
    return output;
  }

  const finalData = [
    ...formatShift("Morning Shift", grouped.morning),
    ...formatShift("Afternoon Shift", grouped.afternoon),
    ...formatShift("Night Shift", grouped.night),
  ];

  // 4. WRITE TO FORMATTED SHEET
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/March 17!A1?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ values: finalData }),
    }
  );
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

    // Append rows to the sheet
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/RAW_DATA!A:F:append?valueInputOption=USER_ENTERED`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ values: rows }),
    });

    const data = await response.json();

    await generateScheduleView(spreadsheetId, accessToken);
    
    if (!response.ok) {
      throw new Error(`Google Sheets API error [${response.status}]: ${JSON.stringify(data)}`);
    }

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
