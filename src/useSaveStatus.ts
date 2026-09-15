import { useRef, useState } from 'react';

type Status = 'idle' | 'saving' | 'saved' | 'error';

export function useSaveStatus() {
  const [status, setStatus] = useState<Status>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function run(fn: () => Promise<void>) {
    setStatus('saving');
    try {
      await fn();
      setStatus('saved');
    } catch {
      setStatus('error');
    } finally {
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setStatus('idle'), 2500);
    }
  }

  return { status, run };
}
