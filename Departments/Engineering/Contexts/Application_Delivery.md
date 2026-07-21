# Bounded Context: Application Delivery

Governed by `Departments/Engineering/ENGINEERING_CHARTER.md`.

## Purpose

Build and change production-facing Services that realize Capabilities — across all delivery surfaces (API, web, mobile, edge, production AI as modality). Backend and Frontend are surfaces, not sibling contexts.

## Owns

Implementation Packages, Interface Contracts (API/Event), Engineering Test Evidence Bundles, secure-delivery practices within Security constraints, production AI systems when in scope.

## Does Not Own

UX authority (Design); release go/no-go authority (shared RACI / QA validation); Platform golden-path definition (Platform); business measurement definitions (Analytics/Business); security control ownership (Security).

## Interfaces

Consumes Solution Architecture + Platform Standards + Design handoffs; produces Implementation Packages for Release Engineering and QA; emits instrumentation per Analytics contracts.

## Primary Artifacts

API/Event/Interface Contract, Implementation Package, Engineering Test Evidence Bundle.

## Anti-Patterns

Backend vs Frontend org war; shipping without contracts; AI side-system outside Platform/Observability; self-certifying QA gates.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Engineering / Application Delivery
```
