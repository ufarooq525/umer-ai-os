import { z } from 'zod';
import { withContractHeader } from '../common/envelope.js';
import { ToolIdSchema } from '../common/ids.js';

/** Registry Fabric callable unit — Skill/Tool/Plugin surface. */
export const ToolKindSchema = z.enum(['Skill', 'Tool', 'Plugin']);

export const ToolPermissionSchema = z
  .object({
    networkEgress: z.boolean().default(false),
    filesystem: z.enum(['none', 'read', 'read_write']).default('none'),
    secretsScopes: z.array(z.string()).default([]),
  })
  .strict();

export const ToolContractSchema = withContractHeader({
  kind: z.literal('tool'),
  toolId: ToolIdSchema,
  toolKind: ToolKindSchema,
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1),
  inputSchemaRef: z.string().min(1),
  outputSchemaRef: z.string().min(1),
  permissions: ToolPermissionSchema.default({
    networkEgress: false,
    filesystem: 'none',
    secretsScopes: [],
  }),
  extensionOnly: z.boolean().default(true),
});

export type ToolKind = z.infer<typeof ToolKindSchema>;
export type ToolPermission = z.infer<typeof ToolPermissionSchema>;
export type ToolContract = z.infer<typeof ToolContractSchema>;
