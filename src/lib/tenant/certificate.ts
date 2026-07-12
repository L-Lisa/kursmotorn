import { createClient } from "@/lib/supabase/server";

/**
 * Certifierings-lagret (fas 5). Läser den typade certifikatstatusen via RPC:n
 * certificate_status (SECURITY DEFINER, re-verifierar kraven server-side). UI:t
 * visar bara tillstånd — själva utfärdandet gatas i issue_certificate, aldrig här.
 */

export type CertRequirement = {
  position: number;
  type: string;
  config: Record<string, unknown>;
  met: boolean;
};

export type IssuedCertificate = {
  id: string;
  verifySlug: string;
  issuedAt: string;
  holderName: string;
};

export type CertificateStatus = {
  allMet: boolean;
  requirements: CertRequirement[];
  certificate: IssuedCertificate | null;
};

/** Svensk etikett per kravtyp (motor-röst, ingen säljton). */
export function requirementLabel(type: string, config: Record<string, unknown>): string {
  switch (type) {
    case "sections_complete":
      return "Alla kursens sektioner avklarade";
    case "final_quiz_pass": {
      const t = typeof config.threshold === "number" ? config.threshold : 80;
      return `Slutprovet godkänt (minst ${t} %)`;
    }
    case "attestation":
      return "Heder-och-samvete-intyg om genomförd live-session";
    case "manual_approval":
      return "Manuell bedömning godkänd";
    case "upload_sections":
      return "Uppladdningskrav uppfyllda";
    case "log_threshold":
      return "Loggkrav uppfyllt";
    default:
      return type;
  }
}

export async function getCertificateStatus(
  courseId: string,
): Promise<CertificateStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("certificate_status", {
    p_course_id: courseId,
  });
  if (error || !data) return null;

  const d = data as {
    all_met?: boolean;
    requirements?: Array<{ position: number; type: string; config: Record<string, unknown>; met: boolean }>;
    certificate?: { id: string; verify_slug: string; issued_at: string; holder_name: string } | null;
  };

  return {
    allMet: !!d.all_met,
    requirements: (d.requirements ?? []).map((r) => ({
      position: r.position,
      type: r.type,
      config: r.config ?? {},
      met: !!r.met,
    })),
    certificate: d.certificate
      ? {
          id: d.certificate.id,
          verifySlug: d.certificate.verify_slug,
          issuedAt: d.certificate.issued_at,
          holderName: d.certificate.holder_name,
        }
      : null,
  };
}

/** Om deltagaren behöver attestera: hämtar den ordagranna, versionerade lydelsen. */
export async function getAttestationStatement(
  type = "live_session_honor",
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attestation_statement", { p_type: type });
  if (error || typeof data !== "string") return null;
  return data;
}

/** Har en attestation av denna typ redan lämnats? (för UI-tillstånd) */
export async function hasAttested(
  courseId: string,
  userId: string,
  type = "live_session_honor",
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attestations")
    .select("id")
    .eq("course_id", courseId)
    .eq("user_id", userId)
    .eq("type", type)
    .limit(1)
    .maybeSingle();
  return !!data;
}
