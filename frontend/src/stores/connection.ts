// Connection store
import { atom } from 'nanostores';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export const connectionStatus = atom<ConnectionStatus>('disconnected');
export const connectionError = atom<string | null>(null);

export function setConnectionStatus(status: ConnectionStatus, error: string | null = null): void {
    connectionStatus.set(status);
    connectionError.set(error);
}
