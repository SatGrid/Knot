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
