// Cloudflare Pages Functions middleware
// Injects environment variables into HTML responses as window.__ENV__
//
// Required CF Pages env vars: SUPABASE_URL, SUPABASE_ANON_KEY
// Set them in: CF Dashboard → Pages → Settings → Environment variables

export async function onRequest(context) {
  const response = await context.next();

  // Only inject into HTML responses
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const html = await response.text();

  const envScript = `<script>window.__ENV__={SUPABASE_URL:"${context.env.SUPABASE_URL || ''}",SUPABASE_ANON_KEY:"${context.env.SUPABASE_ANON_KEY || ''}"};</script>`;

  // Inject before </head> or at the start of <body>
  const injected = html.replace('<head>', '<head>\n' + envScript);

  return new Response(injected, {
    status: response.status,
    headers: response.headers,
  });
}
