# Bounded Context: Solution Architecture

Governed by `Departments/Engineering/ENGINEERING_CHARTER.md`.

## Purpose

Define how approved Capabilities become coherent systems — boundaries, interfaces, trust edges, and decisions — distinct from `Enterprise_Architecture/` which models enterprise nouns, not delivery-time system shape.

## Owns

Solution Architecture Models, System Maps, Reference Architectures, technical ADR proposals, Feasibility/Constraint Notes, service boundary decisions inside Engineering.

## Does Not Own

Enterprise Capability/Domain registry (EA); product roadmap (Business); visual UX authority (Design); independent test authority (QA); security control frameworks (Security).

## Interfaces

Consumes Business Intent + EA nouns + Design artifacts; produces Models/Contracts for Application Delivery, Platform, QA, Security.

## Primary Artifacts

Solution Architecture Model, System Map, Reference Architecture, ADR, Feasibility/Constraint Note.

## Anti-Patterns

Redefining Domains locally; designing without Capability binding; architecture that Application Delivery cannot implement on Platform golden paths.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Engineering / Solution Architecture
```
