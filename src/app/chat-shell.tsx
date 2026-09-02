"use client";

import { useMemo, useOptimistic, useState } from "react";
import { useRouter } from "next/navigation";
import { sendMessage } from "./actions";
import { authClient } from "@/lib/auth-client";

type MessageView = {
  id: string;
  body: string;
  sender: "me" | "them";
};

export type ConversationView = {
  id: string;
  name: string;
  status: string;
  time: string;
  messages: MessageView[];
};

type OptimisticMessage = {
  conversationId: string;
  body: string;
  id: string;
};

export function ChatShell({
  currentUserName,
  initialConversations,
}: {
  currentUserName: string;
  initialConversations: ConversationView[];
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(initialConversations[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [localConversations, setLocalConversations] = useState(initialConversations);
  const [conversations, addOptimisticMessage] = useOptimistic(
    localConversations,
    (current, message: OptimisticMessage) =>
      current.map((conversation) =>
        conversation.id === message.conversationId
          ? {
              ...conversation,
              time: "Now",
              messages: [...conversation.messages, { id: message.id, body: message.body, sender: "me" }],
            }
          : conversation,
      ),
  );

  const activeConversation = conversations.find(({ id }) => id === activeId) ?? conversations[0];
  const visibleConversations = useMemo(
    () => conversations.filter(({ name }) => name.toLowerCase().includes(search.toLowerCase())),
    [conversations, search],
  );

  function chooseConversation(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
  }

  function startConversation() {
    const name = window.prompt("Who do you want to message?")?.trim();
    if (!name) return;
    const id = `local-${Date.now()}`;
    setLocalConversations((current) => [
      ...current,
      { id, name, status: "New conversation", time: "Now", messages: [] },
    ]);
    setActiveId(id);
  }

  async function submitMessage(formData: FormData) {
    if (!activeConversation) return;

    const body = String(formData.get("message") ?? "").trim();
    if (!body) return;

    addOptimisticMessage({
      conversationId: activeConversation.id,
      body,
      id: `pending-${Date.now()}`,
    });
    setDraft("");
    await sendMessage(activeConversation.id, formData);
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  if (!activeConversation) {
    return (
      <main className="grid h-dvh place-items-center bg-stone-100 px-4 text-stone-900">
        <section className="w-full max-w-sm rounded-lg border border-stone-300 bg-white p-6 text-center">
          <h1 className="text-lg font-semibold">Knot</h1>
          <p className="mt-4 text-sm text-stone-500">You don&apos;t have any conversations yet.</p>
          <button className="mt-5 text-sm font-medium underline underline-offset-2" onClick={signOut} type="button">Sign out</button>
        </section>
      </main>
    );
  }

  return (
    <main className="h-dvh bg-stone-100 p-0 text-stone-900 sm:p-4">
      <div className="relative mx-auto grid h-full max-w-6xl overflow-hidden border-stone-300 bg-white sm:grid-cols-[280px_1fr] sm:rounded-lg sm:border">
        {sidebarOpen && <button aria-label="Close conversations" className="absolute inset-0 z-10 bg-black/20 sm:hidden" onClick={() => setSidebarOpen(false)} type="button" />}

        <aside className={`absolute inset-y-0 left-0 z-20 flex w-[280px] flex-col border-r border-stone-200 bg-white transition-transform sm:static sm:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 px-4">
            <div>
              <h1 className="text-lg font-semibold">Knot</h1>
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-stone-400">Tying people together.</p>
                <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">Demo</span>
              </div>
            </div>
            <button aria-label="Start a new conversation" className="grid size-8 place-items-center rounded-md border border-stone-300 text-xl leading-none hover:bg-stone-50" onClick={startConversation} type="button">+</button>
          </header>

          <div className="p-3">
            <label className="sr-only" htmlFor="conversation-search">Search conversations</label>
            <input className="h-9 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-sm outline-none placeholder:text-stone-400 focus:border-stone-500" id="conversation-search" onChange={(event) => setSearch(event.target.value)} placeholder="Search" type="search" value={search} />
          </div>

          <nav aria-label="Conversations" className="flex-1 overflow-y-auto px-2">
            {visibleConversations.map((conversation) => {
              const lastMessage = conversation.messages.at(-1)?.body ?? "No messages yet";

              return (
                <button className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left ${conversation.id === activeConversation.id ? "bg-stone-100" : "hover:bg-stone-50"}`} key={conversation.id} onClick={() => chooseConversation(conversation.id)} type="button">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-stone-200 text-sm font-medium">{conversation.name.charAt(0)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{conversation.name}</span>
                      <span className="shrink-0 text-xs text-stone-400">{conversation.time}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-stone-500">{lastMessage}</span>
                  </span>
                </button>
              );
            })}
            {visibleConversations.length === 0 && <p className="px-3 py-6 text-center text-sm text-stone-400">No conversations found</p>}
          </nav>

          <footer className="flex items-center gap-3 border-t border-stone-200 p-4">
            <span className="grid size-8 place-items-center rounded-full bg-stone-900 text-xs font-medium text-white">{currentUserName.charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{currentUserName}</span>
            <button className="text-xs text-stone-500 hover:text-stone-900" onClick={signOut} type="button">Sign out</button>
          </footer>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 px-4 sm:px-5">
            <div className="flex items-center gap-3">
              <button aria-label="Open conversations" className="text-xl sm:hidden" onClick={() => setSidebarOpen(true)} type="button">≡</button>
              <span className="grid size-9 place-items-center rounded-full bg-stone-200 text-sm font-medium">{activeConversation.name.charAt(0)}</span>
              <div>
                <h2 className="text-sm font-semibold">{activeConversation.name}</h2>
                <p className="text-xs text-stone-500">{activeConversation.status}</p>
              </div>
            </div>
            <button aria-label="Conversation options" className="px-2 text-xl text-stone-500" type="button">···</button>
          </header>

          <div aria-live="polite" className="flex flex-1 flex-col justify-end overflow-y-auto px-4 py-6 sm:px-8">
            <p className="mb-6 text-center text-xs text-stone-400">Today</p>
            <div className="space-y-4">
              {activeConversation.messages.map((message) => (
                <div className={`flex ${message.sender === "me" ? "justify-end" : "justify-start"}`} key={message.id}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${message.sender === "me" ? "rounded-br-md bg-stone-900 text-white" : "rounded-bl-md bg-stone-100"}`}>{message.body}</div>
                </div>
              ))}
            </div>
          </div>

          <form action={submitMessage} className="flex shrink-0 items-end gap-2 border-t border-stone-200 p-3 sm:p-4">
            <label aria-label="Add attachment" className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-md text-xl text-stone-500 hover:bg-stone-100">
              +
              <input className="sr-only" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setDraft((current) => `${current}${current ? " " : ""}[${file.name}]`);
                event.target.value = "";
              }} type="file" />
            </label>
            <label className="sr-only" htmlFor="message">Message {activeConversation.name}</label>
            <textarea className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm leading-6 outline-none placeholder:text-stone-400 focus:border-stone-500" id="message" name="message" onChange={(event) => setDraft(event.target.value)} placeholder="Write a message" required rows={1} value={draft} />
            <button aria-label="Send message" className="grid size-10 shrink-0 place-items-center rounded-lg bg-stone-900 text-lg text-white hover:bg-stone-700 disabled:cursor-default disabled:bg-stone-300" disabled={!draft.trim()} type="submit">→</button>
          </form>
        </section>
      </div>
    </main>
  );
}
