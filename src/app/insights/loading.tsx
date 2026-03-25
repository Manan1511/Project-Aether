export default function InsightsLoading() {
  return (
    <div style={{
      maxWidth: "720px", margin: "0 auto", padding: "2rem",
      minHeight: "calc(100dvh - 5rem)",
    }}>
      <div className="aether-loading" style={{ width: "120px", height: "32px", marginBottom: "2rem" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "2rem" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="aether-loading" style={{ height: "90px", borderRadius: "var(--radius-card)" }} />
        ))}
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="aether-loading" style={{
          height: "64px", marginBottom: "0.5rem", borderRadius: "var(--radius-card)",
        }} />
      ))}
    </div>
  );
}
