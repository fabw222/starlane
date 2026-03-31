# StarLane

**The first trustless toll economy for EVE Frontier — gate operators set fees, pilots pay to jump, all enforced on-chain.**

## What is StarLane?

StarLane turns EVE Frontier's Smart Gates into revenue-generating toll booths. Gate operators publish their gates on the StarLane marketplace, set a jump fee, and earn SUI every time a pilot flies through. No middleman, no backend — every toll payment, fee change, and revenue withdrawal is a transparent Sui transaction.

## The Problem

EVE Frontier gives players the power to build and own stargates, but there's no native way to monetize them. Gate operators invest time and resources constructing gates that connect solar systems, yet have no mechanism to charge for passage or manage pricing. The gate economy is invisible.

## How StarLane Works

- **For Gate Operators**: Connect your wallet in the in-game browser, select an unregistered gate, set your toll fee, and register with one click. Your gate immediately appears in the StarLane marketplace. Revenue accumulates on-chain and can be withdrawn at any time.
- **For Pilots**: Browse available gates, see toll fees upfront, and purchase a jump permit directly from the in-game browser. The permit is issued to your character automatically — no extra steps.
- **Fee Splits**: 99% of every toll goes directly to the gate operator. 1% sustains the StarLane protocol.

## Why It Matters

StarLane creates the first player-driven infrastructure economy in EVE Frontier. Gate operators become toll road entrepreneurs. Pilots get transparent, verifiable pricing. The marketplace provides real-time analytics — total jumps, revenue per gate, fee history — giving the community visibility into the emerging transport network.

## Live Integration

StarLane runs natively inside EVE Frontier's in-game browser. When a pilot interacts with a Smart Gate, StarLane opens automatically, pre-filled with that gate's context. No alt-tabbing, no external wallets — the entire experience lives inside the game.

All data is read directly from Sui on-chain events. No backend, no database — the web app is a pure static SPA.

## Architecture

```text
contract/       Sui Move package (starlane + world_contracts compat layer)
web/            Vite SPA with EVE Frontier dApp Kit integration
ts-scripts/     Testnet scripts and end-to-end smoke test
```

### Smart Contract

- `toll_gate.move` — TollRegistry, gate registration, fee updates, jump permit purchase, revenue withdrawal
- Typed witness pattern (`TollAuth`) for EVE Frontier gate extension authorization
- 15 Move unit tests covering happy paths and auth boundary failures

### Web App

- `/` — Gate Index with aggregate stats (total gates, jumps, fees)
- `/gates/:id` — Gate telemetry (fee, jump count, revenue chart, transaction history)
- `/operator` — Register gates, update fees, withdraw revenue
- `/jump` — Buy jump permits with wallet signing

### EVE Frontier Integration

- `@evefrontier/dapp-kit` wallet provider with network sync
- In-game browser support: reads `?itemId=` / `?tenant=` query params
- Auto-redirects to the gate the pilot is standing at
- Pre-fills source gate in the jump console
- `set-assembly-url.ts` script to configure the dApp URL on Smart Assemblies

## Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contract | Sui Move 2024 edition |
| Frontend | React 18 + Vite + TailwindCSS |
| Wallet | `@evefrontier/dapp-kit` + `@mysten/dapp-kit-react` v2 |
| Data | On-chain event queries via `@mysten/sui` v2 |
| Hosting | Vercel (static SPA) |

## Quick Start

```bash
# Install
cd web && npm install
cd ../ts-scripts && npm install

# Configure
cp web/.env.example web/.env
cp ts-scripts/.env.example ts-scripts/.env
# Fill in STARLANE_PACKAGE_ID, TOLL_REGISTRY_ID, etc.

# Run
cd web && npm run dev
```

## Testnet Deployment

Current testnet deployment (2026-03-31):

```
Package ID:    0x18a83cf79e2c09bae31b233ac8456014bfd0d8196e0f4c0febcf4f6064d9de1d
TollRegistry:  0x6c8ac7ddc79c6f14f8ff0230ef07bb6f4e236a1a6c772c7c4589d228e2fb8b20
Live URL:      https://starlane.vercel.app
```

Run the full smoke test:

```bash
cd ts-scripts && npm run smoke
```

This exercises: gate creation, registration (both gates), fee update, jump permit purchase, and revenue withdrawal.

## Verification

```bash
cd contract && sui move test     # 15 Move tests
cd web && npm test               # 19 Vitest tests
cd web && npm run build          # TypeScript + Vite production build
cd ts-scripts && npm run typecheck
```

See [DEPLOY.md](DEPLOY.md) for full deployment instructions.
