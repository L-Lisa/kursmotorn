// Kursmotorn — kopplar meditationsljud till kurssektioner (fas 7-komplettering).
// Kör: node --env-file=.env.development.local scripts/attach-media.mjs <tenant-slug> <ljudfil> [titelregex]
//
// Laddar upp filen EN gång till course-media/<tenant_id>/media/<filnamn> och sätter
// media_path + media_duration_sec på kursens sektioner vars titel matchar regexen
// (default: meditationssektionerna "Minimeditation:"/"Veckans meditation:").
// Placeholder-läget (Lisas fil 2026-07-31): samma fil på alla matchande sektioner —
// byts fil för fil när de riktiga inspelningarna finns (samma skript, per sektion).
// Duration läses via macOS `afinfo` (byggmiljön är Lisas Mac; loggat i DECISIONS).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { execFileSync } from "node:child_process";
import WebSocket from "ws";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL_ || !KEY) throw new Error("Saknar env (kör med --env-file)");
const [slug, filePath, patternArg] = process.argv.slice(2);
if (!slug || !filePath) throw new Error("Användning: attach-media.mjs <tenant-slug> <ljudfil> [titelregex]");
const pattern = new RegExp(patternArg ?? "^(Minimeditation|Veckans meditation):", "i");

const supa = createClient(URL_, KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } });

const { data: tenant } = await supa.from("tenants").select("id").eq("slug", slug).single();
if (!tenant) throw new Error(`okänd tenant: ${slug}`);

// Duration via afinfo ("estimated duration: 2357.497324 sec").
const afinfo = execFileSync("afinfo", [filePath], { encoding: "utf8" });
const durMatch = afinfo.match(/estimated duration:\s*([\d.]+)\s*sec/);
if (!durMatch) throw new Error("kunde inte läsa duration (afinfo)");
const durationSec = Math.round(Number(durMatch[1]));

const MIME = { ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".aac": "audio/aac", ".mp4": "video/mp4" };
const safeName = basename(filePath).replace(/[^a-zA-Z0-9._-]/g, "-");
const storagePath = `${tenant.id}/media/${safeName}`;
const up = await supa.storage.from("course-media").upload(storagePath, readFileSync(filePath), {
  contentType: MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream",
  upsert: true,
});
if (up.error) throw new Error(`uppladdning: ${up.error.message}`);
console.log(`✓ ${storagePath} (${durationSec}s)`);

// Matchande sektioner i tenantens kurser.
const { data: course } = await supa.from("courses").select("id").eq("tenant_id", tenant.id).order("created_at").limit(1).single();
const { data: mods } = await supa.from("modules").select("id").eq("course_id", course.id);
const { data: secs } = await supa
  .from("sections")
  .select("id, title")
  .in("module_id", mods.map((m) => m.id));
const targets = secs.filter((s) => pattern.test(s.title));
if (targets.length === 0) throw new Error(`inga sektioner matchar ${pattern}`);

const upd = await supa
  .from("sections")
  .update({ media_path: storagePath, media_duration_sec: durationSec })
  .in("id", targets.map((s) => s.id));
if (upd.error) throw new Error(`sektionsuppdatering: ${upd.error.message}`);

console.log(`✓ ${targets.length} sektioner kopplade:`);
for (const t of targets) console.log(`  · ${t.title}`);
