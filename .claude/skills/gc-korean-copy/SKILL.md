---
name: gc-korean-copy
description: Use when writing or editing any Korean user-facing text in apps/web or apps/research-web, including labels, headings, buttons, error messages, empty states, Storybook stories, or Playwright assertions on visible text.
---

# Korean user-facing copy

## Overview

The product organises source-backed health-document information and asks the user to confirm candidates. Copy must make the source, the uncertainty, and the user's own decision visible, and must never sound like a clinician. The scan in `apps/web/tests/korean-ux-copy.test.ts` enforces part of this; the rest is judgement.

## Voice

- Direct, plain, respectful 해요체. "확인해 주세요", not "확인 바랍니다" or "확인하십시오".
- Say what the server did, not what the user "should feel". "서버가 값과 출처를 함께 저장했어요."
- Name the boundary in the sentence where it matters: "값의 의미나 건강 상태를 판단하지 않아요."
- Dates through `formatKoreanDate` (`2026. 7. 28.`) and `formatKoreanDateTime`; never raw ISO strings in visible text.

## Forbidden in visible copy

Internal or English jargon: `fixture`, `PHI`, `SYNTHETIC`, `LIVE API`, `Object Lock`, `EVIDENCE LENS`, `SOURCE LEDGER`, `오케스트레이션`, and the rest of the list in the scan. Real institution names (`삼성 건강검진`, `강남세브란스`, any real hospital or lab). Clinical judgement words applied to a value: `정상`, `비정상`, `높음`, `낮음`, `위험`, `주의`, `권장`, `처방`, `진단`, `치료`. Reference ranges are shown only when they come from the user's own document and are labelled as such.

## Required patterns

| Situation | Pattern |
|---|---|
| Example or demo data | "예시" in the label; state that it did not come from a real file or institution. |
| Candidate review | "이 값이 원문과 같나요?" plus the source page and digest; actions "원문과 같아요 / 값 수정 / 이 항목 빼기". |
| Server states | Show the server's status word and a plain Korean sentence; never invent progress the server has not reported. |
| Errors | What happened, what the user can do next, and a way back. No stack traces, codes only in `<code>` if needed. |
| Questions for a professional | Neutral, source-linked, fixed wording; no thresholds, no "…이면 위험". |

## Workflow

1. Draft the copy in the component.
2. Add the component path to `userFacingFiles` in `korean-ux-copy.test.ts` if it is new.
3. Add a verbatim assertion for any sentence that states a limit or boundary.
4. Run `pnpm web:test`; update Playwright specs that assert on changed strings.
