import { useState, useEffect, useRef, useCallback } from 'react';

export type ServiceMode = 'local' | 'cloud';

const MACMINI_OLLAMA_URL = 'http://macmini.local:11434';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const CHECK_TIMEOUT = 2000; // 2 seconds
const STORAGE_KEY = 'buddy-service-mode';

export interface ServiceModeState {
  mode: ServiceMode;
  checking: boolean;
  macMiniUrl: string;
  lastChecked: Date | null;
  forceMode: (mode: ServiceMode) => void;
  resetMode: () => void;
}

export function useServiceMode(): ServiceModeState {
  const [mode, setMode] = useState<ServiceMode>('cloud');
  const [checking, setChecking] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const forcedMode = useRef<ServiceMode | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkMacMini = useCallback(async () => {
    try {
      const response = await fetch(`${MACMINI_OLLAMA_URL}/api/tags`, {
        signal: AbortSignal.timeout(CHECK_TIMEOUT),
      });
      if (response.ok) {
        setLastChecked(new Date());
        return true;
      }
    } catch {
      // Mac Mini not reachable
    }
    setLastChecked(new Date());
    return false;
  }, []);

  const determineMode = useCallback(async () => {
    setChecking(true);
    const forced = localStorage.getItem(STORAGE_KEY) as ServiceMode | null;
    if (forced) {
      forcedMode.current = forced;
      setMode(forced);
      setChecking(false);
      return;
    }

    const isAvailable = await checkMacMini();
    setMode(isAvailable ? 'local' : 'cloud');
    setChecking(false);
  }, [checkMacMini]);

  // Initial check
  useEffect(() => {
    determineMode();
  }, [determineMode]);

  // Periodic re-check (only if not forced)
  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      if (forcedMode.current) return;
      const isAvailable = await checkMacMini();
      if (isAvailable) {
        setMode('local');
      }
    }, CHECK_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkMacMini]);

  const forceMode = useCallback((newMode: ServiceMode) => {
    forcedMode.current = newMode;
    localStorage.setItem(STORAGE_KEY, newMode);
    setMode(newMode);
  }, []);

  const resetMode = useCallback(() => {
    forcedMode.current = null;
    localStorage.removeItem(STORAGE_KEY);
    determineMode();
  }, [determineMode]);

  return {
    mode,
    checking,
    macMiniUrl: MACMINI_OLLAMA_URL,
    lastChecked,
    forceMode,
    resetMode,
  };
}
