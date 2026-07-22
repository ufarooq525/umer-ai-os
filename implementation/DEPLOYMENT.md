# Production deployment (M11)

Architecture V1 deployment surface: Docker Compose (local/prod-like) and Kubernetes Helm chart.

## Images

| Image | Dockerfile | Build arg |
|---|---|---|
| `umer-web` | `infra/docker/Dockerfile.web` | `NEXT_PUBLIC_CONTROL_API_URL` |
| `umer-gateway` | `infra/docker/Dockerfile.worker` | `APP_NAME=api-gateway` |
| `umer-control-api` | `infra/docker/Dockerfile.worker` | `APP_NAME=control-api` |
| `umer-orchestration` | `infra/docker/Dockerfile.worker` | `APP_NAME=orchestration-worker` |
| `umer-agent` | `infra/docker/Dockerfile.worker` | `APP_NAME=agent-worker` |
| `umer-extension` | `infra/docker/Dockerfile.worker` | `APP_NAME=extension-worker` |
| `umer-audit` | `infra/docker/Dockerfile.worker` | `APP_NAME=audit-sink` |

```bash
pnpm docker:build
```

## Docker Compose

Infra only (dev):

```bash
pnpm dev:infra
```

Full stack (infra + apps):

```bash
pnpm prod:up
# control-api :4000  gateway :4080  web :3000
pnpm prod:down
```

Compose profile `apps` builds and starts all application containers. Workers expose `GET /health` on `HEALTH_PORT` (default 8080).

## Kubernetes

Chart: `infra/k8s/charts/umer-ai-os`

```bash
helm lint infra/k8s/charts/umer-ai-os
helm template umer infra/k8s/charts/umer-ai-os
helm upgrade --install umer infra/k8s/charts/umer-ai-os \
  --set imageRegistry=ghcr.io/example \
  --set imageTag=v1.0.0
```

Includes:

- Deployments + ClusterIP Services for web, gateway, control-api, workers
- HPA for orchestration and agent workers
- NetworkPolicy restricting agent egress (NATS/data plane + extension-worker)
- Optional Ingress (`ingress.enabled=true`)

Managed Postgres/NATS/Redis/MinIO are expected outside the chart for production (or added as Helm deps later).

## Health probes

| Service | Probe |
|---|---|
| control-api / api-gateway | `GET /health` on service port |
| workers / audit-sink | `GET /health` on `HEALTH_PORT` |
| web | TCP on 3000 |

## CI

`.github/workflows/ci.yml`:

1. lint → typecheck → test → build
2. matrix Docker image builds + Trivy scan (non-blocking exit)
3. Helm lint + template render

## Environments

`local` · `dev` · `staging` · `prod` — same images; configure via ConfigMap/Secrets (`DATABASE_URL`, `NATS_URL`, S3, OTel).
