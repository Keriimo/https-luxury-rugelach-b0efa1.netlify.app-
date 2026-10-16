import { onRequestGet, onRequestPost } from "./functions/api/catalog.js";

// Worker builds entrypoint. Static HTML/JS are delivered from Cloudflare assets
// without a Worker invocation; only /api/* executes this script.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/catalog" || url.pathname === "/api/catalog/") {
      const method = request.method.toUpperCase();
      if (method === "GET" || method === "HEAD") {
        const response = await onRequestGet({ request, env, context: ctx });
        return method === "HEAD" ? new Response(null, {status: response.status, headers: response.headers}) : response;
      }
      if (method === "POST") {
        return onRequestPost({ request, env, context: ctx });
      }
      return new Response(JSON.stringify({error:"Methode nicht erlaubt"}),{
        status:405,
        headers:{"Content-Type":"application/json; charset=utf-8","Allow":"GET, HEAD, POST","Cache-Control":"no-store"}
      });
    }
    // Other API paths do not expose internal project files.
    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({error:"Unbekannte API-Route"}),{
        status:404,headers:{"Content-Type":"application/json; charset=utf-8"}
      });
    }
    return env.ASSETS.fetch(request);
  }
};
