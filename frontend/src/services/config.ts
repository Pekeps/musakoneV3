/**
 * Runtime configuration loader
 * Loads config from /config.json (served by the static server with env vars)
 * Falls back to import.meta.env for build-time config, then to sensible defaults
 */

export interface AppConfig {
  backendHttpUrl: string;
  backendWsUrl: string;
  authEnabled: boolean;
}

let cachedConfig: AppConfig | null = null;

/**
 * Get application configuration
 * Attempts to load from /config.json for runtime config (Docker deployments)
 * Falls back to Vite env vars or window.location-based defaults
 */
export async function getConfig(): Promise<AppConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Try runtime config first (from server.ts /config.json endpoint)
  try {
    const response = await fetch('/config.json');
    if (response.ok) {
      const runtimeConfig = await response.json();
      cachedConfig = {
        backendHttpUrl: runtimeConfig.VITE_BACKEND_HTTP_URL || getDefaultHttpUrl(),
        backendWsUrl: runtimeConfig.VITE_BACKEND_WS_URL || getDefaultWsUrl(),
        authEnabled: runtimeConfig.VITE_AUTH_ENABLED !== 'false',
      };
      console.log('Loaded runtime config:', cachedConfig);
      return cachedConfig;
    }
  } catch {
    // Runtime config not available, fall back to build-time config
  }

  // Fall back to Vite build-time env or defaults
  cachedConfig = {
    backendHttpUrl: import.meta.env.VITE_BACKEND_HTTP_URL || getDefaultHttpUrl(),
    backendWsUrl: import.meta.env.VITE_BACKEND_WS_URL || getDefaultWsUrl(),
    authEnabled: import.meta.env.VITE_AUTH_ENABLED !== 'false',
  };

  console.log('Using build-time/default config:', cachedConfig);
  return cachedConfig;
}

/**
 * Get config synchronously (must call getConfig() first to initialize)
 */
export function getConfigSync(): AppConfig {
  if (!cachedConfig) {
    // Return defaults if not initialized
    return {
      backendHttpUrl: getDefaultHttpUrl(),
      backendWsUrl: getDefaultWsUrl(),
      authEnabled: true,
    };
  }
  return cachedConfig;
}

function getDefaultHttpUrl(): string {
  return `http://${window.location.hostname}:3001`;
}

function getDefaultWsUrl(): string {
  return `ws://${window.location.hostname}:3001/ws`;
}
