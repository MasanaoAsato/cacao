---
name: coding-frontend
description: When a user requests a specific coding skill, the agent refers to that skill to carry out the implementation.
---

# coding frontend
This repository contains an implementation of frontend.
You must implement tests colocation with the code.
Must do `mise run web:lint` to check for linting errors.
Must do `mise run web:check` to check for biome check.
Must do `mise run web:format` to check for formatting errors.
Must do `mise run web:typecheck` to check for type errors.
Must do `mise run web:test` to check for type errors.
There are some good skills for Go that can be used to improve the quality of the code, such as:

- .agents/skills/vercel-react-best-practices
- .agents/skills/web-design-guidelines
- .agents/skills/frontend-design

After implementation, you must call the "code-review" skill from a separate agent to receive feedback on the review.
