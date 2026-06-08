"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LISTING_PRICE_GBP } from "@/lib/payments/config";
import { DOCUMENT_DISPLAY_NAMES, type DocumentType } from "@/lib/vault/documents";

export default function EditAdvertPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [mileage, setMileage] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [paid, setPaid] = useState(false);
  const [message, setMessage] = useState("Loading advert...");
  const [photos, setPhotos] = useState<any[]>([]);
  const [postcode, setPostcode] = useState("");
  const [postcodeError, setPostcodeError] = useState("");
  const [vaultDocs, setVaultDocs] = useState<Set<DocumentType>>(new Set());
  const [vaultStatus, setVaultStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchAdvert() {
      const res = await fetch(`/api/adverts/${params.id}`);

      if (res.status === 401) {
        setMessage("You must be logged in to edit this advert.");
        return;
      }

      if (res.status === 403) {
        setMessage("Not authorised to manage this advert.");
        return;
      }

      const result = await res.json();

      if (!res.ok) {
        setMessage(result.error || "Could not load advert.");
        return;
      }

      const data = result.advert;
      setTitle(data.title || "");
      setPrice(String(data.price || ""));
      setMileage(String(data.mileage || ""));
      setDescription(data.description || "");
      setStatus(data.status || "draft");
      setPaid(Boolean(data.paid));
      // Photos are included in the advert response — no separate browser-client call.
      setPostcode(data.postcode || "");
      setPhotos(data.advert_photos || []);
      setMessage("");

      // Load vault documents
      const vaultRes = await fetch(`/api/vault/documents?advert_id=${params.id}`);
      if (vaultRes.ok) {
        const vaultResult = await vaultRes.json();
        const uploaded = new Set<DocumentType>(
          (vaultResult.documents || []).map((d: any) => d.document_type as DocumentType)
        );
        setVaultDocs(uploaded);
      }
    }

    if (params.id) fetchAdvert();
  }, [params.id]);

  async function uploadPhotos(files: FileList | null) {
    if (!files || !params.id) return;

    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );

    if (imageFiles.length === 0) return;

    if (photos.length + imageFiles.length > 10) {
      setMessage("You can upload up to 10 photos per advert.");
      return;
    }

    setMessage("Uploading photos...");

    let updatedPhotos: any[] = [...photos];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("advertId", params.id as string);
      formData.append("sortOrder", String(photos.length + i));

      const res = await fetch("/api/upload-photo", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        setMessage(result.error || "Photo upload failed. Please try again.");
        return;
      }

      updatedPhotos = result.photos ?? updatedPhotos;
    }

    setPhotos(updatedPhotos);
    setMessage("");
  }

  async function deletePhoto(photoId: string) {
    const res = await fetch("/api/upload-photo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    });

    const result = await res.json();

    if (!res.ok) {
      setMessage(result.error || "Could not delete photo. Please try again.");
      return;
    }

    setPhotos(result.photos ?? []);
  }

  async function movePhoto(index: number, direction: "left" | "right") {
    const newIndex = direction === "left" ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= photos.length) return;

    const currentPhoto = photos[index];
    const targetPhoto = photos[newIndex];

    const { error: firstError } = await supabase
      .from("advert_photos")
      .update({ sort_order: targetPhoto.sort_order })
      .eq("id", currentPhoto.id);

    if (firstError) {
      setMessage(firstError.message);
      return;
    }

    const { error: secondError } = await supabase
      .from("advert_photos")
      .update({ sort_order: currentPhoto.sort_order })
      .eq("id", targetPhoto.id);

    if (secondError) {
      setMessage(secondError.message);
      return;
    }

    // Update local state directly — avoids a browser-client SELECT call.
    const swapped = photos.map((p) => {
      if (p.id === currentPhoto.id) return { ...p, sort_order: targetPhoto.sort_order };
      if (p.id === targetPhoto.id) return { ...p, sort_order: currentPhoto.sort_order };
      return p;
    });
    setPhotos(swapped.sort((a, b) => a.sort_order - b.sort_order));
  }

  async function uploadVaultFile(docType: DocumentType, file: File) {
    setVaultStatus((s) => ({ ...s, [docType]: "Uploading..." }));

    try {
      // Step 1: get a signed upload URL from our API (ownership check happens here)
      const presignRes = await fetch("/api/vault/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advert_id: params.id,
          document_type: docType,
          filename: file.name,
          content_type: file.type,
        }),
      });
      const presignResult = await presignRes.json();

      if (!presignRes.ok) {
        setVaultStatus((s) => ({ ...s, [docType]: presignResult.error || "Could not prepare upload." }));
        return;
      }

      const { signed_url, file_path } = presignResult;

      // Step 2: PUT the file directly to Supabase storage — bypasses Vercel entirely
      setVaultStatus((s) => ({ ...s, [docType]: "Uploading to vault..." }));
      const putRes = await fetch(signed_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!putRes.ok) {
        const putText = await putRes.text().catch(() => "");
        setVaultStatus((s) => ({ ...s, [docType]: `Storage upload failed: ${putText || putRes.status}` }));
        return;
      }

      // Step 3: record the file path in the DB
      const recordRes = await fetch("/api/vault/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advert_id: params.id, document_type: docType, file_path }),
      });
      const recordResult = await recordRes.json();

      if (!recordRes.ok) {
        setVaultStatus((s) => ({ ...s, [docType]: recordResult.error || "Upload failed." }));
        return;
      }

      setVaultDocs((prev) => new Set([...prev, docType]));
      setVaultStatus((s) => ({ ...s, [docType]: "" }));
    } catch (err: any) {
      setVaultStatus((s) => ({ ...s, [docType]: err.message || "Upload failed." }));
    }
  }

  async function uploadVaultLink(url: string) {
    setVaultStatus((s) => ({ ...s, video_link: "Saving..." }));
    const res = await fetch("/api/vault/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advert_id: params.id, document_type: "video_link", url }),
    });
    const result = await res.json();

    if (!res.ok) {
      setVaultStatus((s) => ({ ...s, video_link: result.error || "Could not save link." }));
      return;
    }

    setVaultDocs((prev) => new Set([...prev, "video_link" as DocumentType]));
    setVaultStatus((s) => ({ ...s, video_link: "" }));
  }

  async function removeVaultDoc(docType: DocumentType) {
    setVaultStatus((s) => ({ ...s, [docType]: "Removing..." }));
    const res = await fetch("/api/vault/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advert_id: params.id, document_type: docType }),
    });
    const result = await res.json();

    if (!res.ok) {
      setVaultStatus((s) => ({ ...s, [docType]: result.error || "Could not remove." }));
      return;
    }

    setVaultDocs((prev) => {
      const next = new Set(prev);
      next.delete(docType);
      return next;
    });
    setVaultStatus((s) => ({ ...s, [docType]: "" }));
  }

  async function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPostcodeError("");

    // Geocode postcode if provided
    let geoPayload: { postcode?: string; latitude?: number; longitude?: number; nearest_town?: string } = {};
    if (postcode.trim()) {
      const geoRes = await fetch(`/api/geocode?postcode=${encodeURIComponent(postcode.trim())}`);
      const geoResult = await geoRes.json();
      if (!geoRes.ok) {
        setPostcodeError("Please enter a valid UK postcode.");
        return;
      }
      geoPayload = {
        postcode: geoResult.postcode,
        latitude: geoResult.latitude,
        longitude: geoResult.longitude,
        nearest_town: geoResult.nearest_town,
      };
    }

    const res = await fetch(`/api/adverts/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        price: Number(price),
        mileage: Number(mileage),
        description,
        ...geoPayload,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setMessage(result.error || "Could not save changes.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main>
      <section className="dashboard-hero">
        <p className="eyebrow">Edit advert</p>
        <h1>Update your listing</h1>
        <p>Keep your advert accurate so buyers see the latest price, mileage and description.</p>
      </section>

      <section className="form-section">
        {message && <p>{message}</p>}

        {!message && (status === "draft" || status === "pending_payment") && (
          <div className="draft-warning">
            <h3>This advert is not live yet</h3>
            <p>
              Your advert is not published yet. Add photos, then continue to publish
              for the £{LISTING_PRICE_GBP.toFixed(2)} launch price.
            </p>
            <Link href={`/publish-advert/${params.id}`}>
              Continue to publish
            </Link>
          </div>
        )}

        {!message && (
          <form className="advert-form" onSubmit={handleUpdate}>
            <label>
              Advert title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 2019 BMW 3 Series"
              />
            </label>

            <label>
              Price
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="18995"
                type="number"
              />
            </label>

            <label>
              Mileage
              <input
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                placeholder="42000"
                type="number"
              />
            </label>

            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the vehicle..."
              />
            </label>

            <label>
              Where is the car located?
              <input
                type="text"
                value={postcode}
                onChange={(e) => { setPostcode(e.target.value); setPostcodeError(""); }}
                placeholder="e.g. DT6 3NP"
                maxLength={8}
              />
              <p className="field-hint">Enter the postcode where the car is kept. We show nearest town to buyers — your postcode is never visible.</p>
              {postcodeError && <p className="field-error" role="alert">{postcodeError}</p>}
            </label>

            <h3 style={{ marginTop: "24px" }}>Photos</h3>

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => uploadPhotos(e.target.files)}
            />

            {photos.length === 0 && (
              <p style={{ color: "var(--muted)" }}>
                No photos uploaded yet.
              </p>
            )}

            {photos.length > 0 && (
              <div className="photo-manage-grid">
                {photos.map((photo, index) => (
                  <div className="photo-manage-card" key={photo.id}>
                    <img src={photo.image_url} alt="Advert photo" />

                    <div className="photo-manage-actions">
                      {index !== 0 && (
                        <button
                          type="button"
                          onClick={() => movePhoto(index, "left")}
                        >
                          Make main
                        </button>
                      )}

                      <button
                        type="button"
                        className="remove-photo-button"
                        onClick={() => deletePhoto(photo.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button type="submit">Save changes</button>
          </form>
        )}

        {!message && (
          <div className="vault-section">
            <h3>Secure Vault documents</h3>
            <p className="vault-section-note">
              Documents are stored securely and only shared with buyers you choose to share them with.
              You are responsible for redacting any personal information from the V5C before uploading.
            </p>

            <div className="vault-doc-list">
              {(["mot", "service_history", "v5c"] as DocumentType[]).map((docType) => (
                <VaultFileRow
                  key={docType}
                  docType={docType}
                  label={DOCUMENT_DISPLAY_NAMES[docType]}
                  hint="Upload PDF or image"
                  uploaded={vaultDocs.has(docType)}
                  status={vaultStatus[docType] || ""}
                  onUpload={(file) => uploadVaultFile(docType, file)}
                  onRemove={() => removeVaultDoc(docType)}
                />
              ))}

              <VaultLinkRow
                uploaded={vaultDocs.has("video_link")}
                status={vaultStatus["video_link"] || ""}
                onSave={uploadVaultLink}
                onRemove={() => removeVaultDoc("video_link")}
              />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

// ── Vault sub-components ────────────────────────────────────────────────────

function VaultFileRow({
  docType,
  label,
  hint,
  uploaded,
  status,
  onUpload,
  onRemove,
}: {
  docType: DocumentType;
  label: string;
  hint: string;
  uploaded: boolean;
  status: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="vault-doc-row">
      <div className="vault-doc-info">
        <span className="vault-doc-label">{label}</span>
        <span className="vault-doc-hint">{hint}</span>
      </div>

      <div className="vault-doc-actions">
        {uploaded ? (
          <>
            <span className="vault-uploaded">✓ Uploaded</span>
            <button type="button" className="vault-remove-btn" onClick={onRemove}>
              Remove
            </button>
          </>
        ) : (
          <label className="vault-upload-btn">
            Upload
            <input
              type="file"
              accept="application/pdf,image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
              }}
            />
          </label>
        )}
        {status && <span className="vault-status">{status}</span>}
      </div>
    </div>
  );
}

function VaultLinkRow({
  uploaded,
  status,
  onSave,
  onRemove,
}: {
  uploaded: boolean;
  status: string;
  onSave: (url: string) => void;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState("");

  return (
    <div className="vault-doc-row">
      <div className="vault-doc-info">
        <span className="vault-doc-label">Video link</span>
        <span className="vault-doc-hint">Paste URL</span>
      </div>

      <div className="vault-doc-actions">
        {uploaded ? (
          <>
            <span className="vault-uploaded">✓ Saved</span>
            <button type="button" className="vault-remove-btn" onClick={onRemove}>
              Remove
            </button>
          </>
        ) : (
          <>
            <input
              type="url"
              className="vault-link-input"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button
              type="button"
              className="vault-upload-btn"
              onClick={() => { if (url.trim()) onSave(url.trim()); }}
            >
              Save
            </button>
          </>
        )}
        {status && <span className="vault-status">{status}</span>}
      </div>
    </div>
  );
}
