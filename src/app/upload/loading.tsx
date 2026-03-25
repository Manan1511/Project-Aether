export default function UploadLoading() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "calc(100dvh - 5rem)", padding: "2rem",
    }}>
      <div style={{ width: "100%", maxWidth: "560px" }}>
        <div className="aether-loading" style={{ width: "240px", height: "32px", margin: "0 auto 0.5rem", borderRadius: "var(--radius-input)" }} />
        <div className="aether-loading" style={{ width: "320px", height: "20px", margin: "0 auto 2rem", borderRadius: "var(--radius-input)" }} />
        <div className="aether-loading" style={{ width: "100%", height: "240px", borderRadius: "var(--radius-card)" }} />
      </div>
    </div>
  );
}
