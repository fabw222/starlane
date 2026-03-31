import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("recharts")) {
            return "charting";
          }

          if (id.includes("@mysten/sui/transactions")) {
            return "wallet";
          }

          if (id.includes("@mysten/sui")) {
            return "sui-sdk";
          }

          if (
            id.includes("@evefrontier") ||
            id.includes("@mysten/dapp-kit") ||
            id.includes("@mysten/dapp-kit-core")
          ) {
            return "wallet";
          }

          if (id.includes("react-router")) {
            return "routing";
          }

          if (id.includes("@tanstack/react-query")) {
            return "query";
          }

          return undefined;
        }
      }
    }
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "src"),
      react: path.resolve(__dirname, "../node_modules/react"),
      "react-dom": path.resolve(__dirname, "../node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "../node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "../node_modules/react/jsx-dev-runtime.js")
    }
  },
  test: {
    environment: "node",
    globals: true
  }
});
