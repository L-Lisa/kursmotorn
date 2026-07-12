import Link from "next/link";
import { APP_NAME } from "@/lib/config";

/** Motorns neutrala startsida. Varumärket bor i tenant-lagret, inte här. */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
      <p className="m-label mb-3">{APP_NAME}</p>
      <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
        En kurs, ditt varumärke.
      </h1>
      <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
        Plattformen som gör en kurs till en färdig, varumärkt kursapp — login,
        avbockning, prov och certifikat. Motorn håller sig ur vägen; ditt
        varumärke syns.
      </p>
      <div className="mt-8">
        <Link
          href="/admin"
          className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Till admin
        </Link>
      </div>
    </main>
  );
}
