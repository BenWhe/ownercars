/**
 * Branded placeholder shown on example adverts that have no photos.
 * Pass the same className as the normal photo container so it inherits
 * the right dimensions and border-radius from the existing CSS.
 */
export default function ExampleAdvertPlaceholder({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        background: "#111111",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        overflow: "hidden",
        ...style,
      }}
    >
      <span
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#ffffff",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        OwnerCars<span style={{ color: "#2563EB" }}>.co.uk</span>
      </span>

      <span
        style={{
          display: "block",
          width: 48,
          height: 1,
          background: "#222222",
        }}
      />

      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#555555",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        Example listing
      </span>
    </div>
  );
}
