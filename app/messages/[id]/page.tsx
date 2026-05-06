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
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      setNotice("Please log in to view this conversation.");
      return;
    }

    setUserId(user.id);

    const { data: convo, error: convoError } = await supabase
      .from("conversations")
      .select(`
        *,
        adverts (
          id,
          year,
          make,
          model,
          price
        )
      `)
      .eq("id", conversationId)
      .single();

    if (convoError) {
      setNotice(convoError.message);
      return;
    }

    setConversation(convo);

    const { data: messageData, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      setNotice(messagesError.message);
      return;
    }

    setMessages(messageData || []);
    setNotice("");

    await markIncomingAsRead(user.id);
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
    if (!cleanBody || !conversation) return;

    if (containsContactDetails(cleanBody)) {
      await supabase.from("buyer_security_events").insert({
        buyer_id: conversation.buyer_id,
        seller_id: conversation.seller_id,
        advert_id: conversation.advert_id,
        conversation_id: conversation.id,
        event_type: "off_platform_contact_attempt",
        event_status: "recorded",
        message_excerpt: cleanBody.slice(0, 180),
      });

      setNotice(
        "For safety, please keep contact details on OwnerCars until both parties are ready."
      );
      return;
    }

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

          {messages.map((msg) => {
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
          />

          <button type="submit">Send message</button>
        </form>
      </section>
    </main>
  );
}