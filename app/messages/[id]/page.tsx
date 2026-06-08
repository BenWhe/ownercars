"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { DOCUMENT_DISPLAY_NAMES, type DocumentType } from "@/lib/vault/documents";
import { messageThreadId } from "@/lib/messages/thread";

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
  return `${advert.year || ""} ${capitaliseWords(advert.make)} ${capitaliseWords(advert.model)}`.trim();
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

  // Vault state
  const [vaultDocs, setVaultDocs] = useState<DocumentType[]>([]);
  const [requestSectionOpen, setRequestSectionOpen] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [vaultNotice, setVaultNotice] = useState("");

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

    // Check if buyer has already requested a document
    const alreadyRequested = (result.messages || []).some(
      (m: any) => m.event_type === "document_request" && m.sender_id === result.userId
    );
    if (alreadyRequested) setHasRequested(true);
  }

  useEffect(() => {
    fetchThread();

    function refreshOnFocus() { fetchThread(); }
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [conversationId]);

  // Fetch vault documents once we know the advert
  useEffect(() => {
    if (!conversation?.advert_id) return;

    fetch(`/api/vault/documents?advert_id=${conversation.advert_id}`)
      .then((r) => r.json())
      .then((result) => {
        if (result.documents) {
          setVaultDocs(result.documents.map((d: any) => d.document_type as DocumentType));
        }
      });
  }, [conversation?.advert_id]);

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

  async function handleRequestDocument(docType: DocumentType) {
    if (!conversation) return;
    setVaultNotice("Sending request...");

    const threadId = messageThreadId(conversation.advert_id, conversation.other_user_id);

    const res = await fetch("/api/vault/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        advert_id: conversation.advert_id,
        document_type: docType,
        thread_id: threadId,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setVaultNotice(result.error || "Could not send request.");
      return;
    }

    setHasRequested(true);
    setRequestSectionOpen(false);
    setVaultNotice("");
    await fetchThread();
  }

  async function handleShareDocument(docType: DocumentType, requestMessageId: string) {
    if (!conversation) return;

    const threadId = messageThreadId(conversation.advert_id, conversation.other_user_id);

    const res = await fetch("/api/vault/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        advert_id: conversation.advert_id,
        document_type: docType,
        thread_id: threadId,
        request_message_id: requestMessageId,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setNotice(result.error || "Could not share document.");
      return;
    }

    await fetchThread();
  }

  const advert = conversation?.adverts;
  const title = advertTitle(advert);
  const isSeller = advert?.seller_id === userId;

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

            // Vault event: document request
            if (msg.event_type === "document_request") {
              return (
                <div key={msg.id} className="vault-event">
                  <span className="vault-event-icon">📄</span>
                  <div className="vault-event-body">
                    <p>{msg.body}</p>
                    <time>{formatMessageDate(msg.created_at)}</time>
                    {isSeller && (
                      <button
                        className="vault-share-btn"
                        onClick={() => handleShareDocument(msg.document_type, msg.id)}
                      >
                        Share {DOCUMENT_DISPLAY_NAMES[msg.document_type as DocumentType] ?? msg.document_type}
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // Vault event: document share
            if (msg.event_type === "document_share") {
              const expired = msg.url_expires_at && new Date(msg.url_expires_at) < new Date();
              return (
                <div key={msg.id} className="vault-event vault-event-share">
                  <span className="vault-event-icon">🔒</span>
                  <div className="vault-event-body">
                    <p>{msg.body}</p>
                    <time>{formatMessageDate(msg.created_at)}</time>
                    {expired ? (
                      <span className="vault-expired">Link expired</span>
                    ) : (
                      <a
                        className="vault-doc-link"
                        href={msg.signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View document →
                      </a>
                    )}
                  </div>
                </div>
              );
            }

            // Regular message
            return (
              <div
                key={msg.id}
                className={ownMessage ? "message-bubble own" : "message-bubble"}
              >
                <p>{msg.body}</p>
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

        {/* Buyer vault request section */}
        {!isSeller && userId && vaultDocs.length > 0 && (
          <div className="vault-request-section">
            {hasRequested ? (
              <p className="vault-requested-notice">
                You have requested documents from this seller.
              </p>
            ) : (
              <>
                <button
                  className="vault-request-toggle"
                  onClick={() => setRequestSectionOpen((o) => !o)}
                >
                  {requestSectionOpen ? "Hide" : "Request a document from the seller"}
                </button>

                {requestSectionOpen && (
                  <div className="vault-request-panel">
                    <div className="vault-notice">
                      <span>⚠️</span>
                      <p>
                        Document requests are monitored by OwnerCars. The seller will decide
                        whether sufficient interaction has taken place and whether they are
                        comfortable sharing before doing so.
                      </p>
                    </div>

                    <div className="vault-request-buttons">
                      {vaultDocs.map((docType) => (
                        <button
                          key={docType}
                          className="vault-request-btn"
                          onClick={() => handleRequestDocument(docType)}
                        >
                          Request {DOCUMENT_DISPLAY_NAMES[docType]}
                        </button>
                      ))}
                    </div>

                    {vaultNotice && <p className="vault-status">{vaultNotice}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
