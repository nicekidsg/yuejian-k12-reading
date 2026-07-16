import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const localBookTexts = {
  name: "local-book-texts",
  configureServer(server) {
    server.middlewares.use("/books/", async (request, response, next) => {
      const id = request.url?.match(/^\/?(\d+)\.txt$/)?.[1];
      if (!id) return next();
      try {
        const compressed = await readFile(new URL(`./public/books/${id}.txt.gz`, import.meta.url));
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end(gunzipSync(compressed));
      } catch {
        response.statusCode = 404;
        response.end("Book not found");
      }
    });
  },
};

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), localBookTexts],
});
