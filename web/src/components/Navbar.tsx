import { Link } from "react-router-dom";
import { SUI_NETWORK } from "@/lib/sui-config";

const navigation = [
  { to: "/", label: "Gate Index" },
  { to: "/operator", label: "Operator Deck" },
  { to: "/jump", label: "Jump Console" }
];

export function Navbar({ isInGame = false }: { isInGame?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="display-font text-xl uppercase tracking-[0.35em] text-cyan">
            StarLane
          </Link>
          <span className="hidden rounded-full border border-cyan/20 px-3 py-1 text-[0.65rem] uppercase tracking-[0.28em] text-steel md:inline-flex">
            Sui {SUI_NETWORK}
          </span>
        </div>

        <nav className="hidden items-center gap-2 md:flex">
          {navigation.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-full px-4 py-2 text-sm text-steel transition hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <p className="hidden text-xs uppercase tracking-[0.2em] text-steel lg:block">
          {isInGame ? "EVE In-Game" : "On-chain toll index"}
        </p>
      </div>
    </header>
  );
}
