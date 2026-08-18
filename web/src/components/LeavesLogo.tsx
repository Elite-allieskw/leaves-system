/**
 * Placeholder brand mark — a simple approximation of the Leaves logo
 * (deep green circle + white "leaves" wordmark) built in CSS/SVG so the
 * app has *something* branded to look at.
 *
 * TODO: swap for the real logo file once Leaves shares their vector/PNG asset —
 * do not treat this as the final mark.
 */
export function LeavesLogo({ size = 36 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--leaves-green-600)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      aria-label="Leaves logo placeholder"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 14c0-6 4-10 10-10 0 6-4 10-10 10z"
          fill="white"
        />
        <path
          d="M4 14c3-1 6-3 10-10"
          stroke="var(--leaves-green-600)"
          strokeWidth="0.8"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
