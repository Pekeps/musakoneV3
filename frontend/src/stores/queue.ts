// Queue store
import { atom } from 'nanostores';
import type { QueueTrack } from '../types';

export const queue = atom<QueueTrack[]>([]);
export const queueVersion = atom<number>(0);
export const scrollToCurrentTrack = atom<number>(0);

export function setQueue(tracks: QueueTrack[]): void {
  queue.set(tracks);
  queueVersion.set(queueVersion.get() + 1);
}

export function addToQueue(track: QueueTrack): void {
  queue.set([...queue.get(), track]);
  queueVersion.set(queueVersion.get() + 1);
}

export function removeFromQueue(tlid: number): void {
  queue.set(queue.get().filter((t) => t.tlid !== tlid));
  queueVersion.set(queueVersion.get() + 1);
}

export function triggerScrollToCurrent(): void {
  scrollToCurrentTrack.set(Date.now());
}

export function clearQueue(): void {
  queue.set([]);
  queueVersion.set(queueVersion.get() + 1);
}
