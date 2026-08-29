# Experiment registry

Experiments are evidence, not product permissions. Each result records the exact artifact and what the result cannot prove.

## EX-2026-08-30-01 — Synthea FHIR R4 → evidence-graph candidates

| Field | Record |
|---|---|
| QUESTION | Can the current Kotlin/HAPI boundary deterministically admit source-faithful, provenance-preserving quantity Observations from an actual upstream Synthea FHIR R4 Bundle while failing closed on unsupported semantics? |
| DATE | 2026-08-30 (Asia/Seoul) |
| STATUS | `BENCHMARKED` |
| DATA AUTHORIZATION | Synthetic only |
| GENERATOR | Synthea `4.0.0`, Git commit `0185c09ea9d10a822c6f5f3ef9bdcbcbe960c813` |
| RUNTIME | Eclipse Temurin Java `21.0.11` on Windows |
| SEEDS | population seed `20260830`; clinician seed `20260830`; reference date `20260830`; one patient; age 40–50; Massachusetts module context |
| INPUT | FHIR R4 transaction Bundle; 1,341,255 bytes; SHA-256 `f8285f2265a82a8dc71697aa25b9e3cfd92be089cff7528906df2b15b3c6ba74` |
| RESOURCE COUNTS | 390 entries. Observations 99; Patient 1; DiagnosticReport 48; DocumentReference 30; Encounter 30; Condition 18; MedicationRequest 6; ImagingStudy 3; other types ignored by this projector and counted. |
| PROJECTOR RESULT | 80 `CANDIDATE` quantity measurements admitted; 19 rejected: 18 `UNSUPPORTED_VALUE`, one `AMBIGUOUS_CODE`. |
| TEST | `SyntheticFhirEvidenceProjectorTest.projects a pinned externally generated Synthea patient bundle` |
| SAFETY PROPERTY | No endpoint, database write, Spring bean, network request, LLM, diagnosis inference, or canonical fact mutation. Narrative/note text is not projected. |

### Reproduction

Clone the official `v4.0.0` tag, verify the exact commit, and use forward slashes for the output override on Windows:

```powershell
git clone --branch v4.0.0 --depth 1 https://github.com/synthetichealth/synthea.git C:/path/to/gc-synthea-v4.0.0
git -C C:/path/to/gc-synthea-v4.0.0 rev-parse HEAD
C:/path/to/gc-synthea-v4.0.0/run_synthea.bat -s 20260830 -cs 20260830 -p 1 -r 20260830 -a 40-50 --exporter.baseDirectory=C:/path/to/gc-synthea-output-v4.0.0 --exporter.fhir.export=true --exporter.ccda.export=false --exporter.csv.export=false Massachusetts
$candidateBundles = Get-ChildItem C:/path/to/gc-synthea-output-v4.0.0/fhir -File | Where-Object { $_.Name -notmatch '^(hospital|practitioner)Information' }
$bundle = $candidateBundles | Sort-Object Length -Descending | Select-Object -First 1
(Get-FileHash -Algorithm SHA256 -LiteralPath $bundle.FullName).Hash.ToLowerInvariant()
$env:GC_SYNTHEA_FHIR_BUNDLE = $bundle.FullName
.\gradlew.bat :apps:core-api:test --tests 'kr.co.genomecompanion.evidencegraph.SyntheticFhirEvidenceProjectorTest' --rerun-tasks
Remove-Item Env:GC_SYNTHEA_FHIR_BUNDLE
```

The first generation attempt used a Windows backslash path in Synthea's Gradle property and failed before producing output. Re-running with a forward-slash absolute path succeeded. This failure is retained because reproducibility includes failed setup assumptions.

### Admission rules measured

- request subject must match the synthetic-only namespace;
- generator version and 40-character commit are mandatory;
- payload is non-empty, at most 16 MiB, and valid transaction/collection Bundle JSON with at most 10,000 entries;
- exactly one Patient, no duplicate Bundle `fullUrl`, and no duplicate Observation identity;
- Observation subject matches that Patient;
- status is final, amended, or corrected;
- exactly one system+code coding;
- value is a Quantity with a UCUM system, code, and unit;
- effective time is offset-aware and `issued` is present;
- candidate identity is deterministic and excludes import time;
- source digest, resource/version, Bundle location, generator version/commit, and import time remain provenance.

### What this proves

It proves that one pinned upstream synthetic Bundle can be parsed and reduced to deterministic, source-linked quantity candidates under the stated gates, and that unsupported Observation values/codings remain explicit rejections rather than silently coerced facts.

### What this does not prove

It does **not** prove clinical accuracy, medical completeness, Korean-population realism, KR Core or MyHealthWay conformance, terminology correctness beyond the admitted syntax, OCR performance, longitudinal record merging, database durability, user correction UX, privacy compliance, production security, or readiness for real health data.

## Next registered experiments

| Planned ID | Question | Required artifact | Start gate |
|---|---|---|---|
| EX-02 | Can a KR Core validator reject nonconformant synthetic resources with exact profile/version evidence? | Pinned official package, validator config, positive/negative fixtures | Approved package and license receipt |
| EX-03 | Which OCR/layout pipeline wins the frozen Korean medical-template corpus without false safety-critical admission? | Synthetic/redacted corpus and ground truth | Corpus/privacy/license review |
| EX-04 | Can candidate persistence, correction, supersession, and provenance reload without silent fact mutation? | PostgreSQL schema, migrations, integration tests | Candidate model review |
| EX-05 | Can a read-only assistant answer longitudinal questions with complete citations and correct abstention under prompt injection? | Frozen evidence snapshots and adversarial question pack | Deterministic query/tool policy implemented |
