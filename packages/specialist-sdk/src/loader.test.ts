import { describe, expect, it } from 'vitest';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadAndRegisterSpec,
  loadSpecFromFile,
  loadSpecFromString,
} from './loader.js';
import { InMemoryRegistryAdapter } from './registry.js';
import { SpecialistSdkError } from './errors.js';
import { buildValidSpecialistSpec } from './test-utils.js';

describe('loader', () => {
  it('loads and validates spec from string', () => {
    const loaded = loadSpecFromString(buildValidSpecialistSpec());
    expect(loaded.validation.valid).toBe(true);
    expect(loaded.mandate.contract.name).toBe('Application Delivery Specialist');
    expect(loaded.binding.specialistId).toBe('eng.app-delivery');
  });

  it('throws when activation gate fails by default', () => {
    expect(() => loadSpecFromString(buildValidSpecialistSpec({ omitSection: 'E5' }))).toThrow(
      SpecialistSdkError,
    );
  });

  it('allows skipping activation gate', () => {
    const loaded = loadSpecFromString(buildValidSpecialistSpec({ omitSection: 'E5' }), {
      requireActivationGate: false,
    });
    expect(loaded.validation.valid).toBe(false);
    expect(loaded.mandate.contract.specialistId).toBe('eng.app-delivery');
  });

  it('loads spec from file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'umer-spec-'));
    const filePath = join(dir, 'specialist.md');
    await writeFile(filePath, buildValidSpecialistSpec(), 'utf8');
    const loaded = await loadSpecFromFile(filePath);
    expect(loaded.validation.valid).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });

  it('registers loaded spec', async () => {
    const adapter = new InMemoryRegistryAdapter();
    const loaded = await loadAndRegisterSpec(buildValidSpecialistSpec(), adapter);
    expect(adapter.get(loaded.binding.specialistId)?.specVersion).toBe('1.0.0');
  });

  it('loads spec from missing file', async () => {
    await expect(loadSpecFromFile('missing/spec.md')).rejects.toThrow(SpecialistSdkError);
  });

  it('rejects vendor model ids', () => {
    expect(() =>
      loadSpecFromString(`${buildValidSpecialistSpec()}\n\nUses gpt-4 internally.`),
    ).toThrow(SpecialistSdkError);
  });
});
