"use client";

import { useRef, useState } from "react";
import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import { recordUpload } from "./actions";

/**
 * MP4-uppladdning för en 🎥-sektion. Resumable (TUS) → stora filer funkar.
 * Path: <tenant>/<user>/<section>/<fil> (storage-RLS gatar prefixet). Vid klar
 * uppladdning registreras metadataraden → sektionen blir klar → nästa modul öppnas.
 */
export function UploadControl({
  tenant,
  tenantId,
  sectionId,
  complete,
  locked,
}: {
  tenant: string;
  tenantId: string;
  sectionId: string;
  complete: boolean;
  locked: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (locked) {
    return (
      <span className="font-[family-name:var(--t-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--t-muted)]">
        Låst
      </span>
    );
  }
  if (complete) {
    return (
      <span className="font-[family-name:var(--t-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--t-primary)]">
        ✓ Uppladdad
      </span>
    );
  }

  async function onFile(file: File) {
    setError(null);
    setProgress(0);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError("ej inloggad");
      setProgress(null);
      return;
    }
    const userId = session.user.id;
    const path = `${tenantId}/${userId}/${sectionId}/${Date.now()}-${file.name}`;
    const endpoint = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`;

    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: "recordings",
        objectName: path,
        contentType: file.type || "video/mp4",
      },
      chunkSize: 6 * 1024 * 1024, // Supabase kräver 6 MB-chunkar
      onError: (e) => {
        setError(e.message);
        setProgress(null);
      },
      onProgress: (sent, total) => setProgress(Math.round((sent / total) * 100)),
      onSuccess: async () => {
        const r = await recordUpload(tenant, sectionId, path, file.size);
        setProgress(null);
        if (!r.ok) setError(r.error ?? "kunde inte registrera");
      },
    });
    upload.start();
  }

  return (
    <span className="flex items-center gap-2">
      {progress !== null ? (
        <span className="font-[family-name:var(--t-mono)] text-[10px] text-[var(--t-muted)]">
          Laddar upp {progress}%
        </span>
      ) : (
        <>
          <button
            onClick={() => inputRef.current?.click()}
            className="rounded-full bg-[var(--t-soft)] px-2.5 py-0.5 font-[family-name:var(--t-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--t-primary-dark)] hover:opacity-80"
          >
            Ladda upp MP4
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </>
      )}
      {error && <span className="text-[10px] text-[#b3261e]">{error}</span>}
    </span>
  );
}
