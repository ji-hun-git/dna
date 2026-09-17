/** Deterministic, generated fixtures only. These bytes must be explicitly allowlisted by Spring.
 * Catalogue values mirror SyntheticCandidateFixture; this is not document extraction.
 */
export function buildSyntheticResultPdf(period: "2026-07" | "2026-01"): Uint8Array<ArrayBuffer> {
  const lines = period === "2026-07"
    ? ["GC SYNTHETIC EXAMPLE - NO REAL HEALTH DATA", "Date: 2026-07-28", "Cholesterol: 188 mg/dL", "HbA1c: 5.2 %", "Vitamin D: 42 ng/mL"]
    : ["GC SYNTHETIC EXAMPLE - NO REAL HEALTH DATA", "Date: 2026-01-15", "Cholesterol: 194 mg/dL", "HbA1c: 5.4 %", "Vitamin D: 45 ng/mL"];
  const content = `BT /F1 16 Tf 48 740 Td 28 TL ${lines.map((line, i) => `${i ? "T* " : ""}(${line}) Tj`).join("\n")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.7\n%GC-SYNTHETIC-ONLY\n";
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
