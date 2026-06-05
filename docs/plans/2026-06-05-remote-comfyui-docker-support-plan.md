---
title: Remote ComfyUI and Docker Support Plan
status: completed
created: 2026-06-05
owner: fork maintainers
summary: Minimal-change plan to add non-local ComfyUI support and Web/Docker deployment while keeping upstream sync and future PR work manageable.
---

# Remote ComfyUI and Docker Support Plan

## Problem Frame

This fork needs two capabilities that the upstream project does not currently support well enough for this use case:

1. ComfyUI custom provider support must work with non-local addresses instead of being limited to `localhost` and `127.0.0.1`.
2. The project needs a Docker deployment path for the Web and backend runtime without involving Electron packaging.

The main constraint is to keep the patch small, easy to reapply after frequent upstream updates, and suitable for a future upstream PR where possible.

## Current Project Shape

The repo has three practical layers:

- `src/`: React + Vite frontend
- `backend/src/`: Express backend, provider normalization, generation adapters, settings persistence, file hosting
- `electron/`: Windows desktop packaging and runtime bootstrap

For this work, the safest path is:

- implement ComfyUI remote support only in the backend provider pipeline
- implement Docker only for the Web + backend runtime
- avoid touching Electron unless a future need appears

## Scope

### In scope

- allow configurable non-local ComfyUI URLs through backend validation gates
- keep local-only protections for unrelated features intact
- add a production-oriented Dockerfile and docker-compose example for Web + backend
- add enough tests and docs to make future upstream rebases predictable
- define a fork maintenance workflow for frequent upstream syncs

### Out of scope

- changing Eagle local-only restrictions
- changing other localhost-only protections outside ComfyUI
- Dockerizing Electron
- redesigning provider UX
- refactoring the entire provider registry

## Design Principles

1. Keep the change surface as narrow as possible.
2. Centralize the ComfyUI address rule in one reusable backend helper.
3. Default behavior must stay safe and backward compatible.
4. New Docker support must reuse existing backend packaged/static hosting behavior instead of introducing a second app server.
5. Separate PR-friendly changes from fork-only convenience changes.

## Root Cause Summary

The current remote ComfyUI failure is caused by backend restrictions, not by the frontend GUI itself.

The existing hard blocks are in two places:

- `backend/src/providers/registry.js`
  - drops non-local ComfyUI base URLs during advanced provider normalization
  - drops non-local ComfyUI instance entries in `comfyuiConfig.instances`
- `backend/src/providers/comfyui.js`
  - rejects non-local ComfyUI URLs during provider test
  - rejects non-local ComfyUI URLs during image generation

This means saved settings can be normalized away before runtime, and runtime can still reject the address even if it was entered.

## Implementation Units

### Unit 1: Shared ComfyUI address access rule

Files:

- `backend/src/providers/comfyuiAccess.js`

Goal:

- create one backend-only helper that decides whether a ComfyUI URL is allowed

Responsibilities:

- normalize environment flag parsing
- validate `http` and `https` only
- allow local hosts by default
- optionally allow remote hosts via a controlled backend gate

Recommended API:

- `isAllowedComfyuiUrl(value, options = {})`
- optional helper for env-flag parsing if kept internal

Recommended environment gate:

- prefer `T8_COMFYUI_ALLOW_REMOTE`

Reason:

- `ALLOW_REMOTE` matches actual behavior better than a private-network-only name
- it keeps the policy generic for local network, bridged network, or public host use cases

Backward compatibility:

- when the env var is absent, current localhost-only behavior stays unchanged

### Unit 2: Provider normalization support

Files:

- `backend/src/providers/registry.js`

Goal:

- allow ComfyUI provider settings to persist non-local URLs when backend policy allows them

Required changes:

- replace current inline local-only checks with the shared helper
- use the helper for:
  - `baseUrl` validation for `protocol === 'comfyui'`
  - `comfyuiConfig.instances` filtering

Important decision:

- do not depend on a new persisted `allowRemote` field as the main mechanism

Reason:

- `allowRemote` is not currently part of the frontend type or stable settings schema
- relying on it as the primary switch would create a half-persisted behavior that is easy to lose during upstream updates
- backend environment policy is smaller, safer, and easier to document

Optional compatibility layer:

- if desired, preserve support for `raw.allowRemote` only as a secondary override for backward compatibility
- do not make that the main documented path

Test scenarios for this unit:

- non-local ComfyUI provider is rejected when remote access is disabled
- non-local ComfyUI provider is accepted when remote access is enabled
- non-local ComfyUI instances are retained when remote access is enabled
- local ComfyUI defaults continue to work unchanged

### Unit 3: Runtime provider test and generation support

Files:

- `backend/src/providers/comfyui.js`

Goal:

- allow real runtime calls to non-local ComfyUI when backend policy allows them

Required changes:

- replace inline `isLocalUrl` runtime gate with shared helper
- apply the helper in:
  - `testProvider()`
  - `generateImage()`

Required message updates:

- current errors say ComfyUI only allows localhost
- update wording so it reflects backend policy, for example:
  - default is localhost-only
  - remote addresses require backend allowlist or remote-enable configuration

Keep unchanged:

- workflow patching logic
- upload-to-ComfyUI logic
- polling/history logic
- output extraction logic

Test scenarios for this unit:

- `testProvider()` rejects remote URL when remote access is disabled
- `testProvider()` requests `/queue` on remote URL when remote access is enabled
- `generateImage()` rejects remote URL when remote access is disabled
- `generateImage()` submits to remote `/prompt` when remote access is enabled

### Unit 4: Frontend wording alignment

Files:

- `src/components/ApiSettings.tsx`

Priority:

- recommended but optional for minimum functionality

Goal:

- remove misleading wording that says ComfyUI only supports the local machine

Required changes:

- update ComfyUI guide copy
- keep the UI simple
- avoid exposing internal deployment details or user-specific examples

Suggested wording direction:

- default remains local
- backend can optionally allow other permitted addresses

Do not add yet unless needed:

- a full new UI toggle for remote access
- fork-specific network examples
- personal or internal host examples

### Unit 5: Docker runtime support

Files:

- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`
- `README.md`

Goal:

- run the frontend and backend together as one containerized Web app

Architecture choice:

- build frontend with Vite
- run backend Express in packaged/static-host mode
- let Express serve `dist`

Recommended environment contract:

- `HOST=0.0.0.0`
- `PORT=18766`
- `NODE_ENV=production`
- `T8PC_PACKAGED=1`
- `T8PC_FRONTEND_DIST=/app/dist`
- `T8PC_USER_DATA=/app/userdata`
- `T8_COMFYUI_ALLOW_REMOTE=1` only when the deployment intentionally allows non-local ComfyUI

Why packaged mode is the best fit:

- backend already knows how to statically serve frontend assets when `T8PC_PACKAGED=1`
- this avoids adding a separate Nginx layer or changing route behavior
- it keeps Docker behavior close to the Electron-serving path without including Electron

Dockerfile requirements:

- multi-stage build preferred
- install root dependencies
- install backend dependencies
- build frontend
- copy only runtime artifacts needed by backend Web serving path

Minimal runtime contents:

- `dist/`
- `backend/`
- root `package.json` if runtime scripts need it
- any runtime data directories that must exist can be created at container start

`.dockerignore` should exclude:

- `.git`
- `node_modules`
- `dist_electron`
- `output`
- `input`
- `thumbnails`
- local user data artifacts

Compose principles:

- keep it generic and PR-safe
- prefer default bridge networking
- mount only one persistent user data volume
- avoid custom network names unless there is a specific documented need

Do not hardcode:

- personal paths
- private IPs
- host-specific bridge names

### Unit 6: Documentation and maintenance notes

Files:

- `README.md`
- `docs/fork-maintenance.md` or a similarly named fork-only maintenance doc

Goal:

- document both product behavior and maintenance workflow without leaking personal details

README changes should cover:

- ComfyUI default policy and optional backend remote enablement
- Docker build and compose usage
- note that container `localhost` means the container itself, not the host machine

Fork maintenance doc should cover:

- which files are intentionally modified
- which changes are PR-friendly
- which changes are fork-only convenience
- how to reapply changes after upstream sync
- which tests to rerun after conflicts

## Minimal Change Set

If the goal is the smallest functional patch, the required files are:

- `backend/src/providers/comfyuiAccess.js`
- `backend/src/providers/registry.js`
- `backend/src/providers/comfyui.js`
- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`

If the goal is smallest patch that is also maintainable, add:

- `src/components/ApiSettings.tsx`
- `tests/advancedProviders.test.ts`
- `tests/comfyuiProvider.test.ts`
- `README.md`

If the goal includes long-term fork upkeep, also add:

- `docs/fork-maintenance.md`

## PR-Friendly Split

To keep future upstream contribution clean, split the work into two independent patches:

1. Remote ComfyUI support
2. Docker support

Recommended branch layout:

- `main`
  - local mirror of upstream-compatible code
- `feature/comfyui-remote-support`
- `feature/docker-web-deployment`
- `integration/local-use`
  - optional local integration branch that combines both features for daily use

Why split:

- easier review
- smaller conflict surface
- easier to cherry-pick or drop one feature later

## Upstream Sync Workflow

### Remote setup

Add upstream once:

1. keep `origin` as your fork
2. add original repo as `upstream`

### Ongoing update flow

Recommended loop:

1. fetch `upstream`
2. fast-forward local `main` to `upstream/main`
3. rebase `feature/comfyui-remote-support` onto new `main`
4. rebase `feature/docker-web-deployment` onto new `main`
5. rebuild `integration/local-use` from the rebased feature branches
6. run focused regression tests

### Why not keep custom changes directly on `main`

If local features live directly on `main`, every upstream sync mixes upstream history and fork-specific history into one branch. That makes:

- conflict resolution noisier
- future PR extraction harder
- revert and audit more difficult

### Optional Git aids

Recommended repository settings for repeated rebases:

- enable `git rerere`
- keep commits small and topic-focused
- avoid mixing docs, Docker, and provider logic in one large commit if possible

## Test Strategy

This repo already has focused Node tests around advanced providers and ComfyUI. Reuse that structure instead of introducing a new test framework.

### Tests to update or add

- `tests/advancedProviders.test.ts`
  - normalization behavior for remote ComfyUI provider settings
- `tests/comfyuiProvider.test.ts`
  - provider test and generation behavior for remote URLs
- `tests/advancedProviderSettingsRoute.test.ts`
  - optional route-level persistence confirmation

### Required regression scenarios

- local ComfyUI config still normalizes correctly
- remote ComfyUI config is rejected when remote access is disabled
- remote ComfyUI config is preserved when remote access is enabled
- provider test still masks secrets in route responses
- image generation path still rewrites outputs correctly
- Docker env configuration does not break normal non-Docker startup assumptions

### Manual verification checklist

- save ComfyUI config with local URL
- save ComfyUI config with non-local URL while remote access disabled
- save ComfyUI config with non-local URL while remote access enabled
- test provider connection from settings UI
- run a ComfyUI image generation using saved workflow
- start Docker container and confirm:
  - `/api/status` responds
  - frontend loads from backend-served static assets
  - persisted settings survive container restart when using volume mount

## Conflict Hotspots During Future Rebases

The files most likely to conflict with active upstream work are:

- `backend/src/providers/registry.js`
- `backend/src/providers/comfyui.js`
- `src/components/ApiSettings.tsx`
- `README.md`

Conflict handling guidance:

- keep helper extraction in `comfyuiAccess.js` small and self-contained
- avoid unrelated formatting churn in provider files
- keep frontend wording edits surgical
- keep Docker docs in dedicated sections instead of scattering notes everywhere

## Documentation Boundary: What Should and Should Not Go Upstream

### Suitable for upstream PR

- backend helper for controlled remote ComfyUI support
- provider normalization updates
- runtime provider updates
- tests for the new behavior
- neutral README documentation for optional remote support
- generic Docker support if it does not assume a personal environment

### Keep fork-only unless generalized

- host-specific compose networks
- internal host examples
- personal deployment notes
- environment details tied to one machine or one LAN

## Detailed Execution Checklist

### Phase A: Remote ComfyUI backend support

1. Add `backend/src/providers/comfyuiAccess.js`.
2. Refactor `backend/src/providers/registry.js` to consume the helper.
3. Refactor `backend/src/providers/comfyui.js` to consume the helper.
4. Update error text so it no longer falsely states localhost-only as an absolute rule.
5. Run focused provider tests.

Exit criteria:

- remote URL can be saved and used when backend policy allows it
- local behavior remains unchanged by default

### Phase B: Frontend wording alignment

1. Update ComfyUI guide copy in `src/components/ApiSettings.tsx`.
2. Keep the UI schema unchanged unless a later round explicitly adds a persisted toggle.

Exit criteria:

- no UI text contradicts backend behavior

### Phase C: Docker support

1. Add `.dockerignore`.
2. Add `Dockerfile`.
3. Add `docker-compose.yml`.
4. Validate backend serves `dist` in packaged/static mode.
5. Document startup and persistent volume expectations in `README.md`.

Exit criteria:

- container can serve both frontend and backend through one exposed port

### Phase D: Maintenance documentation

1. Add fork maintenance doc.
2. Record modified files and intent.
3. Record upstream sync flow.
4. Record minimal regression test list.

Exit criteria:

- future rebases can be handled without rediscovering the design decisions

## Recommended Order of Real Implementation

1. Remote ComfyUI backend helper and provider changes
2. Focused tests
3. Frontend wording updates
4. Dockerfile and compose
5. README updates
6. Fork maintenance doc

Reason:

- solve the real bug first
- lock behavior with tests
- only then document and package it

## Acceptance Criteria

The work is considered complete when all of the following are true:

- non-local ComfyUI URLs are usable through the existing advanced provider flow when backend remote access is enabled
- localhost-only default behavior remains intact when remote access is not enabled
- Docker deployment can run the Web frontend and backend from one containerized setup
- no unrelated local-only features are relaxed
- the modified file set stays small and understandable
- there is enough documentation to rebase the fork after future upstream updates

## Notes for Future PR Preparation

Before opening a PR upstream:

1. remove any fork-only host or network examples
2. keep environment variable naming generic
3. ensure README wording is neutral and not tied to one deployment
4. keep commits split by topic
5. include focused tests that show local default behavior is unchanged

## File Inventory Summary

### Required for feature behavior

- `backend/src/providers/comfyuiAccess.js`
- `backend/src/providers/registry.js`
- `backend/src/providers/comfyui.js`
- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`

### Strongly recommended for maintainability

- `src/components/ApiSettings.tsx`
- `tests/advancedProviders.test.ts`
- `tests/comfyuiProvider.test.ts`
- `tests/externalProvidersRoute.test.ts`
- `tests/dockerComposeConfig.test.ts`
- `README.md`

### Recommended for long-term fork upkeep

- `docs/fork-maintenance.md`

## Follow-up: Docker Remote Access Regression

After the first implementation, the Docker Compose service still had `T8_COMFYUI_ALLOW_REMOTE` documented but commented out. In that state the GUI accepted a non-local ComfyUI URL, but the backend normalization policy rejected it and fell back to the built-in local ComfyUI provider. The visible symptom was a misleading `fetch failed` against the local default instead of the saved remote URL.

Minimal follow-up changes:

- enable `T8_COMFYUI_ALLOW_REMOTE: "1"` in `docker-compose.yml`
- add `tests/dockerComposeConfig.test.ts` so Docker Compose cannot regress to a commented remote-access setting
- extend `tests/externalProvidersRoute.test.ts` so a saved remote ComfyUI provider is preserved and the test endpoint calls the remote `/queue` URL when remote access is enabled
- update README and fork maintenance notes to distinguish non-Docker local-only defaults from Docker Compose remote-enabled deployment
