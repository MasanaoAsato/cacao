# Quality gate

Read this file before authoring and use it again before finalizing the HTML. A structural validator cannot replace these semantic checks.

## Repository truth and state

- Verify each Current claim against the checked-out repository's code, tests, configuration, schemas, migrations, or API definitions.
- Describe only the current details required to understand the change; reference the owning file, module, type, or symbol without a line number.
- Label Proposed behavior as Proposed when it could be mistaken for current behavior.
- Resolve contradictions with the existing document by replacing or deleting old text; do not preserve both accounts.
- Do not claim that unimplemented behavior already exists.

## Implementation readiness

- Goal states what, why, and scope briefly; it states exclusions only when they prevent ambiguity.
- Design fixes every consequential boundary or contract that an implementer would otherwise have to invent.
- Relevant contracts define concrete inputs, outputs, ownership, validation, failure semantics, state transitions, invariants, and compatibility expectations.
- Every externally visible value or rule—including status codes, error shapes, limits, normalization, retention, and retry behavior—comes from the request, repository evidence, or an explicit user decision; none exists solely to fill a gap.
- Durability, transaction, concurrency, and external-service guarantees do not assume capabilities absent from repository evidence. Escalate a consequential missing choice instead of selecting new infrastructure silently.
- Relevant cross-cutting constraints are explicit: authorization, sensitive data, transaction boundaries, concurrency, ordering, retries, idempotency, and observability.
- Consequential choices record the selected option and why it fits this change. Omit routine framework choices and discarded options that add no future value.
- Implementation appears only when logical units have a non-obvious dependency or required order.
- Verification describes observable success, failure, or boundary conditions that are important to the specification—not the generic instruction to run tests.
- No phrase defers a required decision, including “適切に処理する”, “必要に応じて”, “状況に応じて”, “いい感じに調整する”, “as appropriate”, or “if necessary”. Replace it with a rule or identify a true blocker.

## Change-unit integrity

- One document covers one independently understandable and implementable logical change.
- Multiple change units share a document only when separating them would duplicate a common contract or make implementation order unclear.
- Shared facts have one owner and are referenced instead of copied.
- A PR boundary is not duplicated merely to mimic the design boundary.

## Decay resistance

- Do not copy class or function inventories, complete directory trees, schema or API definitions, configuration values, or source code that primary sources already own.
- Do not include volatile implementation details unless they are constraints or contracts.
- Do not retain completed implementation steps, superseded decisions, duplicated rationale, or background that no longer affects implementation.
- Do not add dates, status dashboards, or progress logs unless the repository explicitly requires them.
- Update by replacement and deletion, never by append-only history.

## HTML and readability

- The file is under `.design`, has a descriptive title, one `h1`, fixed `Goal` and `Design` headings, and working anchor links.
- Heading depth stays shallow. Every section has substantive content; no section contains only “該当なし” or an equivalent.
- Current and Proposed are visually and textually distinguishable where both occur together.
- Tables are used only when rows and columns make a contract or comparison faster to understand.
- CSS supports hierarchy and state distinction without becoming the main artifact; JavaScript is absent unless required by an established repository format.
- The result can be scanned by a human and parsed by an AI without relying on color alone.

## Final deletion pass

For every paragraph, list item, table, and example, ask:

1. Does an implementer need this to avoid a meaningful wrong decision?
2. Is this information difficult to recover from an identified primary source?

Delete the content when the first answer is no. Prefer a source reference when the first answer is yes and the second is no. Then confirm that this design plus the repository is sufficient to start implementation without another major design decision.
