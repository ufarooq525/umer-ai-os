# Bounded Context: Identity & Access Control

Governed by `Departments/Security/SECURITY_CHARTER.md`.

## Purpose

Own AuthN/AuthZ **control requirements and assurance** for enterprise identity Capabilities.

## Owns

Identity & Access Control Specs; assurance criteria for identity controls.

## Does Not Own

Identity Service implementation code (Engineering Application Delivery under these Specs); customer segment strategy (Business).

## Interfaces

Constrains Eng/Design (login, permissions, consent); Verification Procedures to QA.

## Primary Artifacts

Identity & Access Control Spec.

## Anti-Patterns

Security writing all identity code as a shadow Eng team; Eng inventing auth without Spec.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Security / Identity & Access Control
```
