import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * A small single-process repository. The interface can be replaced with Postgres later.
 * Writes are serialized and atomically renamed: readers see either the old or new snapshot.
 * This is NOT a cross-process lock; run one API process against a data file.
 */
export class IndexRepository {
  constructor(file) {
    this.file = file;
    this.current = null;
    this.queue = Promise.resolve();
  }
  async load() {
    try {
      this.current = JSON.parse(await readFile(this.file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    return this.current;
  }
  snapshot() {
    return this.current;
  }
  transaction(update) {
    const operation = this.queue.then(async () => {
      const next = await update(this.current);
      await mkdir(dirname(this.file), { recursive: true });
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(next), 'utf8');
      await rename(temporary, this.file);
      this.current = next;
      return next;
    });
    this.queue = operation.catch(() => undefined); // A failed write must not poison every future write.
    return operation;
  }
}
