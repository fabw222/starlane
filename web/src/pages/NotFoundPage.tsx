import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="panel rounded-[2rem] p-8">
      <p className="tech-label">404 Signal Lost</p>
      <h1 className="display-font mt-4 text-4xl uppercase tracking-[0.18em] text-white">
        This route is not mapped to a gate
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-8 text-steel">
        The requested page does not exist in the current StarLane client router. Return to the
        registry surface to pick an indexed gate or open an operator workflow.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/" className="action-button">
          Back to gate index
        </Link>
        <Link to="/operator" className="ghost-button">
          Open operator deck
        </Link>
      </div>
    </section>
  );
}
