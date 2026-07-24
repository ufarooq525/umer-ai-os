import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { ProjectCatalogSchema } from './schema.js';
import { ProjectRegistryError } from './errors.js';
import type { ProjectCatalog, ProjectRecord, ResolvedProject } from './types.js';

export function resolveProjectsRoot(catalog: ProjectCatalog, env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env[catalog.projectsRootEnv];
  return normalize(fromEnv && fromEnv.length > 0 ? fromEnv : catalog.defaultProjectsRoot);
}

export function resolveProjectPath(root: string, project: ProjectRecord): string {
  return normalize(join(root, project.path));
}

export async function loadCatalogFromFile(catalogPath: string): Promise<ProjectCatalog> {
  let raw: string;
  try {
    raw = await readFile(catalogPath, 'utf8');
  } catch {
    throw new ProjectRegistryError('CATALOG_NOT_FOUND', `Catalog not found: ${catalogPath}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ProjectRegistryError('INVALID_CATALOG', 'Catalog JSON is invalid');
  }
  const parsed = ProjectCatalogSchema.safeParse(json);
  if (!parsed.success) {
    throw new ProjectRegistryError(
      'INVALID_CATALOG',
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }
  const ids = new Set<string>();
  for (const project of parsed.data.projects) {
    if (ids.has(project.projectId)) {
      throw new ProjectRegistryError(
        'DUPLICATE_PROJECT',
        `Duplicate projectId in catalog: ${project.projectId}`,
      );
    }
    ids.add(project.projectId);
  }
  return parsed.data;
}

export function toResolved(root: string, project: ProjectRecord): ResolvedProject {
  return {
    ...project,
    absolutePath: resolveProjectPath(root, project),
  };
}
