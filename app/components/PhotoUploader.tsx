"use client";

import { useRef, useState } from "react";
import { prepareImage } from "@/lib/photos/prepareImage";

interface PhotoUploaderProps {
  advertId: string;
  photos: any[];
  onPhotosChange: (photos: any[]) => void;
  maxPhotos?: number;
  /** Provide to enable reorder buttons (edit-advert). Omit for publish-advert. */
  onMovePhoto?: (index: number, direction: "left" | "right") => void;
}

function isImageFile(f: File): boolean {
  // iOS HEIC files sometimes arrive with an empty type — detect by extension too.
  return f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name);
}

export default function PhotoUploader({
  advertId,
  photos,
  onPhotosChange,
  maxPhotos = 10,
  onMovePhoto,
}: PhotoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(files: FileList | File[] | null) {
    if (!files || !advertId) return;

    const imageFiles = Array.from(files).filter(isImageFile);

    if (imageFiles.length === 0) {
      setUploadMessage("Please choose image files to upload.");
      return;
    }

    if (photos.length + imageFiles.length > maxPhotos) {
      setUploadMessage(`You can upload up to ${maxPhotos} photos per advert.`);
      return;
    }

    setUploadMessage("Uploading photos...");

    let updatedPhotos: any[] = [...photos];
    let finalMessage = "";

    try {
      for (let i = 0; i < imageFiles.length; i++) {
        // Convert HEIC and downscale all images before sending — keeps every
        // upload well under Vercel's ~4.5 MB request body limit.
        const prepared = await prepareImage(imageFiles[i]);

        const formData = new FormData();
        formData.append("file", prepared);
        formData.append("advertId", advertId);
        formData.append("sortOrder", String(photos.length + i));

        const res = await fetch("/api/upload-photo", { method: "POST", body: formData });

        let result: any;
        try {
          result = await res.json();
        } catch {
          throw new Error("That photo couldn't be uploaded — please try a different one.");
        }

        if (!res.ok) {
          throw new Error(result?.error || "Photo upload failed. Please try again.");
        }

        updatedPhotos = result.photos ?? updatedPhotos;
      }

      onPhotosChange(updatedPhotos);
      // finalMessage stays "" — finally will clear the uploading text
    } catch (err: any) {
      finalMessage = err?.message || "That photo couldn't be uploaded — please try a different one.";
    } finally {
      // Always clears "Uploading photos..." — the UI can never hang here.
      setUploadMessage(finalMessage);
    }
  }

  async function deletePhoto(photoId: string) {
    try {
      const res = await fetch("/api/upload-photo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });

      let result: any;
      try {
        result = await res.json();
      } catch {
        setUploadMessage("Could not delete photo. Please try again.");
        return;
      }

      if (!res.ok) {
        setUploadMessage(result?.error || "Could not delete photo. Please try again.");
        return;
      }

      onPhotosChange(result.photos ?? []);
    } catch {
      setUploadMessage("Could not delete photo. Please try again.");
    }
  }

  const withReorder = Boolean(onMovePhoto);

  return (
    <>
      <div
        className={`photo-upload-zone${isDragging ? " photo-upload-zone-active" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <strong>Drag photos here or click to choose files.</strong>
        <span>The first photo appears on browse and advert pages.</span>
      </div>

      <input
        ref={fileInputRef}
        className="photo-upload-input"
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {uploadMessage && <p>{uploadMessage}</p>}

      {photos.length > 0 && (
        <div className={withReorder ? "photo-manage-grid" : "photo-preview-grid"}>
          {photos.map((photo, index) => (
            <div
              className={withReorder ? "photo-manage-card" : "photo-preview-item"}
              key={photo.id}
            >
              <img src={photo.image_url} alt="Advert photo" />
              <div className={withReorder ? "photo-manage-actions" : undefined}>
                {withReorder && onMovePhoto && index !== 0 && (
                  <button type="button" onClick={() => onMovePhoto(index, "left")}>
                    Make main
                  </button>
                )}
                <button
                  type="button"
                  className={withReorder ? "remove-photo-button" : undefined}
                  onClick={() => deletePhoto(photo.id)}
                >
                  {withReorder ? "Remove" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
