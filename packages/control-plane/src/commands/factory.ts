import { CeoCommandService, type CeoCommandServiceOptions, type CeoCommandServicePorts } from './service.js';

export function createCeoCommandService(
  ports: CeoCommandServicePorts,
  options: CeoCommandServiceOptions,
): CeoCommandService {
  return new CeoCommandService(ports, options);
}
