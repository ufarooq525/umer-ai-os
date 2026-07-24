import { join } from 'node:path';
import {
  loadCatalogFromFile,
  resolveProjectsRoot,
  toResolved,
} from './catalog.js';
import { ProjectRegistryError } from './errors.js';
import type { ProjectCatalog, ProjectRecord, ResolvedProject } from './types.js';

export class ProjectRegistry {
  private readonly catalog: ProjectCatalog;
  private readonly root: string;
  private readonly byId: Map<string, ProjectRecord>;

  constructor(catalog: ProjectCatalog, env: NodeJS.ProcessEnv = process.env) {
    this.catalog = catalog;
    this.root = resolveProjectsRoot(catalog, env);
    this.byId = new Map(catalog.projects.map((p) => [p.projectId, p]));
  }

  getProjectsRoot(): string {
    return this.root;
  }

  list(options?: { includeInactive?: boolean }): ResolvedProject[] {
    const includeInactive = options?.includeInactive ?? false;
    return this.catalog.projects
      .filter((p) => includeInactive || p.status === 'active')
      .map((p) => toResolved(this.root, p));
  }

  get(projectId: string): ResolvedProject {
    const project = this.byId.get(projectId);
    if (!project) {
      throw new ProjectRegistryError('PROJECT_NOT_FOUND', `Unknown project: ${projectId}`);
    }
    return toResolved(this.root, project);
  }

  requireActive(projectId: string): ResolvedProject {
    const project = this.get(projectId);
    if (project.status !== 'active') {
      throw new ProjectRegistryError(
        'PROJECT_INACTIVE',
        `Project ${projectId} is ${project.status}`,
      );
    }
    return project;
  }
}

export async function createProjectRegistry(options?: {
  catalogPath?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<ProjectRegistry> {
  const catalogPath =
    options?.catalogPath ??
    join(process.cwd(), 'projects', 'catalog.json');
  const catalog = await loadCatalogFromFile(catalogPath);
  return new ProjectRegistry(catalog, options?.env ?? process.env);
}
