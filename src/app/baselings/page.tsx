export default function BaselingsPage() {
  return (
    <iframe
      src="/baseling-proto.html"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        border: "none",
        overflow: "hidden",
      }}
      allow="clipboard-write"
    />
  );
}
