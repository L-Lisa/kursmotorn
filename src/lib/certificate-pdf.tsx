import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

/**
 * Certifikat-PDF (fas 5). Renderas server-side ur tenant-brandens tokens — inget
 * varumärke hårdkodat, allt kommer via brand_spec (verify_certificate-RPC:n).
 *
 * Verktygsval: @react-pdf/renderer (ren JS, kör i serverless-runtimen där certifikatet
 * utfärdas on-demand; Playwright-print hade krävt en chromium-binär vid varje request).
 * v1 använder PDF-standardfamiljerna (serif→Times, sans→Helvetica) som stöder å/ä/ö via
 * WinAnsi; brandens EGEN typografi (Lora/Fraunces) via inbäddad TTF är en senare höjning
 * (loggat i DECISIONS). Brand-IDENTITETEN bärs av färgerna, som återges exakt.
 */

export type CertificatePdfData = {
  holderName: string;
  courseName: string;
  certificateTitle: string;
  issuerText: string;
  issuedAt: string; // ISO
  verifySlug: string;
  verifyUrl: string; // full publik URL
  colors: {
    bg: string;
    card: string;
    primary: string;
    primary_dark: string;
    text: string;
    muted: string;
    accent: string;
    soft: string;
  };
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("sv-SE");
  } catch {
    return iso;
  }
}

export async function renderCertificatePdf(d: CertificatePdfData): Promise<Buffer> {
  const c = d.colors;
  const styles = StyleSheet.create({
    page: {
      backgroundColor: c.bg,
      padding: 32,
      fontFamily: "Helvetica",
      color: c.text,
    },
    frame: {
      flexGrow: 1,
      backgroundColor: c.card,
      borderWidth: 2,
      borderColor: c.primary,
      borderStyle: "solid",
      paddingVertical: 56,
      paddingHorizontal: 64,
      alignItems: "center",
      justifyContent: "center",
    },
    eyebrow: {
      fontFamily: "Helvetica",
      fontSize: 11,
      letterSpacing: 3,
      textTransform: "uppercase",
      color: c.primary,
      marginBottom: 28,
    },
    intro: { fontSize: 12, color: c.muted, marginBottom: 14 },
    holder: {
      fontFamily: "Times-Roman",
      fontSize: 40,
      color: c.text,
      marginBottom: 18,
      textAlign: "center",
    },
    body: {
      fontSize: 13,
      color: c.text,
      textAlign: "center",
      marginBottom: 6,
      maxWidth: 460,
      lineHeight: 1.5,
    },
    course: {
      fontFamily: "Times-Roman",
      fontSize: 18,
      color: c.primary_dark,
      marginTop: 10,
      marginBottom: 30,
      textAlign: "center",
    },
    rule: { width: 64, height: 2, backgroundColor: c.accent, marginBottom: 24 },
    issuer: { fontSize: 12, color: c.text, marginBottom: 4 },
    meta: { fontFamily: "Helvetica", fontSize: 9, color: c.muted, marginTop: 2 },
    footer: {
      position: "absolute",
      bottom: 24,
      left: 64,
      right: 64,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    footerText: { fontFamily: "Helvetica", fontSize: 8, color: c.muted },
  });

  const doc = (
    <Document title={`${d.certificateTitle} — ${d.holderName}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <Text style={styles.eyebrow}>{d.certificateTitle}</Text>
          <Text style={styles.intro}>Detta intygar att</Text>
          <Text style={styles.holder}>{d.holderName}</Text>
          <Text style={styles.body}>har genomfört och uppfyllt kraven för</Text>
          <Text style={styles.course}>{d.courseName}</Text>
          <View style={styles.rule} />
          <Text style={styles.issuer}>{d.issuerText}</Text>
          <Text style={styles.meta}>Utfärdat {fmtDate(d.issuedAt)}</Text>
        </View>
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Certifikat-ID: {d.verifySlug}</Text>
          <Text style={styles.footerText}>Verifiera: {d.verifyUrl}</Text>
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
