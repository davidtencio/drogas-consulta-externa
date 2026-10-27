import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/prototype.js", ["prototype.js", "text/javascript; charset=utf-8"]],
]);

createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1:4317").pathname;
  const file = files.get(pathname);
  if (request.method !== "GET" || !file) {
    response.writeHead(404).end("No encontrado");
    return;
  }
  try {
    const body = await readFile(new URL(`./prototype/${file[0]}`, import.meta.url));
    response.writeHead(200, {
      "Content-Type": file[1],
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    }).end(body);
  } catch {
    response.writeHead(500).end("No se pudo abrir el prototipo");
  }
}).listen(4317, "127.0.0.1", () => {
  console.log("Prototipo DEMO: http://127.0.0.1:4317 — Ctrl+C para detener.");
});
