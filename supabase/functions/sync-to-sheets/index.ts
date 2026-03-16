const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    if (!API_KEY) {
      throw new Error('GOOGLE_SHEETS_API_KEY is not configured');
    }

    const { spreadsheetId, rows } = await req.json();

    if (!spreadsheetId) {
      throw new Error('spreadsheetId is required');
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      throw new Error('rows array is required and must not be empty');
    }

    // Append rows to the sheet
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:F:append?valueInputOption=USER_ENTERED&key=${API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        values: rows,
      }),
    });

    const data = await response.json();

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
