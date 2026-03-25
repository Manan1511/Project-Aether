export default function LibraryLoading() {
  return (
    <div style={{
      maxWidth: "720px", margin: "0 auto", padding: "2rem",
      minHeight: "calc(100dvh - 5rem)",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "2rem",
      }}>
        <div className="aether-loading" style={{ width: "180px", height: "32px" }} />
        <div className="aether-loading" style={{ width: "90px", height: "40px", borderRadius: "var(--radius-input)" }} />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="aether-loading" style={{
          height: "80px", marginBottom: "0.75rem", borderRadius: "var(--radius-card)",
        }} />
      ))}
    </div>
  );
}
