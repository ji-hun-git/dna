export type UnitMark = { id: string; active: boolean; label: string };

export function UnitGrid({ units }: { units: readonly UnitMark[] }) {
  const active = units.filter((unit) => unit.active).length;

  return (
    <div
      role="img"
      aria-label={`${units.length}개 중 ${active}개`}
      className="gc-unit-grid"
    >
      {units.map((unit) => (
        <span
          key={unit.id}
          title={unit.label}
          className="gc-unit-grid__mark"
          data-active={unit.active}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
