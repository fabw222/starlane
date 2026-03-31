export function StatCard({
  label,
  value,
  note
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <article className="panel rounded-[1.6rem] p-5">
      <p className="tech-label">{label}</p>
      <p className="display-font mt-3 text-3xl text-white">{value}</p>
      {note ? <p className="mt-2 text-sm text-steel">{note}</p> : null}
    </article>
  );
}
