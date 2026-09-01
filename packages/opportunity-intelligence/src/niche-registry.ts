import { NicheDefinitionSchema, type NicheDefinition } from '@umer/contracts';

export interface NicheRegistry {
  upsert(niche: NicheDefinition): Promise<void>;
  get(id: string): Promise<NicheDefinition | undefined>;
  list(): Promise<NicheDefinition[]>;
}

export class InMemoryNicheRegistry implements NicheRegistry {
  private readonly niches = new Map<string, NicheDefinition>();

  async upsert(niche: NicheDefinition): Promise<void> {
    const validated = NicheDefinitionSchema.parse(niche);
    this.niches.set(validated.id, validated);
  }

  async get(id: string): Promise<NicheDefinition | undefined> {
    return this.niches.get(id);
  }

  async list(): Promise<NicheDefinition[]> {
    return [...this.niches.values()];
  }
}
