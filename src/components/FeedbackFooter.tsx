"use client";

import { useState } from "react";

const TYPES = ["Bug", "Feature Request", "Feedback", "Other"] as const;

export function FeedbackFooter() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>(TYPES[0]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit() {
    if (message.trim().length < 5) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: type.toLowerCase(),
          message: message.trim(),
          page: window.location.pathname,
        }),
      });
      if (res.ok) {
        setStatus("sent");
        setMessage("");
        setTimeout(() => { setStatus("idle"); setOpen(false); }, 2000);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <footer className="w-full mt-auto border-t border-white/5 bg-gray-950/80">
      <div className="max-w-4xl mx-auto px-4 py-4">
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="w-full text-center text-xs tracking-widest uppercase opacity-30 hover:opacity-60 transition-opacity py-2"
          >
            Have feedback? Report a bug or suggest a feature
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs tracking-widest uppercase opacity-50">
                Send us feedback
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-xs opacity-30 hover:opacity-60"
              >
                Close
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className="px-3 py-1 rounded-full text-xs tracking-wider transition-all"
                  style={{
                    background: type === t ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${type === t ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.1)"}`,
                    color: type === t ? "#c9a84c" : "#888",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the issue or idea in detail..."
              maxLength={2000}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-amber-700/50"
            />

            <div className="flex items-center justify-between">
              <span className="text-[0.6rem] opacity-20">
                {message.length}/2000
              </span>
              <button
                onClick={submit}
                disabled={message.trim().length < 5 || status === "sending"}
                className="px-4 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all disabled:opacity-20"
                style={{
                  background: status === "sent" ? "rgba(34,197,94,0.2)" : "rgba(201,168,76,0.15)",
                  border: `1px solid ${status === "sent" ? "rgba(34,197,94,0.5)" : "rgba(201,168,76,0.4)"}`,
                  color: status === "sent" ? "#22c55e" : "#c9a84c",
                }}
              >
                {status === "idle" && "Send"}
                {status === "sending" && "Sending..."}
                {status === "sent" && "Sent!"}
                {status === "error" && "Try Again"}
              </button>
            </div>
          </div>
        )}

        <div className="text-center mt-3 text-[0.55rem] opacity-15 tracking-widest uppercase">
          Tales of Tasern &middot; memefortrees.com
        </div>
      </div>
    </footer>
  );
}
