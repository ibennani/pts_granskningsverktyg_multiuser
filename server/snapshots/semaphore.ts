/**
 * @fileoverview Enkel in-process semaphore för snapshot-köer.
 */
export class Semaphore {
    private active = 0;
    private readonly queue: Array<() => void> = [];

    constructor(private readonly max: number) {}

    get waiting_count(): number {
        return this.queue.length;
    }

    get active_count(): number {
        return this.active;
    }

    async acquire(): Promise<void> {
        if (this.active < this.max) {
            this.active += 1;
            return;
        }
        await new Promise<void>((resolve) => {
            this.queue.push(resolve);
        });
        this.active += 1;
    }

    release(): void {
        this.active = Math.max(0, this.active - 1);
        const next = this.queue.shift();
        if (next) next();
    }
}
