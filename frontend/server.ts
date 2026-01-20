/**
 * Bun static server for MusakoneV3 frontend.
 * Serves files from /dist, falls back to index.html for SPA routing.
 */

const serveStatic = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = Bun.file(`./dist${path}`);

  if (!(await file.exists())) {
    const indexFile = Bun.file("./dist/index.html");
    return new Response(indexFile, {
      headers: { "Content-Type": "text/html" }
    });
  }

  return new Response(file);
};

Bun.serve({
  port: 3000,
  fetch: serveStatic,
});

console.log("MusakoneV3 Frontend running on http://localhost:3000");