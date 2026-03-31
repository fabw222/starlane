import { Outlet } from "react-router-dom";
import { useSmartObject } from "@evefrontier/dapp-kit";
import { Navbar } from "@/components/Navbar";
import { useEveContext } from "@/hooks/useEveContext";

export function App() {
  const eve = useEveContext();
  const { assembly, loading: assemblyLoading } = useSmartObject();

  const assemblyLabel = assembly
    ? `${assembly.name || "Unnamed"} · ${assembly.state}`
    : assemblyLoading && eve.isInGame
      ? "Loading assembly…"
      : eve.itemId
        ? `Assembly ${eve.itemId.slice(0, 10)}…`
        : null;

  return (
    <div className="min-h-screen">
      <Navbar isInGame={eve.isInGame} />
      {eve.isInGame && assemblyLabel && (
        <div className="mx-auto max-w-7xl px-6 pt-4">
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan/20 bg-cyan/5 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-cyan">
            In-game · {assemblyLabel}
          </p>
        </div>
      )}
      <main className="mx-auto max-w-7xl px-6 py-10">
        <Outlet context={{ ...eve, assembly }} />
      </main>
    </div>
  );
}
