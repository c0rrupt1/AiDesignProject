"use client";

function ErrorPage({ statusCode }) {
  const code = typeof statusCode === "number" ? statusCode : 500;
  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#020817",
            color: "#E2E8F0",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "3rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              {code}
            </h1>
            <p style={{ fontSize: "1.125rem", opacity: 0.75 }}>
              Something went wrong. Please refresh the page or return home.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}

ErrorPage.getInitialProps = ({ res, err }) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 500;
  return { statusCode };
};

export default ErrorPage;
