/**
 * Monotonic per-path revision tracking for asynchronous index reads.
 *
 * A token represents the newest refresh/invalidation operation started for a
 * path. Results may commit only while their token remains current.
 */
export class FileRevisionTracker {
  private readonly revisions = new Map<string, number>();
  private sequence = 0;

  begin(path: string): number {
    const token = ++this.sequence;
    this.revisions.set(path, token);
    return token;
  }

  invalidate(path: string): number {
    return this.begin(path);
  }

  current(path: string): number {
    return this.revisions.get(path) ?? 0;
  }

  isCurrent(path: string, token: number): boolean {
    return this.current(path) === token;
  }

  snapshot(): Map<string, number> {
    return new Map(this.revisions);
  }

  changedPathsSince(snapshot: ReadonlyMap<string, number>): string[] {
    const changed: string[] = [];
    for (const [path, revision] of this.revisions) {
      if ((snapshot.get(path) ?? 0) !== revision) changed.push(path);
    }
    return changed;
  }
}
