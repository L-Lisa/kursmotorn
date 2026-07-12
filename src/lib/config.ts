/**
 * Motorns eget namn är en KONFIGVARIABEL, aldrig hårdkodat (brief: namnbytes-säkert).
 * "Kursmotorn" är arbetstitel — byts via env utan kodändring.
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Kursmotorn";
