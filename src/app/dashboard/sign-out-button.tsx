"use client";

import { useRef } from "react";

export default function SignOutButton({ action }: { action: () => Promise<void> }) {
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <form action={action}>
      <button
        ref={ref}
        type="submit"
        title="Sign out"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text-mute)",
          padding: "4px",
          display: "grid",
          placeItems: "center",
          borderRadius: 5,
          transition: "color 0.12s",
          flexShrink: 0,
        }}
        onMouseOver={(e) => (e.currentTarget.style.color = "var(--text)")}
        onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-mute)")}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9.5 4.5L12 7l-2.5 2.5M12 7H5M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </form>
  );
}
