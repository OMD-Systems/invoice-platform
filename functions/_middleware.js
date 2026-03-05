// Cloudflare Pages Functions middleware
// Injects environment variables into HTML responses as window.__ENV__
//
// Required CF Pages env vars: SUPABASE_URL, SUPABASE_ANON_KEY
// Set them in: CF Dashboard → Pages → Settings → Environment variables

function escapeForJS(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/<\/script>/gi, '<\\/script>');
}

export async function onRequest(context) {
  const response = await context.next();

  // Only inject into HTML responses
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const html = await response.text();

  const url = escapeForJS(context.env.SUPABASE_URL);
  const key = escapeForJS(context.env.SUPABASE_ANON_KEY);
  const envScript = `<script>window.__ENV__={SUPABASE_URL:"${url}",SUPABASE_ANON_KEY:"${key}"};</script>`;

  const injected = html.replace('<head>', '<head>\n' + envScript);

  return new Response(injected, {
    status: response.status,
    headers: response.headers,
  });
}
