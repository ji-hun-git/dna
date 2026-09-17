# LOINC audit — Wave 5 (2026-09-17)

Method: each code's public page `https://loinc.org/<code>/` was read (HTTP GET, no login, no download, no terms acceptance). The Long Common Name is copied exactly as the page showed it on the date given. Nothing in this table was filled from memory; a page that could not be read says "not fetched". Rules R0–R4 are defined in `docs/superpowers/plans/2026-09-17-wave5-concept-accuracy.md` Task 1. LOINC is informational metadata here: it is never used for matching and never implies a meaning.

**Blocked-fetch note:** every attempt to read `https://loinc.org/<code>/` via the WebFetch tool returned `HTTP 403 Forbidden`, with no response body retrieved. This was verified on 7 distinct codes across the candidate list before concluding the block was systematic and not code-specific: `2093-3` (fetched twice, including one explicit retry — same 403 both times), `13457-7`, `2085-9`, `2571-8`, `1558-6`, `4548-4`, `718-7`. No other tool, curl invocation, cached copy, or memory recall was substituted for the blocked pages, per the binding instruction not to substitute another source silently. Consequently **no LOINC page in this candidate list was actually read**, and every row below is `R1` ("not fetched"), regardless of whether the code was tried individually. All 66 non-generic codes are treated as unverified; the 3 generic concepts are `R0` (never fetched by design, no code exists to fetch).

| concept_code | loinc_code | Long Common Name (as fetched) | URL | 확인일 | loinc_export | 사유 |
|---|---|---|---|---|---|---|
| glucose | NULL | not fetched | — | 2026-09-17 | FALSE | R0 |
| bilirubin | NULL | not fetched | — | 2026-09-17 | FALSE | R0 |
| gfr | NULL | not fetched | — | 2026-09-17 | FALSE | R0 |
| total-cholesterol | 2093-3 | not fetched | https://loinc.org/2093-3/ | 2026-09-17 | FALSE | R1 |
| ldl-cholesterol | 13457-7 | not fetched | https://loinc.org/13457-7/ | 2026-09-17 | FALSE | R1 |
| hdl-cholesterol | 2085-9 | not fetched | https://loinc.org/2085-9/ | 2026-09-17 | FALSE | R1 |
| triglycerides | 2571-8 | not fetched | https://loinc.org/2571-8/ | 2026-09-17 | FALSE | R1 |
| fasting-glucose | 1558-6 | not fetched | https://loinc.org/1558-6/ | 2026-09-17 | FALSE | R1 |
| hba1c | 4548-4 | not fetched | https://loinc.org/4548-4/ | 2026-09-17 | FALSE | R1 |
| ast | 1920-8 | not fetched | https://loinc.org/1920-8/ | 2026-09-17 | FALSE | R1 |
| alt | 1742-6 | not fetched | https://loinc.org/1742-6/ | 2026-09-17 | FALSE | R1 |
| gamma-gtp | 2324-2 | not fetched | https://loinc.org/2324-2/ | 2026-09-17 | FALSE | R1 |
| alp | 6768-6 | not fetched | https://loinc.org/6768-6/ | 2026-09-17 | FALSE | R1 |
| total-bilirubin | 1975-2 | not fetched | https://loinc.org/1975-2/ | 2026-09-17 | FALSE | R1 |
| albumin | 1751-7 | not fetched | https://loinc.org/1751-7/ | 2026-09-17 | FALSE | R1 |
| bun | 3094-0 | not fetched | https://loinc.org/3094-0/ | 2026-09-17 | FALSE | R1 |
| creatinine | 2160-0 | not fetched | https://loinc.org/2160-0/ | 2026-09-17 | FALSE | R1 |
| egfr | 62238-1 | not fetched | https://loinc.org/62238-1/ | 2026-09-17 | FALSE | R1 |
| uric-acid | 3084-1 | not fetched | https://loinc.org/3084-1/ | 2026-09-17 | FALSE | R1 |
| hemoglobin | 718-7 | not fetched | https://loinc.org/718-7/ | 2026-09-17 | FALSE | R1 |
| red-blood-cells | 789-8 | not fetched | https://loinc.org/789-8/ | 2026-09-17 | FALSE | R1 |
| white-blood-cells | 6690-2 | not fetched | https://loinc.org/6690-2/ | 2026-09-17 | FALSE | R1 |
| platelets | 777-3 | not fetched | https://loinc.org/777-3/ | 2026-09-17 | FALSE | R1 |
| urine-protein | 5804-0 | not fetched | https://loinc.org/5804-0/ | 2026-09-17 | FALSE | R1 |
| urine-glucose | 5792-7 | not fetched | https://loinc.org/5792-7/ | 2026-09-17 | FALSE | R1 |
| systolic-blood-pressure | 8480-6 | not fetched | https://loinc.org/8480-6/ | 2026-09-17 | FALSE | R1 |
| diastolic-blood-pressure | 8462-4 | not fetched | https://loinc.org/8462-4/ | 2026-09-17 | FALSE | R1 |
| pulse | 8867-4 | not fetched | https://loinc.org/8867-4/ | 2026-09-17 | FALSE | R1 |
| height | 8302-2 | not fetched | https://loinc.org/8302-2/ | 2026-09-17 | FALSE | R1 |
| weight | 29463-7 | not fetched | https://loinc.org/29463-7/ | 2026-09-17 | FALSE | R1 |
| bmi | 39156-5 | not fetched | https://loinc.org/39156-5/ | 2026-09-17 | FALSE | R1 |
| waist-circumference | 8280-0 | not fetched | https://loinc.org/8280-0/ | 2026-09-17 | FALSE | R1 |
| vitamin-d | 1989-3 | not fetched | https://loinc.org/1989-3/ | 2026-09-17 | FALSE | R1 |
| tsh | 3016-3 | not fetched | https://loinc.org/3016-3/ | 2026-09-17 | FALSE | R1 |
| free-t4 | 3024-7 | not fetched | https://loinc.org/3024-7/ | 2026-09-17 | FALSE | R1 |
| crp | 1988-5 | not fetched | https://loinc.org/1988-5/ | 2026-09-17 | FALSE | R1 |
| ferritin | 2276-4 | not fetched | https://loinc.org/2276-4/ | 2026-09-17 | FALSE | R1 |
| sodium | 2951-2 | not fetched | https://loinc.org/2951-2/ | 2026-09-17 | FALSE | R1 |
| potassium | 2823-3 | not fetched | https://loinc.org/2823-3/ | 2026-09-17 | FALSE | R1 |
| calcium | 17861-6 | not fetched | https://loinc.org/17861-6/ | 2026-09-17 | FALSE | R1 |
| total-protein | 2885-2 | not fetched | https://loinc.org/2885-2/ | 2026-09-17 | FALSE | R1 |
| postprandial-glucose | NULL | not fetched | https://loinc.org/1521-4/ | 2026-09-17 | FALSE | R1 |
| direct-bilirubin | NULL | not fetched | https://loinc.org/1968-7/ | 2026-09-17 | FALSE | R1 |
| hs-crp | NULL | not fetched | https://loinc.org/30522-7/ | 2026-09-17 | FALSE | R1 |
| hematocrit | NULL | not fetched | https://loinc.org/4544-3/ | 2026-09-17 | FALSE | R1 |
| mcv | NULL | not fetched | https://loinc.org/787-2/ | 2026-09-17 | FALSE | R1 |
| mch | NULL | not fetched | https://loinc.org/785-6/ | 2026-09-17 | FALSE | R1 |
| mchc | NULL | not fetched | https://loinc.org/786-4/ | 2026-09-17 | FALSE | R1 |
| chloride | NULL | not fetched | https://loinc.org/2075-0/ | 2026-09-17 | FALSE | R1 |
| phosphorus | NULL | not fetched | https://loinc.org/2777-1/ | 2026-09-17 | FALSE | R1 |
| magnesium | NULL | not fetched | https://loinc.org/19123-9/ | 2026-09-17 | FALSE | R1 |
| iron | NULL | not fetched | https://loinc.org/2498-4/ | 2026-09-17 | FALSE | R1 |
| tibc | NULL | not fetched | https://loinc.org/2500-7/ | 2026-09-17 | FALSE | R1 |
| vitamin-b12 | NULL | not fetched | https://loinc.org/2132-9/ | 2026-09-17 | FALSE | R1 |
| folate | NULL | not fetched | https://loinc.org/2284-8/ | 2026-09-17 | FALSE | R1 |
| esr | NULL | not fetched | https://loinc.org/30341-2/ | 2026-09-17 | FALSE | R1 |
| ldh | NULL | not fetched | https://loinc.org/2532-0/ | 2026-09-17 | FALSE | R1 |
| amylase | NULL | not fetched | https://loinc.org/1798-8/ | 2026-09-17 | FALSE | R1 |
| ck | NULL | not fetched | https://loinc.org/2157-6/ | 2026-09-17 | FALSE | R1 |
| free-t3 | NULL | not fetched | https://loinc.org/3051-0/ | 2026-09-17 | FALSE | R1 |
| t3 | NULL | not fetched | https://loinc.org/3053-6/ | 2026-09-17 | FALSE | R1 |
| non-hdl-cholesterol | NULL | not fetched | https://loinc.org/43396-1/ | 2026-09-17 | FALSE | R1 |
| insulin | NULL | not fetched | https://loinc.org/20448-7/ | 2026-09-17 | FALSE | R1 |
| afp | NULL | not fetched | https://loinc.org/1834-1/ | 2026-09-17 | FALSE | R1 |
| cea | NULL | not fetched | https://loinc.org/2039-6/ | 2026-09-17 | FALSE | R1 |
| psa | NULL | not fetched | https://loinc.org/2857-1/ | 2026-09-17 | FALSE | R1 |
| ca19-9 | NULL | not fetched | https://loinc.org/24108-3/ | 2026-09-17 | FALSE | R1 |
| ca125 | NULL | not fetched | https://loinc.org/10334-1/ | 2026-09-17 | FALSE | R1 |
| rf | NULL | not fetched | https://loinc.org/11572-5/ | 2026-09-17 | FALSE | R1 |

## Final values

| concept_code | loinc_code | loinc_export |
|---|---|---|
| glucose | NULL | FALSE |
| bilirubin | NULL | FALSE |
| gfr | NULL | FALSE |
| total-cholesterol | 2093-3 | FALSE |
| ldl-cholesterol | 13457-7 | FALSE |
| hdl-cholesterol | 2085-9 | FALSE |
| triglycerides | 2571-8 | FALSE |
| fasting-glucose | 1558-6 | FALSE |
| hba1c | 4548-4 | FALSE |
| ast | 1920-8 | FALSE |
| alt | 1742-6 | FALSE |
| gamma-gtp | 2324-2 | FALSE |
| alp | 6768-6 | FALSE |
| total-bilirubin | 1975-2 | FALSE |
| albumin | 1751-7 | FALSE |
| bun | 3094-0 | FALSE |
| creatinine | 2160-0 | FALSE |
| egfr | 62238-1 | FALSE |
| uric-acid | 3084-1 | FALSE |
| hemoglobin | 718-7 | FALSE |
| red-blood-cells | 789-8 | FALSE |
| white-blood-cells | 6690-2 | FALSE |
| platelets | 777-3 | FALSE |
| urine-protein | 5804-0 | FALSE |
| urine-glucose | 5792-7 | FALSE |
| systolic-blood-pressure | 8480-6 | FALSE |
| diastolic-blood-pressure | 8462-4 | FALSE |
| pulse | 8867-4 | FALSE |
| height | 8302-2 | FALSE |
| weight | 29463-7 | FALSE |
| bmi | 39156-5 | FALSE |
| waist-circumference | 8280-0 | FALSE |
| vitamin-d | 1989-3 | FALSE |
| tsh | 3016-3 | FALSE |
| free-t4 | 3024-7 | FALSE |
| crp | 1988-5 | FALSE |
| ferritin | 2276-4 | FALSE |
| sodium | 2951-2 | FALSE |
| potassium | 2823-3 | FALSE |
| calcium | 17861-6 | FALSE |
| total-protein | 2885-2 | FALSE |
| postprandial-glucose | NULL | FALSE |
| direct-bilirubin | NULL | FALSE |
| hs-crp | NULL | FALSE |
| hematocrit | NULL | FALSE |
| mcv | NULL | FALSE |
| mch | NULL | FALSE |
| mchc | NULL | FALSE |
| chloride | NULL | FALSE |
| phosphorus | NULL | FALSE |
| magnesium | NULL | FALSE |
| iron | NULL | FALSE |
| tibc | NULL | FALSE |
| vitamin-b12 | NULL | FALSE |
| folate | NULL | FALSE |
| esr | NULL | FALSE |
| ldh | NULL | FALSE |
| amylase | NULL | FALSE |
| ck | NULL | FALSE |
| free-t3 | NULL | FALSE |
| t3 | NULL | FALSE |
| non-hdl-cholesterol | NULL | FALSE |
| insulin | NULL | FALSE |
| afp | NULL | FALSE |
| cea | NULL | FALSE |
| psa | NULL | FALSE |
| ca19-9 | NULL | FALSE |
| ca125 | NULL | FALSE |
| rf | NULL | FALSE |
