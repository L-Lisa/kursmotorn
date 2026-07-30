"use client";

import { useState, useTransition } from "react";
import { saveBrandSpec } from "../actions";
import { COLOR_KEYS, COLOR_LABELS, type BrandSpecInput } from "@/lib/admin/brand-spec";

const field =
  "rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const label = "text-xs uppercase tracking-[0.06em] text-muted-foreground";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-border bg-card p-5">
      <legend className="px-2 text-sm font-semibold text-foreground">{title}</legend>
      <div className="flex flex-wrap gap-3">{children}</div>
    </fieldset>
  );
}

function Input({
  name,
  text,
  defaultValue,
  wide,
  placeholder,
}: {
  name: string;
  text: string;
  defaultValue?: string;
  wide?: boolean;
  placeholder?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${wide ? "w-full" : ""}`}>
      <label htmlFor={name} className={label}>
        {text}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`${field} ${wide ? "w-full" : "w-56"}`}
      />
    </div>
  );
}

export function BrandWizardForm({
  slug,
  initial,
}: {
  slug: string;
  initial: BrandSpecInput;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="flex flex-col gap-6"
      action={(form) =>
        start(async () => {
          setMsg(null);
          const res = await saveBrandSpec(slug, form);
          setMsg(
            res.ok
              ? { ok: true, text: "Sparat. Brandet renderas direkt i tenant-vyerna." }
              : { ok: false, text: res.error ?? "kunde inte spara" },
          );
        })
      }
    >
      <Section title="Identitet">
        <Input name="tenant_name" text="Namn (visas i appen)" defaultValue={initial.tenant_name} />
        <Input name="course_name" text="Kursnamn" defaultValue={initial.course_name} />
        <Input
          name="certificate_title"
          text="Certifikattitel"
          defaultValue={initial.certificate_title}
        />
        <Input name="tagline" text="Tagline" defaultValue={initial.tagline} wide />
        <Input name="org_legal_name" text="Juridiskt namn" defaultValue={initial.org_legal_name} />
        <Input name="org_nr" text="Org.nr" defaultValue={initial.org_nr} />
        <Input name="org_website" text="Webbplats" defaultValue={initial.org_website} />
        <Input name="org_contact" text="Kontakt" defaultValue={initial.org_contact} />
      </Section>

      <Section title="Palett (hex, #RRGGBB)">
        {COLOR_KEYS.map((k) => (
          <div key={k} className="flex flex-col gap-1">
            <label htmlFor={`color_${k}`} className={label}>
              {COLOR_LABELS[k]} ({k})
            </label>
            <div className="flex items-center gap-2">
              <input
                id={`color_${k}`}
                name={`color_${k}`}
                defaultValue={initial.colors[k]}
                placeholder="#000000"
                className={`${field} w-32 font-[family-name:var(--font-mono)]`}
              />
              <span
                className="inline-block h-8 w-8 shrink-0 rounded border border-border"
                style={{ backgroundColor: initial.colors[k] || "transparent" }}
                title={initial.colors[k]}
              />
            </div>
          </div>
        ))}
      </Section>

      <Section title="Typografi (Google Fonts-namn)">
        <Input name="font_serif" text="Rubriker (serif)" defaultValue={initial.font_serif} />
        <Input name="font_sans" text="Brödtext/UI (sans)" defaultValue={initial.font_sans} />
        <Input name="font_mono" text="Metadata (mono)" defaultValue={initial.font_mono} />
      </Section>

      <Section title="Röst & tonläge">
        <Input
          name="tone_words"
          text="Tonen (kommaseparerat)"
          defaultValue={initial.tone_words}
          placeholder="lugn, varm, evidensledd"
        />
        <Input name="address" text="Tilltal" defaultValue={initial.address} />
        <Input name="language" text="Språk" defaultValue={initial.language} />
        <Input
          name="sample_line_1"
          text="Exempelmening (uppmuntran)"
          defaultValue={initial.sample_line_1}
          wide
        />
        <Input
          name="sample_line_2"
          text="Exempelmening (instruktion)"
          defaultValue={initial.sample_line_2}
          wide
        />
        <Input
          name="avoid"
          text="Undvik (kommaseparerat)"
          defaultValue={initial.avoid}
          wide
        />
      </Section>

      <Section title="Logotyp & certifikat">
        <Input name="logo_url" text="Logotyp-URL (valfritt)" defaultValue={initial.logo_url} wide />
        <Input
          name="cert_issuer_text"
          text="Utfärdartext"
          defaultValue={initial.cert_issuer_text}
        />
        <Input
          name="cert_signature_name"
          text="Signatur — namn"
          defaultValue={initial.cert_signature_name}
        />
        <Input
          name="cert_signature_title"
          text="Signatur — titel"
          defaultValue={initial.cert_signature_title}
        />
      </Section>

      <Section title="Domän">
        <Input name="subdomain" text="Subdomän" defaultValue={initial.subdomain} />
        <Input
          name="custom_domain"
          text="Egen domän (aktiveras av plattformsägaren)"
          defaultValue={initial.custom_domain}
        />
      </Section>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Sparar …" : "Spara brand"}
        </button>
        {msg && (
          <p className={`text-sm ${msg.ok ? "text-muted-foreground" : "text-destructive"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </form>
  );
}
