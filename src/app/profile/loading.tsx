export default function ProfileLoading() {
  return (
    <div style={{
      maxWidth: "600px", margin: "0 auto", padding: "2rem",
      minHeight: "calc(100dvh - 5rem)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div className="aether-loading" style={{ width: "100px", height: "32px" }} />
        <div className="aether-loading" style={{ width: "32px", height: "32px", borderRadius: "50%" }} />
      </div>
      <div className="aether-loading" style={{ height: "100px", marginBottom: "1.5rem", borderRadius: "var(--radius-card)" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="aether-loading" style={{ height: "90px", borderRadius: "var(--radius-card)" }} />
        ))}
      </div>
    </div>
  );
}
