# Runtime Domain: Registry Fabric

Governed by `Runtime/RUNTIME_PLATFORM_CHARTER.md`. Merges Tool Registry, Skill Registry, Plugin manifests; hosts Capability *Resolver* (not Capability registry ownership).

## Purpose
Provide one versioned registry plane for callable units (tools, skills, plugin capabilities) and resolve Enterprise Architecture Capability nouns to Runtime providers — without owning EA taxonomy.

## Owns
Tool manifests; Skill manifests; Plugin capability manifests; version/compatibility metadata; Capability Resolver index (Capability ID → provider binding); deprecation and replacement pointers.

## Explicitly Does Not Own
Capability/Domain definitions (`Enterprise_Architecture/`); Agent role specs (`Core/`); tool *business* purpose (Departments); Security control catalog (Security Dept).

## Inputs
EA Capability IDs; Department/provider registrations; Extension Runtime plugin declarations; Trust scopes; Model Routing model IDs (as dependencies of skills).

## Outputs
Resolved callable descriptors; compatibility errors; registry change events.

## Interfaces
EA (nouns); Agent Runtime / Orchestration / Extension (lookup); Trust (scopes); Audit (registry mutations).

## Runtime Artifacts
Tool Manifest, Skill Manifest, Plugin Manifest, Capability Binding Record.

## Runtime Events
`registry.upserted`, `registry.deprecated`, `registry.resolve.hit|miss`, `registry.binding.changed`.

## Dependencies
Kernel, Trust, Audit; Extension Runtime for dynamic plugins.

## Failure Modes
Shadow registries per Department; resolving unregistered Capabilities; breaking changes without major version; stale bindings after Department sunset.

## Metrics
Resolve miss rate; schema validation fail rate; deprecated-call usage; binding freshness lag.

## Anti-Patterns
Runtime inventing Capabilities not in EA; Tools without Trust scopes; Skills that embed prompts as ungoverned source of truth (prompt packs are not architecture).

## Metadata
```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
```
