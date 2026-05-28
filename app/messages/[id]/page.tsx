"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

function containsContactDetails(text: string) {
  const phoneRegex = /(\+?\d[\d\s().-]{7,}\d)/;
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const whatsappRegex = /(whatsapp|wa\.me)/i;

  return phoneRegex.test(text) || emailRegex.test(text) || whatsappRegex.test(text);
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
  const supabase = createClient();
  const params = useParams();
  const conversationId = params.id as string;
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [userId, setUserId] = useState("");
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("Loading conversation...");

  const blockedContactDetails = containsContactDetails(body);

  async function markIncomingAsRead(currentUserId: string) {
    const { error } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .neq("sender_id", currentUserId)
      .is("read_at", null);

    if (!error) {
      window.dispatchEvent(new Event("ownercars:messages-read"));
    }
  }

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

    await markIncomingAsRead(result.userId);
  }

  useEffect(() => {
    fetchThread();

    const channel = supabase
      .channel(`message-thread-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          fetchThread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();

    const cleanBody = body.trim();
    if (!cleanBody || !conversation || blockedContactDetails) return;

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      message: cleanBody,
    });

    if (error) {
      setNotice(error.message);
      return;
    }

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    setBody("");
    await fetchThread();
  }

  useEffect(() => {
    async function recordBlockedAttempt() {
      const cleanBody = body.trim();

      if (!blockedContactDetails || !conversation || cleanBody.length < 6) return;

      await supabase.from("buyer_security_events").insert({
        buyer_id: conversation.buyer_id,
        seller_id: conversation.seller_id,
        advert_id: conversation.advert_id,
        conversation_id: conversation.id,
        event_type: "off_platform_contact_attempt",
        event_status: "recorded",
        message_excerpt: cleanBody.slice(0, 180),
      });
    }

    const timer = window.setTimeout(recordBlockedAttempt, 800);

    return () => window.clearTimeout(timer);
  }, [blockedContactDetails, body, conversation]);

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

            return (
              <div
                key={msg.id}
                className={ownMessage ? "message-bubble own" : "message-bubble"}
              >
                <p>{msg.message}</p>
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
            className={blockedContactDetails ? "message-input-warning" : ""}
          />

          {blockedContactDetails && (
            <p className="message-safety-warning">
              For seller and buyer protection, phone numbers, email addresses and
              WhatsApp links cannot be sent at this stage. Please continue the
              conversation through OwnerCars.
            </p>
          )}

          <button type="submit" disabled={!body.trim() || blockedContactDetails}>
            Send message
          </button>
        </form>
      </section>
    </main>
  );
}