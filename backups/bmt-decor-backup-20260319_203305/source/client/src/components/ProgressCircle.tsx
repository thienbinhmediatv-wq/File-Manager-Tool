interface ProgressCircleProps {
  progress: number;
  message: string;
}

export function ProgressCircle({ progress, message }: ProgressCircleProps) {
  const RADIUS = 54;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const offset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;

  return (
    <div
      className="rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center"
      style={{ borderColor: "rgba(232,131,12,0.3)", background: "rgba(232,131,12,0.05)" }}
      data-testid="step-progress-circle"
    >
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="rgba(232,131,12,0.15)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r={RADIUS} fill="none"
            stroke="#e8830c" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.7s ease-in-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold" style={{ color: "#e8830c" }} data-testid="text-progress-pct">
            {progress}%
          </span>
        </div>
      </div>
      {message && (
        <p className="mt-4 font-semibold text-sm" style={{ color: "#e8830c" }} data-testid="text-phase-label">
          {message}
        </p>
      )}
    </div>
  );
}
