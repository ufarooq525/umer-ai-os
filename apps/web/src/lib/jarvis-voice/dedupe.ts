/**
 * Tracks which assistant message IDs have already been spoken, so a single
 * response is never spoken twice because of a React re-render, an SSE
 * replay, or a duplicated callback.
 */
export class SpokenTracker {
  private readonly spoken = new Set<string>();

  shouldSpeak(id: string): boolean {
    return !this.spoken.has(id);
  }

  markSpoken(id: string): void {
    this.spoken.add(id);
  }

  reset(): void {
    this.spoken.clear();
  }
}
