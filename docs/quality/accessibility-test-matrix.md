# Accessibility test matrix

Automated checks are evidence, not a claim of accessibility conformance.

| Surface/behavior | Automated evidence | Manual protocol | Status |
|---|---|---|---|
| Core headings/forms/tables/dialogs | Testing Library and jest-axe | screen-reader landmarks and labels | AUTOMATED PASS / MANUAL PENDING |
| Keyboard and focus | focus-visible styles and component assertions | keyboard-only full journey, focus order, dialog return | MANUAL PENDING |
| Dynamic upload/review status | semantic status text in demo | announcements during upload/quarantine/error/retry | SERVER UI NOT IMPLEMENTED |
| Charts/evidence views | text alternatives and labels | NVDA/JAWS/VoiceOver comprehension | MANUAL PENDING |
| Zoom/reflow | Storybook 200% and Playwright overflow assertion | 200% and 400% browser zoom | PARTIAL |
| Contrast | Storybook a11y tooling | high-contrast/forced-colors review | MANUAL PENDING |
| Motion | `prefers-reduced-motion` styles | OS reduced-motion verification | PARTIAL |
| Mobile | Playwright mobile viewports | iOS/Android screen reader and touch target review | MANUAL PENDING |
| Korean pronunciation/copy | Korean copy tests | Korean-native screen-reader review | MANUAL PENDING |
| Error handling | visible demo validation errors | focus/announcement for server 401/403/409/5xx | NOT IMPLEMENTED |

Before private beta, record browser/OS/assistive-technology versions, tester, date, defects, remediation commit, and retest result. Do not mark the release gate complete from axe output alone.
