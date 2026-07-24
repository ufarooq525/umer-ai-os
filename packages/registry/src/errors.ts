export type ProjectRegistryErrorCode =
  | 'CATALOG_NOT_FOUND'
  | 'INVALID_CATALOG'
  | 'PROJECT_NOT_FOUND'
  | 'PROJECT_INACTIVE'
  | 'DUPLICATE_PROJECT'
  | 'INVALID_INTAKE';

export class ProjectRegistryError extends Error {
  readonly code: ProjectRegistryErrorCode;

  constructor(code: ProjectRegistryErrorCode, message: string) {
    super(message);
    this.name = 'ProjectRegistryError';
    this.code = code;
  }
}
