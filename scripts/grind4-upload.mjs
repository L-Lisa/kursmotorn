// GRIND 4 — skarp TUS-verifiering: 1 GB resumable upload + path-prefix-isolation.
import * as tus from "tus-js-client";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { createReadStream, statSync } from "node:fs";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SECRET_KEY;
const FILE = process.argv[2];
const TENANT = "10000000-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";

const svc = createClient(URL, SVC, { auth: { persistSession: false }, realtime: { transport: WebSocket } });
const anna = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: WebSocket } });
const { data: sess } = await anna.auth.signInWithPassword({ email: "anna@andning.test", password: "Testlosen123!" });
const token = sess.session.access_token;
const userId = sess.session.user.id;

const { data: sec } = await svc.from("sections").select("id").eq("tenant_id", TENANT).contains("requirements", { upload_required: true }).limit(1).single();
const size = statSync(FILE).size;
console.log(`Testfil: ${(size / 1024 / 1024).toFixed(0)} MB · uppladdningssektion ${sec.id.slice(0, 8)}`);

function tusUpload(objectName) {
  return new Promise((resolve) => {
    let last = 0;
    const up = new tus.Upload(createReadStream(FILE), {
      endpoint: `${URL}/storage/v1/upload/resumable`,
      uploadSize: size,
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 1000, 3000],
      headers: { authorization: `Bearer ${token}`, apikey: ANON, "x-upsert": "true" },
      metadata: { bucketName: "recordings", objectName, contentType: "video/mp4" },
      onError: (e) => resolve({ ok: false, error: e.message || String(e) }),
      onProgress: (sent, total) => {
        const pct = Math.round((sent / total) * 100);
        if (pct >= last + 25) { last = pct; process.stdout.write(` ${pct}%`); }
      },
      onSuccess: () => resolve({ ok: true }),
    });
    up.start();
  });
}

// 1. Egen prefix → ska lyckas (stor fil, resumable)
const ownPath = `${TENANT}/${userId}/${sec.id}/rec.mp4`;
process.stdout.write("Egen prefix (1 GB):");
const t0 = Date.now();
const r1 = await tusUpload(ownPath);
console.log(r1.ok ? ` KLAR på ${Math.round((Date.now() - t0) / 1000)}s ✓` : ` FEL: ${r1.error}`);

// verifiera storage-objektet finns + storlek
const { data: list } = await svc.storage.from("recordings").list(`${TENANT}/${userId}/${sec.id}`);
const obj = list?.find((o) => o.name === "rec.mp4");
console.log(`Storage-objekt: ${obj ? (obj.metadata?.size / 1024 / 1024).toFixed(0) + " MB ✓" : "SAKNAS ✗"}`);

// 2. Annans (Bengts) prefix → ska nekas av storage-RLS
process.stdout.write("Annans prefix:");
const r2 = await tusUpload(`${TENANT}/${B}/${sec.id}/rec.mp4`);
console.log(r2.ok ? " TILLÅTET ✗" : " NEKAT ✓");

// städa
await svc.storage.from("recordings").remove([ownPath]);
console.log("(städat)");
