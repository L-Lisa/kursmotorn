"use client";

import { useRef, useState } from "react";
import { recordPlayback } from "../../logg/actions";

/**
 * Meditationsspelaren (fas 7-komplettering). Mäter faktiskt LYSSNAD tid
 * (ackumulerade uppspelningssekunder — inte spolposition); vid ≥90 % av
 * media_duration_sec loggas dagens praxisdag automatiskt (source: auto,
 * idempotent server-side). Kvittot är stilla — ingen konfetti, ingen streak.
 */
const PLAY_THRESHOLD = 0.9; // konfigval [Trolig] — godkända specen §3.1

export function MeditationPlayer({
  tenant,
  sectionId,
  src,
  durationSec,
  autoLogs,
}: {
  tenant: string;
  sectionId: string;
  src: string;
  durationSec: number;
  autoLogs: boolean; // kursen har praxislogg (practice_day) — annars bara uppspelning
}) {
  const listened = useRef(0);
  const lastTime = useRef<number | null>(null);
  const reported = useRef(false);
  const [logged, setLogged] = useState(false);

  const onTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const t = e.currentTarget.currentTime;
    if (lastTime.current !== null) {
      const delta = t - lastTime.current;
      // Bara framåtspel räknas; spolning ger stora/negativa delta och ignoreras.
      if (delta > 0 && delta < 2) listened.current += delta;
    }
    lastTime.current = t;

    if (
      autoLogs &&
      !reported.current &&
      durationSec > 0 &&
      listened.current >= PLAY_THRESHOLD * durationSec
    ) {
      reported.current = true;
      void recordPlayback(tenant, sectionId).then((res) => {
        if (res.ok) setLogged(true);
      });
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-[var(--t-soft)] bg-[var(--t-card)] p-4">
      <audio
        controls
        preload="none"
        src={src}
        onTimeUpdate={onTimeUpdate}
        onSeeked={() => (lastTime.current = null)}
        className="w-full"
      />
      <p className="mt-2 text-xs text-[var(--t-muted)]">
        {logged
          ? "Dagens praxis är loggad."
          : autoLogs
            ? "Genomförd meditation loggas automatiskt i praxisloggen."
            : ""}
      </p>
    </div>
  );
}
