"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CONTACT_REDACTION_NOTICE, redactContactDetails } from "@/lib/content/redaction";

function capitaliseWords(str?: string) {
  if (!str) return "";
  return str
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function advertTitle(advert: any) {
  if (!advert) return "Conversation";

  return `${advert.year || ""} ${capitaliseWords(advert.make)} ${capitaliseWords(
    advert.model
  )}`.trim();
}

function formatMessageDate(value?: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function MessageThreadPage() {
  const params = useParams();
  const conversationId = params.id as string;
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [userId, setUserId] = useState("");
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("Loading conversation...");

  async function fetchThread() {
    const res = await fetch(`/api/messages/${conversationId}`);

    if (res.status === 401) {
      setNotice("Please log in to view this conversation.");
      return;
    }

    if (res.status === 403) {
      setNotice("Not authorised to view this conversation.");
      return;
    }

    const result = await res.json();

    if (!res.ok) {
      setNotice(result.error || "Could not load conversation.");
      return;
    }

    setUserId(result.userId);
    setConversation(result.conversation);
    setMessages(result.messages || []);
    setNotice("");
    window.dispatchEvent(new Event("ownercars:messages-read"));
  }

  useEffect(() => {
    fetchThread();

    function refreshOnFocus() {
      fetchThread();
    }

    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();

    const cleanBody = body.trim();
    if (!cleanBody || !conversation) return;

    const res = await fetch(`/api/messages/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: cleanBody }),
    });

    const result = await res.json();

    if (!res.ok) {
      setNotice(result.error || "Could not send message.");
      return;
    }

    setBody("");
    await fetchThread();
  }

  const advert = conversation?.adverts;
  const title = advertTitle(advert);

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Secure messaging</p>
        <h1>{title}</h1>
        <p>
          Keep messages on OwnerCars to protect contact details, vehicle
          registration information and viewing details.
        </p>
      </section>

      <section className="message-thread-section">
        {notice && <p className="message-notice">{notice}</p>}

        <div className="message-thread">
          {messages.length === 0 && !notice && (
            <p className="message-empty">
              No messages yet. Start the conversation safely on OwnerCars.
            </p>
          )}

          {messages.map((msg: any) => {
            const ownMessage = msg.sender_id === userId;
            const safeBody = redactContactDetails(msg.body);
            const wasRedacted = msg.contact_details_redacted || safeBody.redacted;

            return (
              <div
                key={msg.id}
                className={ownMessage ? "message-bubble own" : "message-bubble"}
              >
                <p>{safeBody.text}</p>
                {wasRedacted && <p className="redaction-notice">{CONTACT_REDACTION_NOTICE}</p>}
                <time>{formatMessageDate(msg.created_at)}</time>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        <form className="message-compose" onSubmit={handleSend}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message..."
          />

          <button type="submit" disabled={!body.trim()}>
            Send message
          </button>
        </form>
      </section>
    </main>
  );
}
