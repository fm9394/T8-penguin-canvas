# Fork Maintenance Notes

This document records the intentional fork-level changes for remote ComfyUI access and Docker deployment. Keep entries repo-relative and avoid machine-specific paths, private network addresses, or personal deployment details.

## Maintained Features

- Remote ComfyUI access can be enabled by backend environment policy while local-only behavior remains the default.
- Docker deployment runs the Vite-built frontend and Express backend together without Electron.

## Intentional Change Surface

- `backend/src/providers/comfyuiAccess.js`: shared ComfyUI URL policy helper.
- `backend/src/providers/registry.js`: ComfyUI provider normalization uses the shared policy.
- `backend/src/providers/comfyui.js`: ComfyUI runtime test and generation checks use the shared policy.
- `src/components/ApiSettings.tsx`: ComfyUI setting copy reflects optional remote backend access.
- `Dockerfile`, `.dockerignore`, `docker-compose.yml`: Web/backend container deployment.
- `README.md`: public usage notes for remote ComfyUI and Docker.
- `tests/advancedProviders.test.ts`, `tests/comfyuiProvider.test.ts`: focused regression coverage.

## Upstream Sync Workflow

1. Keep `main` close to upstream.
2. Keep this feature work on a topic branch.
3. Rebase the topic branch after upstream updates.
4. Resolve conflicts only in the files listed above unless upstream moved the same behavior.
5. Run the focused tests before merging into any local integration branch.

## Regression Commands

Run these first after conflicts in provider logic:

```bash
node --test tests/advancedProviders.test.ts tests/comfyuiProvider.test.ts
```

Run broader checks before pushing:

```bash
npm run type-check
npm run build
```

If Docker is available:

```bash
docker compose build
```

## PR Preparation Checklist

- Keep examples generic.
- Do not include personal paths or private network addresses.
- Keep Docker networking generic unless upstream asks for a specific deployment topology.
- Keep remote ComfyUI disabled by default.
- Split remote ComfyUI and Docker into separate PRs if upstream review benefits from smaller changes.
