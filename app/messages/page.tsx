"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  if (!advert) return "Advert conversation";

  return `${advert.year || ""} ${capitaliseWords(advert.make)} ${capitaliseWords(
    advert.model
  )}`.trim();
}

function formatMessageDate(value?: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function MessagesPage() {
  const [userId, setUserId] = useState("");
  const [conversations, setConversations] = useState<any[]>([]);
  const [message, setMessage] = useState("Loading messages...");

  async function fetchConversations() {
    const res = await fetch("/api/messages");

    if (res.status === 401) {
      setMessage("Please log in to view messages.");
      return;
    }

    const result = await res.json();

    if (!res.ok) {
      setMessage(result.error || "Could not load messages.");
      return;
    }

    const { conversations: data, userId: uid } = result;
    setUserId(uid);

    const conversationsWithMessages = (data || [])
      .filter((conversation: any) => conversation.messages?.length > 0)
      .map((conversation: any) => {
        const sortedMessages = [...conversation.messages].sort(
          (a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        const lastMessage = sortedMessages[sortedMessages.length - 1];

        const unreadCount = sortedMessages.filter(
          (msg: any) => msg.sender_id !== uid && !msg.read_at
        ).length;

        return {
          ...conversation,
          lastMessage,
          unreadCount,
        };
      });

    setConversations(conversationsWithMessages);
    setMessage("");
  }

  useEffect(() => {
    const supabase = createClient();

    fetchConversations();

    const channel = supabase
      .channel("messages-inbox-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Messages</p>
        <h1>Your conversations</h1>
        <p>Keep buyer and seller conversations safely on OwnerCars.</p>
      </section>

      <section className="messages-section">
        {message && <p>{message}</p>}

        {!message && conversations.length === 0 && (
          <div className="empty-state">
            <h2>No messages yet</h2>
            <p>Your buyer and seller conversations will appear here.</p>
          </div>
        )}

        <div className="messages-list">
          {conversations.map((conversation: any) => {
            const advert = conversation.adverts;

            return (
              <Link
                key={conversation.id}
                href={`/messages/${conversation.id}`}
                className={
                  conversation.unreadCount > 0
                    ? "message-card unread"
                    : "message-card"
                }
              >
                <div>
                  <p className="eyebrow">Secure conversation</p>
                  <h2>{advertTitle(advert)}</h2>

                  <p className="message-preview">
                    {conversation.lastMessage?.sender_id === userId
                      ? "You: "
                      : ""}
                    {conversation.lastMessage?.message}
                  </p>

                  <p className="message-card-time">
                    {formatMessageDate(conversation.lastMessage?.created_at)}
                  </p>
                </div>

                <div className="message-card-status">
                  {conversation.unreadCount > 0 && (
                    <strong>{conversation.unreadCount}</strong>
                  )}
                  <span>{conversation.status || "open"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}