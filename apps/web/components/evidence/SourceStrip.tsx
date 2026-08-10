export type SourceStripProps = {
  sourceName: string;
  retrievedAt: string;
  applicablePeriod: string;
  caveat: string;
};

export function SourceStrip(props: SourceStripProps) {
  return (
    <footer className="gc-source-strip">
      <p>
        출처 {props.sourceName} · 조회일 {props.retrievedAt} · 적용기간 {props.applicablePeriod}
      </p>
      <p>{props.caveat}</p>
    </footer>
  );
}
