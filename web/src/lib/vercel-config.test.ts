import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("vercel SPA rewrites", () => {
  it("rewrites application routes to index.html", () => {
    const raw = readFileSync(new URL("../../vercel.json", import.meta.url), "utf8");
    const config = JSON.parse(raw) as {
      headers?: Array<{
        source: string;
        headers: Array<{ key: string; value: string }>;
      }>;
      rewrites?: Array<{ source: string; destination: string }>;
    };

    expect(config.rewrites).toEqual(
      expect.arrayContaining([
        { source: "/operator", destination: "/index.html" },
        { source: "/jump", destination: "/index.html" },
        { source: "/gates/:path*", destination: "/index.html" },
        { source: "/(.*)", destination: "/index.html" }
      ])
    );

    expect(config.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/(.*)",
          headers: expect.arrayContaining([
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
          ])
        })
      ])
    );

    const allHeaders = config.headers?.flatMap((h) => h.headers) ?? [];
    expect(allHeaders.find((h) => h.key === "X-Frame-Options")).toBeUndefined();
  });
});
