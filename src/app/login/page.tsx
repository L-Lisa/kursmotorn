import { APP_NAME } from "@/lib/config";
import { MotorLoginForm } from "./motor-login-form";

export default async function MotorLogin({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next && next.startsWith("/") ? next : "/admin";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <p className="m-label mb-2">{APP_NAME}</p>
      <h1 className="mb-8 text-2xl font-semibold text-foreground">Logga in</h1>
      <MotorLoginForm next={target} />
    </main>
  );
}
