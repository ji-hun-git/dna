# LOINC audit — Wave 5 (2026-09-17/18)

Method: an earlier revision of this file (commit `c43d459`) reported that the automated WebFetch tool was refused by loinc.org with `HTTP 403 Forbidden` on 7 distinct codes, including one explicit retry on `2093-3` that failed the same way, and shipped every row as `R1` ("not fetched"). That attempt is not part of this audit's evidence; it is recorded only as the reason the method changed. For this revision, the controller instead opened `https://loinc.org/2093-3/` directly in the desktop app's built-in browser — a public page, no login, no cookie/consent banner accepted, nothing downloaded or submitted — and from there read every other candidate's public page at `https://loinc.org/<code>/` with a same-origin GET issued without credentials, sequentially with a pause between requests. Every request returned `HTTP 200`. The name recorded for each code is the page's `<title>`, which has the form "LOINC - LOINC `<code>` `<Long Common Name>`"; the Active/Deprecated status field on the rendered page was **not** captured for the batch reads, only for `2093-3` itself (seen as "Active"). Nothing in the tables below was filled from memory. Rules R0–R4 are defined in `docs/superpowers/plans/2026-09-17-wave5-concept-accuracy.md` Task 1. LOINC is informational metadata here: it is never used for matching and never implies a meaning.

Convention: blood-chemistry concepts default to a serum/plasma-specimen code (for example `total-cholesterol` → `2093-3` "... in Serum or Plasma") because Korean checkup sheets list these items in the blood panel, not because every fetched code was individually confirmed against the specimen printed on a sheet. Two labels are excluded from this default and instead resolve to no concept at all — the generic `glucose` and the `urine-protein`/`urine-glucose` pair's shared plain word "Protein" — because Korean checkup sheets print those exact words a second time as urine-strip rows (요단백/요당), where a serum-specimen code would be wrong; "Glucose" and "Protein" alone are therefore treated as specimen-ambiguous and carry no concept (catalogue test, `MedicalConceptCatalogueTest`), while `urine-protein`/`urine-glucose` themselves are matched only via their explicit "Urine"/요 aliases, not the bare word.

Where a candidate code turned out to be over-specific but a method-free/site-free code for the same analyte was also read and confirmed to fit, the concept's `loinc_code` is replaced; the 사유 column names the old code and the exact name fetched for it. Every `TRUE` row below was checked against the concept's `display_ko` and alias list in V7 (`apps/core-api/src/main/resources/db/migration/V7__native_text_extraction.sql`) and the Task 2 Kotlin catalogue proposal in the plan. Two rows raised by that check (`glucose` generic, `postprandial-glucose`) have since been decided by the coordinator; those decisions are recorded in the table and in "Decided flags" below, kept for the record rather than left open.

| concept_code | loinc_code | Long Common Name (as fetched) | URL | 확인일 | loinc_export | 사유 |
|---|---|---|---|---|---|---|
| glucose | NULL | Glucose [Mass/volume] in Serum or Plasma | https://loinc.org/2345-7/ | 2026-09-17/18 | FALSE | R0/R3 decided: a bare "혈당"/"Glucose" label does not state the specimen (the same word appears in urine sections), and 2345-7 as fetched says "in Serum or Plasma"; 2345-7 was considered and not used |
| bilirubin | NULL | not fetched | — | 2026-09-17/18 | FALSE | R0, generic, no code by design |
| gfr | NULL | not fetched | — | 2026-09-17/18 | FALSE | R0, generic, no code by design |
| total-cholesterol | 2093-3 | Cholesterol [Mass/volume] in Serum or Plasma | https://loinc.org/2093-3/ | 2026-09-17 | TRUE | R4, fits 총콜레스테롤/Cholesterol, no method/specimen mismatch |
| ldl-cholesterol | 2089-1 | Cholesterol in LDL [Mass/volume] in Serum or Plasma | https://loinc.org/2089-1/ | 2026-09-17/18 | TRUE | Replaced: old 13457-7 "Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation" is R3 (calculated LDL); 2089-1 is method-free and fits (R4) |
| hdl-cholesterol | 2085-9 | Cholesterol in HDL [Mass/volume] in Serum or Plasma | https://loinc.org/2085-9/ | 2026-09-17/18 | TRUE | R4, method-free, fits |
| triglycerides | 2571-8 | Triglyceride [Mass/volume] in Serum or Plasma | https://loinc.org/2571-8/ | 2026-09-17/18 | TRUE | R4, fits |
| fasting-glucose | 1558-6 | Fasting glucose [Mass/volume] in Serum or Plasma | https://loinc.org/1558-6/ | 2026-09-17/18 | TRUE | R4, fits once aliases narrowed to fasting-specific terms (FBS/FPG/식전혈당) |
| hba1c | 4548-4 | Hemoglobin A1c/Hemoglobin.total in Blood | https://loinc.org/4548-4/ | 2026-09-17/18 | TRUE | R4, fits HbA1c/A1c |
| ast | 1920-8 | Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma | https://loinc.org/1920-8/ | 2026-09-17/18 | TRUE | R4, fits |
| alt | 1742-6 | Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma | https://loinc.org/1742-6/ | 2026-09-17/18 | TRUE | R4, fits |
| gamma-gtp | 2324-2 | Gamma glutamyl transferase [Enzymatic activity/volume] in Serum or Plasma | https://loinc.org/2324-2/ | 2026-09-17/18 | TRUE | R4, fits |
| alp | 6768-6 | Alkaline phosphatase [Enzymatic activity/volume] in Serum or Plasma | https://loinc.org/6768-6/ | 2026-09-17/18 | TRUE | R4, fits |
| total-bilirubin | 1975-2 | Bilirubin.total [Mass/volume] in Serum or Plasma | https://loinc.org/1975-2/ | 2026-09-17/18 | TRUE | R4, fits once aliases narrowed off the generic "Bilirubin" |
| albumin | 1751-7 | Albumin [Mass/volume] in Serum or Plasma | https://loinc.org/1751-7/ | 2026-09-17/18 | TRUE | R4, fits |
| bun | 3094-0 | Urea nitrogen [Mass/volume] in Serum or Plasma | https://loinc.org/3094-0/ | 2026-09-17/18 | TRUE | R4, fits 혈중요소질소/Blood Urea Nitrogen |
| creatinine | 2160-0 | Creatinine [Mass/volume] in Serum or Plasma | https://loinc.org/2160-0/ | 2026-09-17/18 | TRUE | R4, fits |
| egfr | 62238-1 | Glomerular filtration rate [Volume Rate/Area] in Serum, Plasma or Blood by Creatinine-based formula (CKD-EPI)/1.73 sq M | https://loinc.org/62238-1/ | 2026-09-17/18 | FALSE | R3, named formula (CKD-EPI), keep code, no method-free replacement sought (spec pins this FALSE unconditionally) |
| uric-acid | 3084-1 | Urate [Mass/volume] in Serum or Plasma | https://loinc.org/3084-1/ | 2026-09-17/18 | TRUE | R4; "Urate" is LOINC's standard component name for the 요산/Uric Acid assay, not a different analyte |
| hemoglobin | 718-7 | Hemoglobin [Mass/volume] in Blood | https://loinc.org/718-7/ | 2026-09-17/18 | TRUE | R4, fits |
| red-blood-cells | 26453-1 | Erythrocytes [#/volume] in Blood | https://loinc.org/26453-1/ | 2026-09-17/18 | TRUE | Replaced: old 789-8 "Erythrocytes [#/volume] in Blood by Automated count" is R3 (method); 26453-1 is method-free and fits (R4) |
| white-blood-cells | 26464-8 | Leukocytes [#/volume] in Blood | https://loinc.org/26464-8/ | 2026-09-17/18 | TRUE | Replaced: old 6690-2 "Leukocytes [#/volume] in Blood by Automated count" is R3 (method); 26464-8 is method-free and fits (R4) |
| platelets | 26515-7 | Platelets [#/volume] in Blood | https://loinc.org/26515-7/ | 2026-09-17/18 | TRUE | Replaced: old 777-3 "Platelets [#/volume] in Blood by Automated count" is R3 (method); 26515-7 is method-free and fits (R4) |
| urine-protein | 2888-6 | Protein [Mass/volume] in Urine | https://loinc.org/2888-6/ | 2026-09-17/18 | TRUE | Replaced: old 5804-0 "Protein [Mass/volume] in Urine by Test strip" is R3 (method); 2888-6 is method-free and fits (R4). Qualitative strip results stay out of scope regardless |
| urine-glucose | 2350-7 | Glucose [Mass/volume] in Urine | https://loinc.org/2350-7/ | 2026-09-17/18 | TRUE | Replaced: old 5792-7 "Glucose [Mass/volume] in Urine by Test strip" is R3 (method); 2350-7 is method-free and fits (R4). Qualitative strip results stay out of scope regardless |
| systolic-blood-pressure | 8480-6 | Systolic blood pressure | https://loinc.org/8480-6/ | 2026-09-17/18 | TRUE | R4, fits |
| diastolic-blood-pressure | 8462-4 | Diastolic blood pressure | https://loinc.org/8462-4/ | 2026-09-17/18 | TRUE | R4, fits |
| pulse | 8867-4 | Heart rate | https://loinc.org/8867-4/ | 2026-09-17/18 | TRUE | R4; 맥박 lists 심박수/Heart Rate as aliases, fits |
| height | 8302-2 | Body height | https://loinc.org/8302-2/ | 2026-09-17/18 | TRUE | R4; 키/Height alias fits |
| weight | 29463-7 | Body weight | https://loinc.org/29463-7/ | 2026-09-17/18 | TRUE | R4, fits |
| bmi | 39156-5 | Body mass index (BMI) [Ratio] | https://loinc.org/39156-5/ | 2026-09-17/18 | TRUE | R4, fits |
| waist-circumference | 8280-0 | Waist Circumference at umbilicus by Tape measure | https://loinc.org/8280-0/ | 2026-09-17/18 | FALSE | R3, over-specific by site ("at umbilicus") and method ("by Tape measure"); keep code |
| vitamin-d | 1989-3 | 25-hydroxyvitamin D3 [Mass/volume] in Serum or Plasma | https://loinc.org/1989-3/ | 2026-09-17/18 | FALSE | R3, D3 only; the only other readable candidate, 62292-8 "25-Hydroxyvitamin D3+25-Hydroxyvitamin D2 [Mass/volume] in Serum or Plasma", is a specific named sum and not usable either; keep 1989-3 (spec pins this FALSE unconditionally) |
| tsh | 3016-3 | Thyrotropin [Units/volume] in Serum or Plasma | https://loinc.org/3016-3/ | 2026-09-17/18 | TRUE | R4; "Thyrotropin" is the standard LOINC synonym for TSH |
| free-t4 | 3024-7 | Thyroxine (T4) free [Mass/volume] in Serum or Plasma | https://loinc.org/3024-7/ | 2026-09-17/18 | TRUE | R4, fits FT4 |
| crp | 1988-5 | C reactive protein [Mass/volume] in Serum or Plasma | https://loinc.org/1988-5/ | 2026-09-17/18 | TRUE | R4, fits once aliases narrow off hs-CRP |
| ferritin | 2276-4 | Ferritin [Mass/volume] in Serum or Plasma | https://loinc.org/2276-4/ | 2026-09-17/18 | TRUE | R4, fits |
| sodium | 2951-2 | Sodium [Moles/volume] in Serum or Plasma | https://loinc.org/2951-2/ | 2026-09-17/18 | TRUE | R4, fits |
| potassium | 2823-3 | Potassium [Moles/volume] in Serum or Plasma | https://loinc.org/2823-3/ | 2026-09-17/18 | TRUE | R4, fits |
| calcium | 17861-6 | Calcium [Mass/volume] in Serum or Plasma | https://loinc.org/17861-6/ | 2026-09-17/18 | TRUE | R4, fits |
| total-protein | 2885-2 | Protein [Mass/volume] in Serum or Plasma | https://loinc.org/2885-2/ | 2026-09-17/18 | TRUE | R4, fits |
| postprandial-glucose | NULL | Glucose [Mass/volume] in Serum or Plasma --2 hours post meal | https://loinc.org/1521-4/ | 2026-09-17/18 | FALSE | R3 decided: the concept also accepts labels with no time stated (its display name 식후혈당 and the alias "Postprandial Glucose"), and 1521-4 as fetched says "--2 hours post meal", so the code is more specific than some labels that map to the concept |
| direct-bilirubin | 1968-7 | Bilirubin.direct [Mass/volume] in Serum or Plasma | https://loinc.org/1968-7/ | 2026-09-17/18 | TRUE | R4, fits Direct Bilirubin/D-Bil |
| hs-crp | 30522-7 | C reactive protein [Mass/volume] in Serum or Plasma by High sensitivity method | https://loinc.org/30522-7/ | 2026-09-17/18 | TRUE | R4; the concept itself (고감도 CRP / hs-CRP) is defined as the high-sensitivity method, so the method wording matches the concept, not more specific than its own label |
| hematocrit | NULL | Hematocrit [Volume Fraction] of Blood by Automated count | https://loinc.org/4544-3/ | 2026-09-17/18 | FALSE | R3 (proposed code 4544-3 not adopted), method; the only other candidate read, 20570-8 "Hematocrit [Volume Fraction] of Blood by calculation", is also method-specific and not usable |
| mcv | 30428-7 | MCV [Entitic mean volume] in Red Blood Cells | https://loinc.org/30428-7/ | 2026-09-17/18 | TRUE | Replaced: proposed 787-2 "MCV [Entitic mean volume] in Red Blood Cells by Automated count" is R3 (method); 30428-7 is method-free and fits (R4) |
| mch | 28539-5 | MCH [Entitic mass] | https://loinc.org/28539-5/ | 2026-09-17/18 | TRUE | Replaced: proposed 785-6 "MCH [Entitic mass] by Automated count" is R3 (method); 28539-5 is method-free and fits (R4) |
| mchc | 28540-3 | MCHC [Entitic Mass/volume] in Red Blood Cells | https://loinc.org/28540-3/ | 2026-09-17/18 | TRUE | Replaced: proposed 786-4 "MCHC [Entitic Mass/volume] in Red Blood Cells by Automated count" is R3 (method); 28540-3 is method-free and fits (R4) |
| chloride | 2075-0 | Chloride [Moles/volume] in Serum or Plasma | https://loinc.org/2075-0/ | 2026-09-17/18 | TRUE | R4, fits |
| phosphorus | 2777-1 | Phosphate [Mass/volume] in Serum or Plasma | https://loinc.org/2777-1/ | 2026-09-17/18 | TRUE | R4; "Phosphate" is the standard LOINC component name for the 인(P)/phosphorus assay, not a different analyte |
| magnesium | 19123-9 | Magnesium [Mass/volume] in Serum or Plasma | https://loinc.org/19123-9/ | 2026-09-17/18 | TRUE | R4, fits |
| iron | 2498-4 | Iron [Mass/volume] in Serum or Plasma | https://loinc.org/2498-4/ | 2026-09-17/18 | TRUE | R4, fits 혈청철/Serum Iron |
| tibc | 2500-7 | Iron binding capacity [Mass/volume] in Serum or Plasma | https://loinc.org/2500-7/ | 2026-09-17/18 | TRUE | R4, fits Total Iron Binding Capacity |
| vitamin-b12 | 2132-9 | Cobalamin (Vitamin B12) [Mass/volume] in Serum or Plasma | https://loinc.org/2132-9/ | 2026-09-17/18 | TRUE | R4, fits |
| folate | 2284-8 | Folate [Mass/volume] in Serum or Plasma | https://loinc.org/2284-8/ | 2026-09-17/18 | TRUE | R4, fits |
| esr | 30341-2 | Erythrocyte [Sedimentation Rate] in Blood | https://loinc.org/30341-2/ | 2026-09-17/18 | TRUE | R4, method-free (no "by Westergren" or similar), fits |
| ldh | 2532-0 | Lactate dehydrogenase [Enzymatic activity/volume] in Serum or Plasma | https://loinc.org/2532-0/ | 2026-09-17/18 | TRUE | R4, fits |
| amylase | 1798-8 | Amylase [Enzymatic activity/volume] in Serum or Plasma | https://loinc.org/1798-8/ | 2026-09-17/18 | TRUE | R4, fits |
| ck | 2157-6 | Creatine kinase [Enzymatic activity/volume] in Serum or Plasma | https://loinc.org/2157-6/ | 2026-09-17/18 | TRUE | R4, fits |
| free-t3 | 3051-0 | Triiodothyronine (T3) Free [Mass/volume] in Serum or Plasma | https://loinc.org/3051-0/ | 2026-09-17/18 | TRUE | R4, fits |
| t3 | 3053-6 | Triiodothyronine (T3) [Mass/volume] in Serum or Plasma | https://loinc.org/3053-6/ | 2026-09-17/18 | TRUE | R4, fits |
| non-hdl-cholesterol | 43396-1 | Cholesterol non HDL [Mass/volume] in Serum or Plasma | https://loinc.org/43396-1/ | 2026-09-17/18 | TRUE | R4, fits |
| insulin | 20448-7 | Insulin [Units/volume] in Serum or Plasma | https://loinc.org/20448-7/ | 2026-09-17/18 | TRUE | R4, fits |
| afp | 1834-1 | Alpha-1-Fetoprotein [Mass/volume] in Serum or Plasma | https://loinc.org/1834-1/ | 2026-09-17/18 | TRUE | R4, fits AFP |
| cea | 2039-6 | Carcinoembryonic Ag [Mass/volume] in Serum or Plasma | https://loinc.org/2039-6/ | 2026-09-17/18 | TRUE | R4, fits |
| psa | 2857-1 | Prostate specific Ag [Mass/volume] in Serum or Plasma | https://loinc.org/2857-1/ | 2026-09-17/18 | TRUE | R4, fits (generic/total PSA, not the free-PSA-specific code) |
| ca19-9 | 24108-3 | Cancer Ag 19-9 [Units/volume] in Serum or Plasma | https://loinc.org/24108-3/ | 2026-09-17/18 | TRUE | R4, fits |
| ca125 | 10334-1 | Cancer Ag 125 [Units/volume] in Serum or Plasma | https://loinc.org/10334-1/ | 2026-09-17/18 | TRUE | R4, fits |
| rf | 11572-5 | Rheumatoid factor [Units/volume] in Serum or Plasma | https://loinc.org/11572-5/ | 2026-09-17/18 | TRUE | R4, fits |

## Decided flags (previously doubtful, now resolved)

- **`glucose` (generic) → `NULL`, `FALSE` (decided).** An earlier pass of this file flagged that assigning `2345-7`/`TRUE` here would conflict with the Task 1 brief's R0 and spec §5, which state generic concepts (`glucose`, `bilirubin`, `gfr`) have no LOINC unconditionally, and with the plan's own Task 2 line 347–348 comment ("generic concepts for labels that do not say which specific test they are. No LOINC"). The coordinator confirmed the flag was correct: a bare "혈당"/"Glucose" label does not state the specimen (the same word appears in urine sections of a result sheet), while `2345-7` as fetched says "in Serum or Plasma" — more specific than the generic label. Decided: `loinc_code = NULL`, `loinc_export = FALSE`; `2345-7` is recorded in the row as the code that was considered and not used.
- **`postprandial-glucose` → `NULL`, `FALSE` (decided, stays as originally written).** An earlier pass flagged that the concept's own aliases (`식후 2시간 혈당`, `2hr PP`) already carry the same 2-hour specificity as the fetched code (`1521-4`, "--2 hours post meal"), so R3's "more specific than every label" test seemed not to obviously apply. The coordinator resolved this the other way: the concept *also* accepts labels with no time stated at all — its display name `식후혈당` and the alias `Postprandial Glucose` — so `1521-4` is more specific than *some* of the labels that map to this concept, which is enough to trigger R3. Decided: stays `NULL`/`FALSE`.
- **`phosphorus` → `2777-1`, `TRUE` (minor terminology note, not a blocking doubt).** The fetched Long Common Name uses the LOINC component "Phosphate", while the concept is named "phosphorus" (인, aliases include "Inorganic Phosphorus"). This is standard clinical-chemistry terminology — a serum "phosphorus" test measures inorganic phosphate and LOINC's component name for it is conventionally "Phosphate" — not a different analyte, so `TRUE` stands, but it is called out here since the wording does differ from the concept's own aliases.
- **`uric-acid` → `3084-1`, `TRUE` (minor terminology note, not a blocking doubt).** The fetched name is "Urate", the concept's aliases say "Uric Acid"/"UA". "Urate" is LOINC's standard component name for this assay (uric acid is measured as urate); not flagged as a mismatch, but noted since the string differs from the concept's own aliases.

## Final values

| concept_code | loinc_code | loinc_export |
|---|---|---|
| glucose | NULL | FALSE |
| bilirubin | NULL | FALSE |
| gfr | NULL | FALSE |
| total-cholesterol | 2093-3 | TRUE |
| ldl-cholesterol | 2089-1 | TRUE |
| hdl-cholesterol | 2085-9 | TRUE |
| triglycerides | 2571-8 | TRUE |
| fasting-glucose | 1558-6 | TRUE |
| hba1c | 4548-4 | TRUE |
| ast | 1920-8 | TRUE |
| alt | 1742-6 | TRUE |
| gamma-gtp | 2324-2 | TRUE |
| alp | 6768-6 | TRUE |
| total-bilirubin | 1975-2 | TRUE |
| albumin | 1751-7 | TRUE |
| bun | 3094-0 | TRUE |
| creatinine | 2160-0 | TRUE |
| egfr | 62238-1 | FALSE |
| uric-acid | 3084-1 | TRUE |
| hemoglobin | 718-7 | TRUE |
| red-blood-cells | 26453-1 | TRUE |
| white-blood-cells | 26464-8 | TRUE |
| platelets | 26515-7 | TRUE |
| urine-protein | 2888-6 | TRUE |
| urine-glucose | 2350-7 | TRUE |
| systolic-blood-pressure | 8480-6 | TRUE |
| diastolic-blood-pressure | 8462-4 | TRUE |
| pulse | 8867-4 | TRUE |
| height | 8302-2 | TRUE |
| weight | 29463-7 | TRUE |
| bmi | 39156-5 | TRUE |
| waist-circumference | 8280-0 | FALSE |
| vitamin-d | 1989-3 | FALSE |
| tsh | 3016-3 | TRUE |
| free-t4 | 3024-7 | TRUE |
| crp | 1988-5 | TRUE |
| ferritin | 2276-4 | TRUE |
| sodium | 2951-2 | TRUE |
| potassium | 2823-3 | TRUE |
| calcium | 17861-6 | TRUE |
| total-protein | 2885-2 | TRUE |
| postprandial-glucose | NULL | FALSE |
| direct-bilirubin | 1968-7 | TRUE |
| hs-crp | 30522-7 | TRUE |
| hematocrit | NULL | FALSE |
| mcv | 30428-7 | TRUE |
| mch | 28539-5 | TRUE |
| mchc | 28540-3 | TRUE |
| chloride | 2075-0 | TRUE |
| phosphorus | 2777-1 | TRUE |
| magnesium | 19123-9 | TRUE |
| iron | 2498-4 | TRUE |
| tibc | 2500-7 | TRUE |
| vitamin-b12 | 2132-9 | TRUE |
| folate | 2284-8 | TRUE |
| esr | 30341-2 | TRUE |
| ldh | 2532-0 | TRUE |
| amylase | 1798-8 | TRUE |
| ck | 2157-6 | TRUE |
| free-t3 | 3051-0 | TRUE |
| t3 | 3053-6 | TRUE |
| non-hdl-cholesterol | 43396-1 | TRUE |
| insulin | 20448-7 | TRUE |
| afp | 1834-1 | TRUE |
| cea | 2039-6 | TRUE |
| psa | 2857-1 | TRUE |
| ca19-9 | 24108-3 | TRUE |
| ca125 | 10334-1 | TRUE |
| rf | 11572-5 | TRUE |

## Limits

The serum/plasma-by-default convention above has a residual gap: only the two labels that are printed verbatim on both a blood and a urine row (Glucose/Protein) are excluded. A chemistry label that is unambiguous on a blood sheet but could in principle also be printed in a urine section — for example `Cr` (creatinine), `Na` (sodium), `Ca` (calcium), or `UA` (uric acid) — is not excluded by this audit or by the catalogue, and such a label printed in a urine section of a result sheet would still map to the blood concept and carry its serum/plasma LOINC coding. No corpus document currently exercises this case.

## Plan values superseded by the audit

Task 2 (`docs/superpowers/plans/2026-09-17-wave5-concept-accuracy.md`, Kotlin `MedicalConceptCatalogue.entries` proposal) and Task 3 (same file, `V11__concept_accuracy.sql` proposal) both say explicitly that their `loinc`/`loinc_code`/`loinc_export` values are a proposal to be replaced with this file's `## Final values`. The lines below are the ones that differ from what the audit found; every other line in those proposals already matches this file.

| Task | Line | Concept | Old (plan) | Audited (this file) |
|---|---|---|---|---|
| Task 2 | 310 | ldl-cholesterol | `"13457-7", false` | `"2089-1", TRUE` |
| Task 2 | 326 | red-blood-cells | `"789-8", true` | `"26453-1", TRUE` |
| Task 2 | 327 | white-blood-cells | `"6690-2", true` | `"26464-8", TRUE` |
| Task 2 | 328 | platelets | `"777-3", true` | `"26515-7", TRUE` |
| Task 2 | 329 | urine-protein | `"5804-0", true` | `"2888-6", TRUE` |
| Task 2 | 330 | urine-glucose | `"5792-7", true` | `"2350-7", TRUE` |
| Task 2 | 348 | glucose (generic) | `null, false` | `NULL, FALSE` — unchanged; the plan's proposal already matched the audited (decided) value, confirming R0/spec §5 |
| Task 2 | 352 | postprandial-glucose | `"1521-4", true` | `NULL, FALSE` — decided, see "Decided flags" |
| Task 2 | 356 | hematocrit | `"4544-3", true` | `NULL, FALSE` |
| Task 2 | 357 | mcv | `"787-2", true` | `"30428-7", TRUE` |
| Task 2 | 358 | mch | `"785-6", true` | `"28539-5", TRUE` |
| Task 2 | 359 | mchc | `"786-4", true` | `"28540-3", TRUE` |
| Task 3 | 624 | ldl-cholesterol | `UPDATE ... loinc_export = FALSE WHERE concept_code IN ('ldl-cholesterol', 'vitamin-d', 'egfr')` | Drop `ldl-cholesterol` from this list (now `TRUE` with code `2089-1`); keep `vitamin-d` and `egfr` in the `FALSE` list unchanged |
| Task 3 | 630 | postprandial-glucose | `'1521-4', ..., TRUE` | `NULL, FALSE` — decided, see "Decided flags" |
| Task 3 | 633 | hematocrit | `'4544-3', ..., TRUE` | `NULL, FALSE` |
| Task 3 | 634 | mcv | `'787-2', ..., TRUE` | `'30428-7', TRUE` |
| Task 3 | 635 | mch | `'785-6', ..., TRUE` | `'28539-5', TRUE` |
| Task 3 | 636 | mchc | `'786-4', ..., TRUE` | `'28540-3', TRUE` |

Later implementers (Tasks 2–4) should take this file's `## Final values` table as the source of truth over the plan's inline proposal values, per the plan's own instruction. All flags raised during this audit are now decided (see "Decided flags"); none remain open.
