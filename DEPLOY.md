# StarLane Deployment Guide

## Prerequisites

- Node.js 20+
- npm 10+
- Sui CLI configured for `testnet`
- A funded operator account on Sui testnet
- A funded player account on Sui testnet

## 1. Build And Test Move

```bash
cd contract
sui move test
sui move build
```

## 2. Publish The Move Package

Publish from [`contract/`](contract/).

```bash
cd contract
sui client test-publish --gas-budget 200000000 --build-env testnet --with-unpublished-dependencies
```

This publishes both `world_contracts` (compat layer) and `starlane` as a single package.

Record from the publish output:

- published `PackageID` (same for both WORLD and STARLANE since they are a single package)
- created shared `TollRegistry` object ID

The validated testnet deployment (v2, typed witness pattern) from `2026-03-20` used the following IDs.
Treat them as historical reference only: they change on every re-publish and must not be copied blindly into a new deployment.

- `WORLD_PACKAGE_ID=0x367beee0d267f3998014fc9ec0d655010c45beebac666951a40d50811f6fe5d4`
- `STARLANE_PACKAGE_ID=0x367beee0d267f3998014fc9ec0d655010c45beebac666951a40d50811f6fe5d4`
- `TOLL_REGISTRY_ID=0x2316fdda896feb428992233dcb91cf5605cdaaa7106e93f34cbac3fef7908ac1`

## 3. Configure The Web App

Create `web/.env` and fill:

```bash
VITE_SUI_NETWORK="testnet"
VITE_STARLANE_PACKAGE_ID="<package-id>"
VITE_WORLD_PACKAGE_ID="<world-package-id>"
VITE_TOLL_REGISTRY_ID="<registry-id>"
```

Install and build:

```bash
cd web
npm install
npm test
npm run build
```

## 4. Deploy The Vite SPA

The web app is now a static Vite SPA that reads StarLane data directly from on-chain events.
Deploy the built `web/dist/` directory to your static host of choice.

For Vercel deployments rooted at `web/`, the repository includes [`web/vercel.json`](web/vercel.json)
to rewrite application routes back to `index.html`, including a final catch-all for future routes:

- `/operator`
- `/jump`
- `/gates/:gateId`

If you deploy somewhere other than Vercel, add the equivalent SPA fallback rule there
(for example Netlify `_redirects`, nginx `try_files`, Cloudflare static rewrites, etc.).

To verify the production bundle locally:

```bash
cd web
npm run preview
```

## 5. Configure Testnet Scripts

Copy [`ts-scripts/.env.example`](ts-scripts/.env.example) to `ts-scripts/.env`.

Required minimum values:

```bash
SUI_NETWORK="testnet"
WORLD_PACKAGE_ID="<world-package-id>"
STARLANE_PACKAGE_ID="<package-id>"
TOLL_REGISTRY_ID="<registry-id>"
OPERATOR_KEY="suiprivkey..."
PLAYER_KEY="suiprivkey..."
```

Optional values:

- `SOURCE_GATE_ID`
- `DEST_GATE_ID`
- `CHARACTER_ID`
- `OPERATOR_CAP_ID`
- `GATE_OWNER_CAP_ID`
- `SOURCE_OWNER_CAP_ID`
- `DEST_OWNER_CAP_ID`

If those asset IDs are empty, the smoke test will create the minimum `Gate` and `Character` objects it needs.

## 6. Start The Web App

```bash
cd web
npm run dev
```

Pages:

- `/`
- `/operator`
- `/jump`
- `/gates/[id]`

## 7. Run The Smoke Test

```bash
cd ts-scripts
npm install
npm run smoke
```

Expected output:

- asset IDs
- `registerSourceTxDigest`
- `registerDestTxDigest`
- `feeUpdateTxDigest`
- `buyTxDigest`
- `withdrawTxDigest`

## 8. Optional: Set The In-Game Assembly URL

If you want an EVE Frontier Smart Assembly to open the deployed app in the in-game browser, run:

```bash
cd ts-scripts
npx tsx set-assembly-url.ts --assembly <ASSEMBLY_ID> --character <CHARACTER_ID> --ownercap <OWNER_CAP_ID> --url <APP_URL>
```

The script resolves the latest OwnerCap object ref before building the `borrow_owner_cap` call.

## 9. Verification Checklist

Before calling the deployment ready, run:

```bash
cd contract && sui move test
cd web && npm test
cd web && npm run build
cd ts-scripts && npm run typecheck
cd ts-scripts && npm run smoke
```

Latest confirmed smoke digests on testnet from the `2026-03-20` validation run (historical reference only; re-running the flow will produce different digests):

- `registerSourceTxDigest=13Lx56aVztKXkYPAjVv6PjuWgj8QPWDkP1EHzi1uArRK`
- `registerDestTxDigest=EKYZCza4HyPjpViuT7JN6yBBXABF2PoNkVXK9oSayfrx`
- `feeUpdateTxDigest=DMVdTRXcSAnHNf4Y3oQG7s5M1b1dUcqVgLoZ59dLA5r9`
- `buyTxDigest=Fhi1xTeCE5Keg6ijmTaBwiSMoi5WN2WoUxzmnUzdy4pY`
- `withdrawTxDigest=2san9VbyuGqwRFuiQCgy6VsW7WPRGGC5jsnim8qvBMi1`
