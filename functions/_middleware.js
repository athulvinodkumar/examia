import { getCorsHeaders } from "../src/worker.js";

/**
 * Cloudflare Pages Middleware for CORS and edge performance
 */
export async function onRequest(context) {
  // Handle CORS preflight options
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(context.request, context.env)
    });
  }

  const response = await context.next();

  // Attach CORS headers if not already attached
  const cors = getCorsHeaders(context.request, context.env);
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) {
    if (!newHeaders.has(key)) {
      newHeaders.set(key, value);
    }
  }

  return new Response(response.body, {
    status: response.status,
    status_text: response.statusText,
    headers: newHeaders
  });
}
