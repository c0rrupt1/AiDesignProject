import { useMemo } from "react";

function useGreeting(): string {
  return useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    if (hours < 12) {
      return "Good morning";
    }
    if (hours < 18) {
      return "Good afternoon";
    }
    return "Good evening";
  }, []);
}

export default function App() {
  const greeting = useGreeting();

  return (
    <div
      style={{
        margin: "0 auto",
        maxWidth: "960px",
        padding: "6rem 1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          border: "1px solid rgba(56,189,248,0.4)",
          background: "rgba(56,189,248,0.1)",
          color: "rgb(7,89,133)",
          fontSize: "0.7rem",
          fontWeight: 600,
          letterSpacing: "0.35em",
          textTransform: "uppercase",
          display: "inline-flex",
          alignItems: "center",
          padding: "0.35rem 0.9rem",
          borderRadius: "999px",
        }}
      >
        CRM Preview
      </span>
      <h1
        style={{
          fontSize: "3rem",
          lineHeight: 1.1,
          margin: 0,
          color: "#0f172a",
        }}
      >
        {greeting}, deckd crew.
      </h1>
      <p
        style={{
          maxWidth: "38rem",
          margin: "0",
          color: "#1e293b",
          fontSize: "1.05rem",
        }}
      >
        This Vite-powered workspace will replace the existing Next.js CRM. Start
        carving out new dashboards, workflows, and Supabase flows right here
        without impacting the public site. Everything is intentionally minimal
        until we flesh out the new experience.
      </p>
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          width: "100%",
        }}
      >
        <Card
          title="Next steps"
          items={[
            "Map Supabase tables to new data hooks",
            "Sketch refreshed Dashboard UI/UX",
            "Plan Test/QA workflow before launch",
          ]}
        />
        <Card
          title="Shared modules"
          items={[
            "Port Supabase client factory",
            "Extract auth/profile helpers",
            "Reuse styling tokens where possible",
          ]}
        />
        <Card
          title="Setup checklist"
          items={[
            "Add env vars for Supabase keys",
            "Connect CRM repo path to Vercel",
            "Wire subdomain (crm.deckd.us)",
          ]}
        />
      </div>
    </div>
  );
}

function Card({ title, items }: { title: string; items: string[] }) {
  return (
    <section
      style={{
        borderRadius: "24px",
        padding: "1.6rem",
        background: "white",
        boxShadow: "0 18px 40px -32px rgba(15,23,42,0.6)",
        border: "1px solid rgba(15,23,42,0.08)",
      }}
    >
      <h2
        style={{
          margin: "0 0 0.75rem",
          fontSize: "1.1rem",
          color: "#0f172a",
        }}
      >
        {title}
      </h2>
      <ul
        style={{
          margin: 0,
          padding: 0,
          display: "grid",
          gap: "0.5rem",
          listStyle: "none",
        }}
      >
        {items.map((item) => (
          <li
            key={item}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              fontSize: "0.95rem",
              color: "#1f2937",
            }}
          >
            <span
              aria-hidden
              style={{
                width: "0.45rem",
                height: "0.45rem",
                borderRadius: "999px",
                background: "rgba(56,189,248,1)",
                boxShadow: "0 0 0 4px rgba(56,189,248,0.12)",
              }}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
