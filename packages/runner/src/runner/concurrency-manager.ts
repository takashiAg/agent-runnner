export type QueueItem = {
  id: string;
  repository: string;
  issueOrPrKey: string;
};

export class ConcurrencyManager {
  private runningGlobal = 0;
  private readonly runningByRepository = new Map<string, number>();
  private readonly runningKeys = new Set<string>();

  constructor(
    private readonly limits: {
      global: number;
      perRepository: number;
    }
  ) {}

  canStart(item: QueueItem): boolean {
    if (this.runningGlobal >= this.limits.global) return false;
    if ((this.runningByRepository.get(item.repository) ?? 0) >= this.limits.perRepository) {
      return false;
    }
    return !this.runningKeys.has(item.issueOrPrKey);
  }

  start(item: QueueItem): boolean {
    if (!this.canStart(item)) return false;
    this.runningGlobal += 1;
    this.runningByRepository.set(item.repository, (this.runningByRepository.get(item.repository) ?? 0) + 1);
    this.runningKeys.add(item.issueOrPrKey);
    return true;
  }

  finish(item: QueueItem): void {
    if (!this.runningKeys.has(item.issueOrPrKey)) return;
    this.runningGlobal = Math.max(0, this.runningGlobal - 1);
    const nextRepoCount = Math.max(0, (this.runningByRepository.get(item.repository) ?? 0) - 1);
    if (nextRepoCount === 0) {
      this.runningByRepository.delete(item.repository);
    } else {
      this.runningByRepository.set(item.repository, nextRepoCount);
    }
    this.runningKeys.delete(item.issueOrPrKey);
  }
}

