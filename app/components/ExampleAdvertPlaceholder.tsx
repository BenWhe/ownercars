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
        gap: 6,
        overflow: "hidden",
        ...style,
      }}
    >
      <span
        style={{
          fontSize: 18,
          fontWeight: 900,
          letterSpacing: "-0.04em",
          color: "#ffffff",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        OwnerCars<span style={{ color: "#145cff" }}>.co.uk</span>
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        Example listing
      </span>
    </div>
  );
}
