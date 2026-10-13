# Sho Call — Claude Code build package

Read PRODUCT_BUILD_BRIEF.md, STYLE_GUIDE.md, and UX_UI_SPEC.md before implementation. Inspect every image in references/; they show the agreed visual direction. Reference-image interface text is illustrative, not a production specification. This package supersedes the earlier ShoCal spelling for the visible product name: use **Sho Call**.

## Paste this into Claude Code

Build Sho Call v1 from this folder. Read all three specification files and inspect the reference PNGs. Implement a working responsive web application with show creation/import, Show Designer, Director console, department views, Q-Link cue groups, approximate live timing, real-time updates, permissions, and explicit connection states. Preserve the gold/bronze Director and blue crew visual system. Use the supplied logos. Build the actual interface as accessible components rather than placing screenshots over the app.

Start by inspecting the existing repository and its instructions. Reuse its conventions. For a new repository, choose a practical typed frontend, server, database, and real-time transport. Verify current official documentation and supported package versions before installing dependencies. Describe your implementation choices briefly, then implement without stopping at a plan. Prioritize a complete demonstrable vertical slice, followed by the remaining v1 functions. Supply seed data, setup instructions, environment-variable examples without secrets, migrations, automated tests for critical state transitions, and a short demo walkthrough.

Use server-authoritative show state and revisioned commands. Opening Director and technician views in separate browsers/devices must demonstrate genuine synchronization. Label any local-only demo explicitly; never imply local storage provides cross-device synchronization. Do not implement automated media playback in v1. Do not invent integrations, pricing, customers, testimonials, or production readiness. If an external service is unavailable, provide a clearly documented local setup and explain the gap. Complete the work, run the relevant checks, and report what works and what remains.

## Package map

- PRODUCT_BUILD_BRIEF.md: product, scope, architecture requirements, semantics, acceptance criteria.
- STYLE_GUIDE.md: identity, tokens, typography, components, motion and accessibility.
- UX_UI_SPEC.md: screen-by-screen flows and image mapping.
- references/: 13 deck visual references plus the Verdigen emblem.
- brand/: transparent color, white and black Sho Call PNGs.

These are planning requirements for a preliminary build, not a claim that the production app already exists. Additional safeguards and schema details in the brief are implementation recommendations, while the identified product scope and visual direction carry forward the project decisions.
