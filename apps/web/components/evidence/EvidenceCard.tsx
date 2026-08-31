import { useId } from "react";
import { SourceStrip, type SourceStripProps } from "./SourceStrip";
import { StatusLabel, type EvidenceStatus } from "./StatusLabel";
import { UnitGrid, type UnitMark } from "./UnitGrid";

export type EvidenceViewModel = SourceStripProps & {
  title: string;
  value: string;
  status: EvidenceStatus;
  units: readonly UnitMark[];
};

export function EvidenceCard(props: EvidenceViewModel) {
  const titleId = useId();

  return (
    <article className="gc-evidence-card" aria-labelledby={titleId}>
      <header className="gc-evidence-card__header">
        <h2 id={titleId} className="gc-evidence-card__title">
          {props.title}
        </h2>
        <StatusLabel status={props.status} />
      </header>
      <p className="gc-evidence-card__value">{props.value}</p>
      <UnitGrid units={props.units} />
      <SourceStrip
        sourceName={props.sourceName}
        retrievedAt={props.retrievedAt}
        applicablePeriod={props.applicablePeriod}
        caveat={props.caveat}
      />
    </article>
  );
}
