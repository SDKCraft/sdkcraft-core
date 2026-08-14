import React from "react";

const features = [
  {
    title: "SDK generation",
    desc: "Upload an OpenAPI spec and generate SDK files for TypeScript, Python, Dart, Go, and Java.",
  },
  {
    title: "Developer docs",
    desc: "Create a starter README from the same API contract so developers can understand the SDK faster.",
  },
  {
    title: "Change detection",
    desc: "Compare old and new API versions to spot breaking changes before they surprise SDK users.",
  },
];

const steps = [
  { n: "01", title: "Upload your spec", desc: "Use an OpenAPI JSON or YAML file." },
  { n: "02", title: "Pick languages", desc: "Choose one or more SDK targets." },
  { n: "03", title: "Download the SDK", desc: "Preview files, download a ZIP, or export to GitHub." },
];

type LandingProps = {
  onStart: () => void;
  user: any;
  onLogin: () => void;
  onLogout: () => void;
  onPricing: () => void;
};

export default function Landing({ onStart, user, onLogin, onLogout, onPricing }: LandingProps) {
  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
      <nav style={{ borderBottom: "1px solid #111", padding: "0 32px", minHeight: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", position: "sticky", top: 0, background: "#000", zIndex: 100, flexWrap: "wrap" }}>
        <button onClick={onStart} style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0 }}>
          <span style={{ color: "#22c55e", fontSize: "18px", fontWeight: 700 }}>&lt;/&gt;</span>
          <span style={{ fontWeight: 700, fontSize: "16px" }}>SDKCraft</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <a href="https://github.com/SDKCraft/api-to-sdk" target="_blank" rel="noreferrer" style={{ color: "#888", fontSize: "14px", textDecoration: "none" }}>GitHub</a>
          <button onClick={onPricing} style={{ background: "none", border: "none", color: "#888", fontSize: "14px", cursor: "pointer" }}>Pricing</button>
          <a href="https://github.com/SDKCraft/api-to-sdk/issues/new" target="_blank" rel="noreferrer" style={{ color: "#888", fontSize: "14px", textDecoration: "none" }}>Report a bug</a>

          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {user.user_metadata?.avatar_url && (
                <img src={user.user_metadata.avatar_url} alt="GitHub avatar" style={{ width: "28px", height: "28px", borderRadius: "50%" }} />
              )}
              <span style={{ color: "#888", fontSize: "14px" }}>{user.user_metadata?.user_name}</span>
              <button onClick={onStart} style={{ background: "#22c55e", color: "#000", border: "none", padding: "8px 18px", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Dashboard</button>
              <button onClick={onLogout} style={{ background: "none", color: "#aaa", border: "1px solid #333", padding: "8px 14px", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>Logout</button>
            </div>
          ) : null /* "Sign in with GitHub" button temporarily hidden until account system (Pro tier + history) is fully built. */}
        </div>
      </nav>

      <main>
        <section style={{ maxWidth: "1120px", margin: "0 auto", padding: "88px 24px 72px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "40px", alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-block", background: "#111", border: "1px solid #222", borderRadius: "999px", padding: "6px 16px", fontSize: "13px", color: "#888", marginBottom: "28px" }}>
              Open source. Free to try. No signup required.
            </div>
            <h1 style={{ fontSize: "56px", fontWeight: 800, lineHeight: 1.05, margin: "0 0 24px", letterSpacing: 0 }}>
              Turn OpenAPI specs into production-ready SDKs
            </h1>
            <p style={{ fontSize: "18px", color: "#aaa", lineHeight: 1.7, margin: "0 0 36px", maxWidth: "580px" }}>
              SDKCraft helps API teams generate client libraries, starter docs, and change reports from a single API contract.
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button onClick={onStart} style={{ background: "#22c55e", color: "#000", border: "none", padding: "14px 28px", borderRadius: "8px", fontSize: "16px", fontWeight: 800, cursor: "pointer" }}>
                Generate an SDK
              </button>
              <a href="https://github.com/SDKCraft/api-to-sdk" target="_blank" rel="noreferrer" style={{ background: "#111", color: "#fff", border: "1px solid #222", padding: "14px 28px", borderRadius: "8px", fontSize: "16px", fontWeight: 700, textDecoration: "none" }}>
                View on GitHub
              </a>
            </div>
          </div>

          <div style={{ border: "1px solid #222", borderRadius: "8px", background: "#080808", overflow: "hidden" }}>
            <div style={{ borderBottom: "1px solid #222", padding: "12px 16px", color: "#888", fontSize: "13px", display: "flex", justifyContent: "space-between" }}>
              <span>SDK preview</span>
              <span>TypeScript</span>
            </div>
            <pre style={{ margin: 0, padding: "22px", overflowX: "auto", color: "#d1d5db", fontSize: "13px", lineHeight: 1.7 }}>
{`import { createClient } from "./sdk";

const client = createClient({
  apiKey: process.env.API_KEY,
});

const users = await client.users.list({
  limit: 25,
});

console.log(users.data);`}
            </pre>
          </div>
        </section>

        <section style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 24px 88px" }}>
          <h2 style={{ textAlign: "center", fontSize: "32px", fontWeight: 800, marginBottom: "36px", letterSpacing: 0 }}>
            Built for fast API launches
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px" }}>
            {features.map((feature) => (
              <div key={feature.title} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "24px" }}>
                <div style={{ fontWeight: 800, fontSize: "16px", marginBottom: "10px" }}>{feature.title}</div>
                <div style={{ color: "#888", fontSize: "14px", lineHeight: 1.7 }}>{feature.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ maxWidth: "760px", margin: "0 auto", padding: "0 24px 88px" }}>
          <h2 style={{ textAlign: "center", fontSize: "32px", fontWeight: 800, marginBottom: "36px", letterSpacing: 0 }}>
            How it works
          </h2>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {steps.map((step, index) => (
              <div key={step.n} style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: "1px solid #22c55e44", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e", fontSize: "13px", fontWeight: 800, flexShrink: 0 }}>{step.n}</div>
                  {index < steps.length - 1 && <div style={{ width: "1px", height: "40px", background: "#1a1a1a" }} />}
                </div>
                <div style={{ paddingTop: "8px", paddingBottom: "32px" }}>
                  <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "6px" }}>{step.title}</div>
                  <div style={{ color: "#888", fontSize: "14px" }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ borderTop: "1px solid #111", padding: "72px 24px", textAlign: "center" }}>
          <h2 style={{ fontSize: "36px", fontWeight: 800, marginBottom: "16px", letterSpacing: 0 }}>
            Generate your first SDK before your next release
          </h2>
          <p style={{ color: "#888", marginBottom: "32px", fontSize: "16px" }}>Upload a spec and try the full flow in the browser.</p>
          <button onClick={onStart} style={{ background: "#22c55e", color: "#000", border: "none", padding: "16px 36px", borderRadius: "8px", fontSize: "18px", fontWeight: 800, cursor: "pointer" }}>
            Start free
          </button>
        </section>
      </main>

      <footer style={{ borderTop: "1px solid #111", padding: "24px 32px", display: "flex", justifyContent: "space-between", gap: "16px", color: "#555", fontSize: "13px", flexWrap: "wrap" }}>
        <span>&lt;/&gt; SDKCraft - Open source SDK generator</span>
        <a href="https://github.com/SDKCraft/api-to-sdk" target="_blank" rel="noreferrer" style={{ color: "#555", textDecoration: "none" }}>GitHub</a>
      </footer>
    </div>
  );
}
