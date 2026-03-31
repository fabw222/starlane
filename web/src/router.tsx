import { Suspense, lazy, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { HomePage } from "./pages/HomePage";

const GateDetailPage = lazy(async () => {
  const module = await import("./pages/GateDetailPage");
  return { default: module.GateDetailPage };
});

const JumpPage = lazy(async () => {
  const module = await import("./pages/JumpPage");
  return { default: module.JumpPage };
});

const OperatorPage = lazy(async () => {
  const module = await import("./pages/OperatorPage");
  return { default: module.OperatorPage };
});

const NotFoundPage = lazy(async () => {
  const module = await import("./pages/NotFoundPage");
  return { default: module.NotFoundPage };
});

function withRouteFallback(node: ReactNode, message: string) {
  return (
    <Suspense fallback={<p className="text-sm text-steel">{message}</p>}>
      {node}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "gates/:gateId",
        element: withRouteFallback(<GateDetailPage />, "Loading gate telemetry…")
      },
      {
        path: "jump",
        element: withRouteFallback(<JumpPage />, "Loading jump console…")
      },
      {
        path: "operator",
        element: withRouteFallback(<OperatorPage />, "Loading operator deck…")
      },
      {
        path: "*",
        element: withRouteFallback(<NotFoundPage />, "Loading route…")
      }
    ]
  }
]);
