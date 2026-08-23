---
name: maintain-implementation-design
description: Create or update concise, implementation-ready HTML design documents under a repository's .design directory before software changes. Use when a user asks to design, plan, specify, or revise a feature, behavior change, migration, or PR and the deliverable should let a developer or AI implement it without making major additional design decisions. Ground Current facts in repository evidence, distinguish them from Proposed behavior, and prevent stale or duplicated documentation.
---

# Maintain Implementation Design

Produce the smallest design document that makes the requested change implementable. Preserve intent, contracts, boundaries, constraints, and consequential decisions; do not narrate source code.

## Use the bundled resources

- Read [references/quality-gate.md](references/quality-gate.md) completely before authoring or revising a document.
- For Create, copy [assets/design-document.html](assets/design-document.html) into `.design` and replace or remove every placeholder and template comment.
- Before finishing, resolve the path relative to this `SKILL.md` and run `python3 <this-skill-directory>/scripts/validate_design.py <design-file>`. Treat errors as blockers and review warnings manually.

## Resolve the operation and target

1. Read repository instructions and inspect `.design` before choosing a file.
2. If the user identifies a document by number, name, or path, resolve and use that document. Do not silently create a replacement.
3. Use Update when an existing document owns the same logical change. Otherwise use Create.
4. Follow the repository's naming convention. If none exists, use `.design/<concise-kebab-case-change-name>.html`.
5. Prefer one document per independently implementable logical change. Split unrelated changes instead of growing a catch-all document.

## Establish repository evidence

Inspect only the primary sources needed for this change: relevant code and tests, configuration, schemas and migrations, API definitions, repository instructions, and directly related designs. Use targeted searches before broad reads.

Classify findings while working:

- **Current**: verified in the checked-out repository. Keep a claim only when it is necessary to understand the proposed change.
- **Proposed**: behavior or structure introduced by this design. Never present it as already implemented.
- **Unknown**: a consequential choice that neither the request nor repository evidence resolves.

Do not invent externally visible contract details or infrastructure capabilities merely to make the design look complete. Treat status codes, field shapes, validation limits, normalization, time boundaries, failure semantics, durability, transaction support, compatibility, and security policy as Unknown unless the request or repository establishes them.

Do not ask the user for information discoverable from the repository. Ask before finalizing when an Unknown would materially change a product contract, scope boundary, security rule, data meaning, storage or transaction model, or irreversible migration. State the exact decision needed and the repository evidence that leaves it open. Continue without asking only when a reversible implementation detail has a safe repository-consistent choice; implementability alone does not make a choice safe.

## Create

1. State one logical change in **Goal**:
   - what becomes possible;
   - why the change is needed;
   - what is in scope;
   - what is out of scope only when omission would be ambiguous.
2. Write **Design** with only the subsections demanded by the change. Possible topics include flow, responsibility boundaries, integration points, API or data contracts, events, invariants, security, errors, migration, and consequential decisions.
3. Make contracts exact enough to implement: identify ownership, inputs and outputs, state transitions, failure semantics, invariants, compatibility, and transaction or idempotency rules when relevant.
4. Reference source-of-truth files, modules, types, or symbols instead of copying them. Avoid line-number references.
5. Add **Implementation** only when dependency order or change boundaries are not evident from Design. Describe logical units and ordering, not a task checklist.
6. Add **Verification** only for non-obvious acceptance criteria or important success, failure, and boundary conditions.
7. Do not add a standalone **Current State** section. Put only the current-to-proposed delta needed for the design inside Design.

## Update

1. Read the entire target design and the current repository evidence relevant to the requested change.
2. Identify stale, contradictory, duplicated, source-obvious, and no-longer-useful content before editing.
3. Replace the affected statements in place. Do not append a second account of the new behavior.
4. Remove obsolete content and empty sections. Preserve unrelated valid change units.
5. Recheck every Current claim affected by the change and keep Proposed behavior visibly distinct.
6. Re-evaluate whether Implementation or Verification is still necessary; delete either when it has become self-evident or obsolete.

## Author the HTML

- Produce a readable, self-contained HTML file with semantic landmarks, shallow `h1`–`h3` headings, and anchor links.
- Keep CSS small and inline. Do not add JavaScript unless the repository's established design format requires it.
- Use lists for compact facts and tables only for exact mappings or comparisons.
- Mark Current and Proposed explicitly whenever both appear in the same local context.
- Render file paths, symbols, types, fields, and short contract fragments with `code`.
- Omit empty sections, “not applicable” sections, generic technology explanations, inventories, full directory trees, and large code samples.
- Match the document language to the user or repository unless instructed otherwise. Keep the fixed headings `Goal` and `Design`.

## Finish

1. Apply every item in [references/quality-gate.md](references/quality-gate.md).
2. Delete any statement that fails either test: “Does implementation require this?” and “Is this difficult to recover from a primary source?”
3. Run the validator and inspect the final diff for accidental rewrites of unrelated content.
4. Report the created or updated file, the repository evidence used, validation results, and only unresolved decisions that block implementation.
