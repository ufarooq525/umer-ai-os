import { readFile } from 'node:fs/promises';
import { bindMandate, buildMandate } from './mandate.js';
import { parseMarkdownSpec } from './parser.js';
import { registerBinding } from './registry.js';
import { SpecialistSdkError } from './errors.js';
import type { RegistryAdapter, SpecialistMandate, ValidationResult } from './types.js';
import { validateActivationGate } from './validator.js';

export type LoadSpecOptions = {
  requireActivationGate?: boolean;
};

export type LoadedSpec = {
  parsed: ReturnType<typeof parseMarkdownSpec>;
  validation: ValidationResult;
  mandate: SpecialistMandate;
  binding: ReturnType<typeof bindMandate>;
};

export function loadSpecFromString(
  content: string,
  options: LoadSpecOptions = {},
): LoadedSpec {
  const parsed = parseMarkdownSpec(content);
  const validation = validateActivationGate(parsed);

  if (options.requireActivationGate !== false && !validation.valid) {
    throw new SpecialistSdkError(
      'VALIDATION_FAILED',
      `Specialist spec failed activation gate: ${validation.issues.map((i) => i.message).join('; ')}`,
    );
  }

  const mandate = buildMandate(parsed);
  const binding = bindMandate(mandate);
  return { parsed, validation, mandate, binding };
}

export async function loadSpecFromFile(
  filePath: string,
  options: LoadSpecOptions = {},
): Promise<LoadedSpec> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch (err) {
    throw new SpecialistSdkError('SPEC_NOT_FOUND', `Unable to read spec at ${filePath}`, err);
  }
  return loadSpecFromString(content, options);
}

export async function loadAndRegisterSpec(
  content: string,
  adapter: RegistryAdapter,
  options: LoadSpecOptions = {},
): Promise<LoadedSpec> {
  const loaded = loadSpecFromString(content, options);
  await registerBinding(adapter, loaded.binding);
  return loaded;
}
