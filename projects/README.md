# Project catalog

Registered Laragon apps for Umer AI OS intake.

## Current projects

See [`catalog.json`](./catalog.json).

## Add a new project later

1. Ensure the folder exists under `C:\laragon\www\<path>` (or your `UMER_PROJECTS_ROOT`).
2. Append an object to `projects` in `catalog.json`:

```json
{
  "projectId": "my-new-app",
  "name": "My New App",
  "slug": "my-new-app",
  "path": "my-new-app",
  "status": "active",
  "category": "client-task",
  "stack": ["laravel", "php"],
  "defaultSpecialists": ["pm.intake", "eng.app-delivery", "qa.verify"],
  "constraints": [],
  "tags": []
}
```

3. Restart `control-api` (or `pnpm prod:up`).
4. Confirm in UI at `/projects` or `GET /v1/projects`.

`projectId` must be unique. `path` is relative to `UMER_PROJECTS_ROOT` (default `C:/laragon/www`).

`category` is required: `client-task` | `digital-product` | `seo-project` (threaded onto intake plans for downstream branching).

Optional eng field: `autoApplyEng` (boolean, default `false`) — only unlocks digital-product auto-apply when staged suites are green; ignored for client-task (always human gate).

Optional QA fields: `qaLocalUrl`, `qaTestCommand` (used when intake `type=qa` applies `.umer/qa/`).
Optional SEO fields: `seoBaseUrl`, `seoLocalUrl`.
