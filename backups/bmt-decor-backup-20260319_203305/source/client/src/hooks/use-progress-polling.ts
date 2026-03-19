import { useState, useEffect, useRef } from "react";

interface ProgressData {
  progress: number;
  message: string;
}

export function useProgressPolling(
  projectId: number | undefined,
  step: number | undefined,
  enabled: boolean
): ProgressData {
  const [data, setData] = useState<ProgressData>({ progress: 0, message: "" });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || !projectId || !step) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setData({ progress: 0, message: "" });
      return;
    }

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/step/${step}/status`);
        if (res.ok) {
          const json = await res.json();
          setData({ progress: json.progress ?? 0, message: json.message ?? "" });
        }
      } catch {}
    };

    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [projectId, step, enabled]);

  return data;
}
