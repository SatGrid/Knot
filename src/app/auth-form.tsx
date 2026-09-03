"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "sign-up";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const result = isSignUp
      ? await authClient.signUp.email({
          name: String(form.get("name") ?? "").trim(),
          email,
          password,
        })
      : await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? "Something went wrong. Please try again.");
      setPending(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function signInWithGoogle() {
    setError("");
    setPending(true);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
      if (result.error) setError(result.error.message ?? "Google sign-in could not start.");
    } catch {
      setError("Google sign-in could not start. Check the OAuth configuration.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-stone-100 px-4 text-stone-900">
      <section className="w-full max-w-sm rounded-lg border border-stone-300 bg-white p-6">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">Knot</h1>
          <p className="mt-1 text-sm text-stone-500">Tying people together.</p>
        </header>

        <h2 className="mb-4 text-base font-semibold">{isSignUp ? "Create an account" : "Sign in"}</h2>

        <form className="space-y-4" onSubmit={submit}>
          {isSignUp && (
            <label className="block text-sm">
              <span className="mb-1.5 block">Name</span>
              <input autoComplete="name" className="h-10 w-full rounded-md border border-stone-300 px-3 outline-none focus:border-stone-500" minLength={2} name="name" required />
            </label>
          )}

          <label className="block text-sm">
            <span className="mb-1.5 block">Email</span>
            <input autoComplete="email" className="h-10 w-full rounded-md border border-stone-300 px-3 outline-none focus:border-stone-500" name="email" required type="email" />
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block">Password</span>
            <input autoComplete={isSignUp ? "new-password" : "current-password"} className="h-10 w-full rounded-md border border-stone-300 px-3 outline-none focus:border-stone-500" minLength={8} name="password" required type="password" />
          </label>

          {error && <p aria-live="polite" className="text-sm text-red-700">{error}</p>}

          <button className="h-10 w-full rounded-md bg-stone-900 text-sm font-medium text-white hover:bg-stone-700 disabled:bg-stone-400" disabled={pending} type="submit">
            {pending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <>
          <div className="my-4 flex items-center gap-3 text-xs text-stone-400"><span className="h-px flex-1 bg-stone-200" />or<span className="h-px flex-1 bg-stone-200" /></div>
          <button className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-stone-300 text-sm font-medium hover:bg-stone-50 disabled:cursor-default disabled:bg-stone-100" disabled={pending} onClick={signInWithGoogle} type="button">
            <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.26Z" /><path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.29v2.53A9.74 9.74 0 0 0 12 21.5Z" /><path fill="#FBBC05" d="M6.53 13.58A5.86 5.86 0 0 1 6.22 12c0-.55.1-1.09.31-1.58V7.89H3.29A9.74 9.74 0 0 0 2.25 12c0 1.57.38 3.05 1.04 4.11l3.24-2.53Z" /><path fill="#EA4335" d="M12 6.39c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.47 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.71 5.39l3.24 2.53C7.3 8.11 9.46 6.39 12 6.39Z" /></svg>
            Continue with Google
          </button>
        </>

        <p className="mt-5 text-center text-sm text-stone-500">
          {isSignUp ? "Already have an account?" : "New to Knot?"}{" "}
          <Link className="font-medium text-stone-900 underline underline-offset-2" href={isSignUp ? "/sign-in" : "/sign-up"}>
            {isSignUp ? "Sign in" : "Create one"}
          </Link>
        </p>
      </section>
    </main>
  );
}
