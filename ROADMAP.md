# Umer AI OS — Engineering Roadmap

Architecture V1 and the Implementation Blueprint are **frozen**. Progress is measured by working software.

| Milestone | Deliverable | Status |
|---|---|---|
| Architecture V1 | Enterprise, Org, Runtime, Specialist, Work Mgmt, Blueprint | ✅ Complete |
| Scaffold | Monorepo skeleton | ✅ Complete |
| **M1** | `@umer/contracts` | ✅ Complete |
| **M2** | Runtime Kernel | ✅ Complete |
| **M3** | Message Fabric | ✅ Complete |
| **M4** | Orchestrator | ✅ Complete |
| **M5** | Specialist SDK | ✅ Complete |
| **M6** | First end-to-end flow | ✅ Complete |
| **M7** | Memory Access | ✅ Complete |
| **M8** | Artifact Engine | ✅ Complete |
| **M9** | Trust & Audit | ✅ Complete |
| **M10** | Control-plane UI | ✅ Complete |
| **M11** | Production deployment | ⏸️ Deferred (local-first) |

## Workflow

1. Finish milestone deliverables  
2. Run `pnpm build && pnpm test && pnpm typecheck && pnpm lint`  
3. Review  
4. Merge  
5. Start next milestone  

New architectural ideas inside an **already-Accepted** milestone design require an RFC only when implementation exposes a real limitation.

**Runtime exception (RFC-003):** new or materially extended Runtime subsystems must follow `Runtime/RUNTIME_SYSTEMS_ARCHITECT_DOCTRINE.md` — research, RFC, architecture approval — **before** implementation. See `RFC/Records/RFC-003-runtime-subsystem-architecture-gate.md`.
