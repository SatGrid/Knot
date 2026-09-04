"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMessage, editMessage, renameConversation, sendMessage, startConversationByEmail, updateConversationPreference } from "./actions";
import { authClient } from "@/lib/auth-client";

type MessageView = {
  id: string;
  body: string;
  sender: "me" | "them";
  time: string;
  delivery?: "Sent" | "Read";
  edited: boolean;
};

export type ConversationView = {
  id: string;
  name: string;
  status: string;
  time: string;
  messages: MessageView[];
  archived: boolean;
  muted: boolean;
  unread: boolean;
};

type OptimisticChange =
  | { type: "add"; conversationId: string; body: string; id: string }
  | { type: "edit"; messageId: string; body: string }
  | { type: "delete"; messageId: string };

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
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newConversationEmail, setNewConversationEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedIds, setArchivedIds] = useState<string[]>(() => initialConversations.filter(({ archived }) => archived).map(({ id }) => id));
  const [mutedIds, setMutedIds] = useState<string[]>(() => initialConversations.filter(({ muted }) => muted).map(({ id }) => id));
  const messageEndRef = useRef<HTMLDivElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renamePending, setRenamePending] = useState(false);
  const [editingMessage, setEditingMessage] = useState<MessageView | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingMessage, setDeletingMessage] = useState<MessageView | null>(null);
  const [, startMessageTransition] = useTransition();
  const [conversations, applyOptimisticChange] = useOptimistic(
    initialConversations,
    (current, change: OptimisticChange) => current.map((conversation) => {
      if (change.type === "add" && conversation.id === change.conversationId) {
        return { ...conversation, time: "Now", messages: [...conversation.messages, { id: change.id, body: change.body, sender: "me", time: "Now", delivery: "Sent", edited: false }] };
      }
      if (change.type === "edit") {
        return { ...conversation, messages: conversation.messages.map((message) => message.id === change.messageId ? { ...message, body: change.body, edited: true } : message) };
      }
      if (change.type === "delete") {
        return { ...conversation, messages: conversation.messages.filter((message) => message.id !== change.messageId) };
      }
      return conversation;
    }),
  );

  useEffect(() => {
    const events = new EventSource("/api/events");
    events.onmessage = () => router.refresh();
    return () => events.close();
  }, [router]);

  const activeConversation = conversations.find(({ id }) => id === activeId) ?? conversations[0];
  const unreadIds = useMemo(() => conversations.filter(({ unread }) => unread).map(({ id }) => id), [conversations]);
  const visibleConversations = useMemo(
    () => conversations.filter(({ id, name }) => archivedIds.includes(id) === showArchived && name.toLowerCase().includes(search.toLowerCase())),
    [conversations, search, archivedIds, showArchived],
  );
  const messageMatches = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    if (!query || !activeConversation) return [];
    return activeConversation.messages.filter(({ body }) => body.toLowerCase().includes(query)).map(({ id }) => id);
  }, [activeConversation, messageSearch]);

  useEffect(() => {
    setActiveMatch(0);
  }, [messageSearch, activeId]);

  useEffect(() => {
    const id = messageMatches[activeMatch];
    if (id) document.getElementById(`message-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeMatch, messageMatches]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [activeId, activeConversation?.messages.length]);

  useEffect(() => {
    if (!activeConversation?.unread) return;
    void updateConversationPreference(activeConversation.id, "unread", false).then(() => router.refresh());
  }, [activeConversation?.id, activeConversation?.unread, router]);

  function chooseConversation(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
    setMessageSearchOpen(false);
    setMessageSearch("");
  }

  function highlightedMessage(body: string) {
    const query = messageSearch.trim();
    if (!query) return body;
    const index = body.toLowerCase().indexOf(query.toLowerCase());
    if (index < 0) return body;
    return <>{body.slice(0, index)}<mark className="rounded-sm bg-amber-200 px-0.5 text-inherit">{body.slice(index, index + query.length)}</mark>{body.slice(index + query.length)}</>;
  }

  async function startConversation() {
    const email = newConversationEmail.trim();
    if (!email) return;
    try {
      const result = await startConversationByEmail(email);
      setActiveId(result.id);
      setNewConversationEmail("");
      setNewConversationOpen(false);
      router.refresh();
    } catch {
      setNewConversationEmail(email);
    }
  }

  function submitMessage(formData: FormData) {
    if (!activeConversation) return;

    const body = String(formData.get("message") ?? "").trim();
    if (!body) return;

    const pendingId = `pending-${Date.now()}`;
    setDraft("");
    startMessageTransition(async () => {
      applyOptimisticChange({
        type: "add",
        conversationId: activeConversation.id,
        body,
        id: pendingId,
      });
      try {
        await sendMessage(activeConversation.id, formData);
        router.refresh();
      } catch {
        setDraft(body);
      }
    });
  }

  function openRenameDialog() {
    setRenameValue(activeConversation.name);
    setRenameError("");
    setMenuOpen(false);
    setRenameOpen(true);
  }

  async function submitRename() {
    const title = renameValue.trim();
    if (!title || renamePending) return;
    setRenamePending(true);
    setRenameError("");

    try {
      await renameConversation(activeConversation.id, title);
      setRenameOpen(false);
      router.refresh();
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : "Could not rename this conversation.");
    } finally {
      setRenamePending(false);
    }
  }

  function submitMessageEdit() {
    if (!editingMessage || !editValue.trim()) return;
    const messageId = editingMessage.id;
    const body = editValue.trim();
    setEditingMessage(null);
    startMessageTransition(async () => {
      applyOptimisticChange({ type: "edit", messageId, body });
      await editMessage(messageId, body);
      router.refresh();
    });
  }

  function confirmMessageDelete() {
    if (!deletingMessage) return;
    const messageId = deletingMessage.id;
    setDeletingMessage(null);
    startMessageTransition(async () => {
      applyOptimisticChange({ type: "delete", messageId });
      await deleteMessage(messageId);
      router.refresh();
    });
  }

  async function toggleUnread() {
    const enabled = !activeConversation.unread;
    await updateConversationPreference(activeConversation.id, "unread", enabled);
    setMenuOpen(false);
    router.refresh();
  }

  async function toggleMuted() {
    const enabled = !mutedIds.includes(activeConversation.id);
    await updateConversationPreference(activeConversation.id, "muted", enabled);
    setMutedIds((ids) => enabled ? [...ids, activeConversation.id] : ids.filter((id) => id !== activeConversation.id));
    setMenuOpen(false);
  }

  async function toggleArchived() {
    const enabled = !archivedIds.includes(activeConversation.id);
    await updateConversationPreference(activeConversation.id, "archived", enabled);
    setArchivedIds((ids) => enabled ? [...ids, activeConversation.id] : ids.filter((id) => id !== activeConversation.id));
    setMenuOpen(false);
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
    <main className="h-dvh overflow-hidden bg-slate-100 p-0 text-slate-900 sm:p-4">
      <div className="relative mx-auto grid h-full max-w-6xl overflow-hidden border-slate-200 bg-slate-50 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:grid-cols-[280px_1fr] sm:rounded-2xl sm:border">
        {sidebarOpen && <button aria-label="Close conversations" className="absolute inset-0 z-10 bg-black/20 sm:hidden" onClick={() => setSidebarOpen(false)} type="button" />}

        <aside className={`absolute inset-y-0 left-0 z-20 flex w-[280px] flex-col border-r border-slate-200 bg-slate-50 transition-transform sm:static sm:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 px-4">
            <div>
              <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Knot</h1>
              <div className="flex items-center gap-2">
                <p className="text-[11px] leading-4 text-stone-400">Tying people together.</p>
                <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">Demo</span>
              </div>
            </div>
            <button aria-label="Start a new conversation" className="grid size-8 place-items-center rounded-md border border-stone-300 text-xl leading-none hover:bg-stone-50" onClick={() => setNewConversationOpen(true)} type="button">+</button>
          </header>

          <div className="p-3">
            <label className="sr-only" htmlFor="conversation-search">Search conversations</label>
            <input className="h-9 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-sm outline-none placeholder:text-stone-400 focus:border-stone-500" id="conversation-search" onChange={(event) => setSearch(event.target.value)} placeholder="Search" type="search" value={search} />
            <button className="mt-2 text-xs text-slate-500 hover:text-slate-900" onClick={() => setShowArchived((shown) => !shown)} type="button">{showArchived ? "Back to conversations" : `Archived (${archivedIds.length})`}</button>
          </div>

          <nav aria-label="Conversations" className="flex-1 overflow-y-auto px-2">
            {visibleConversations.map((conversation) => {
              const lastMessage = conversation.messages.at(-1)?.body ?? "No messages yet";

              return (
                <button className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left ${conversation.id === activeConversation.id ? "bg-stone-100" : "hover:bg-stone-50"}`} key={conversation.id} onClick={() => chooseConversation(conversation.id)} type="button">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-stone-200 text-sm font-medium">{conversation.name.charAt(0)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-[14px] tracking-[-0.005em] ${unreadIds.includes(conversation.id) ? "font-bold text-slate-950" : "font-semibold"}`}>{conversation.name}</span>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs text-stone-400">{unreadIds.includes(conversation.id) && <span aria-label="Unread" className="size-2 rounded-full bg-blue-600" title="Unread" />}{conversation.time}</span>
                    </span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-2"><span className={`min-w-0 flex-1 truncate text-[13px] leading-5 ${unreadIds.includes(conversation.id) ? "font-semibold text-slate-800" : "font-normal text-stone-500"}`}>{lastMessage}</span>{mutedIds.includes(conversation.id) && <span className="shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-600">Muted</span>}</span>
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

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-white">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 px-4 sm:px-5">
            <div className="flex items-center gap-3">
              <button aria-label="Open conversations" className="text-xl sm:hidden" onClick={() => setSidebarOpen(true)} type="button">≡</button>
              <span className="grid size-9 place-items-center rounded-full bg-stone-200 text-sm font-medium">{activeConversation.name.charAt(0)}</span>
              <div>
                <h2 className="text-[15px] font-semibold leading-5 tracking-[-0.005em]">{activeConversation.name}</h2>
                <p className="text-[12px] leading-4 text-stone-500">{activeConversation.status}</p>
              </div>
            </div>
            <div className="flex items-center gap-1"><button className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${messageSearchOpen ? "bg-stone-100 text-stone-900" : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"}`} onClick={() => { setMessageSearchOpen((open) => !open); setMessageSearch(""); }} type="button">Search</button><div className="relative"><button aria-label="Conversation options" className="px-2 text-xl text-stone-500" onClick={() => setMenuOpen((open) => !open)} type="button">···</button>{menuOpen && <div className="absolute right-0 top-9 z-10 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"><button className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => void toggleUnread()} type="button">{unreadIds.includes(activeConversation.id) ? "Mark read" : "Mark unread"}</button><button className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => void toggleMuted()} type="button">{mutedIds.includes(activeConversation.id) ? "Unmute" : "Mute notifications"}</button><button className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={openRenameDialog} type="button">Rename conversation</button><button className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => void toggleArchived()} type="button">{archivedIds.includes(activeConversation.id) ? "Unarchive conversation" : "Archive conversation"}</button></div>}</div></div>
          </header>

          {messageSearchOpen && <div className="flex h-12 shrink-0 items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 sm:px-5"><input autoFocus className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400" onChange={(event) => setMessageSearch(event.target.value)} placeholder="Search this conversation" type="search" value={messageSearch} /><span className="shrink-0 text-[11px] tabular-nums text-stone-400">{messageSearch.trim() ? messageMatches.length ? `${activeMatch + 1} of ${messageMatches.length}` : "No results" : ""}</span><button aria-label="Previous result" className="grid size-7 place-items-center rounded-md text-stone-500 hover:bg-stone-200 disabled:opacity-30" disabled={!messageMatches.length} onClick={() => setActiveMatch((current) => (current - 1 + messageMatches.length) % messageMatches.length)} type="button">↑</button><button aria-label="Next result" className="grid size-7 place-items-center rounded-md text-stone-500 hover:bg-stone-200 disabled:opacity-30" disabled={!messageMatches.length} onClick={() => setActiveMatch((current) => (current + 1) % messageMatches.length)} type="button">↓</button><button aria-label="Close search" className="grid size-7 place-items-center rounded-md text-stone-500 hover:bg-stone-200" onClick={() => { setMessageSearchOpen(false); setMessageSearch(""); }} type="button">×</button></div>}

          <div aria-live="polite" className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto px-4 py-6 sm:px-8">
            <p className="mb-6 text-center text-xs text-stone-400">Today</p>
            <div className="space-y-4">
              {activeConversation.messages.map((message) => (
                <div className={`flex rounded-xl transition ${messageMatches[activeMatch] === message.id ? "bg-amber-50/70" : ""} ${message.sender === "me" ? "justify-end" : "justify-start"}`} id={`message-${message.id}`} key={message.id}>
                  <div className={`group max-w-[78%] ${message.sender === "me" ? "text-right" : "text-left"}`}><div className="flex items-center gap-2">{message.sender === "me" && <span className="flex items-center gap-2 text-[11px] font-medium text-stone-400 opacity-100 transition sm:translate-x-1 sm:opacity-0 sm:group-hover:translate-x-0 sm:group-hover:opacity-100"><button className="transition hover:text-stone-900" onClick={() => { setEditingMessage(message); setEditValue(message.body); }} type="button">Edit</button><span className="text-stone-200">·</span><button className="transition hover:text-stone-900" onClick={() => setDeletingMessage(message)} type="button">Delete</button></span>}<div className={`rounded-2xl px-4 py-2.5 text-left text-[14px] leading-[1.55] shadow-sm ${message.sender === "me" ? "rounded-br-md bg-stone-900 text-white" : "rounded-bl-md bg-stone-100"}`}>{highlightedMessage(message.body)}</div></div><p className="mt-1 px-1 text-[10px] leading-4 text-stone-400">{message.time}{message.edited ? " · Edited" : ""}{message.delivery ? ` · ${message.delivery}` : ""}</p></div>
                </div>
              ))}
              <div ref={messageEndRef} />
            </div>
          </div>

          <form className="flex shrink-0 items-end gap-2 border-t border-stone-200 p-3 sm:p-4" onSubmit={(event) => { event.preventDefault(); void submitMessage(new FormData(event.currentTarget)); }}>
            <label aria-label="Add attachment" className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-md text-xl text-stone-500 hover:bg-stone-100">
              +
              <input className="sr-only" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setDraft((current) => `${current}${current ? " " : ""}[${file.name}]`);
                event.target.value = "";
              }} type="file" />
            </label>
            <label className="sr-only" htmlFor="message">Message {activeConversation.name}</label>
            <textarea className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm leading-6 outline-none placeholder:text-stone-400 focus:border-stone-500" id="message" name="message" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Write a message" required rows={1} value={draft} />
            <button aria-label="Send message" className="grid size-10 shrink-0 place-items-center rounded-lg bg-stone-900 text-lg text-white hover:bg-stone-700 disabled:cursor-default disabled:bg-stone-300" disabled={!draft.trim()} type="submit">→</button>
          </form>
        </section>
      </div>
      {newConversationOpen && <div className="fixed inset-0 z-30 grid place-items-center bg-black/20 px-4"><form className="w-full max-w-sm rounded-lg border border-stone-300 bg-white p-5 shadow-lg" onSubmit={(event) => { event.preventDefault(); void startConversation(); }}><h2 className="text-base font-semibold">New conversation</h2><p className="mt-1 text-sm text-stone-500">Enter the person’s Knot email.</p><input autoFocus className="mt-4 h-10 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-stone-500" onChange={(event) => setNewConversationEmail(event.target.value)} placeholder="name@example.com" type="email" value={newConversationEmail} /><div className="mt-4 flex justify-end gap-2"><button className="px-3 py-2 text-sm text-stone-500" onClick={() => setNewConversationOpen(false)} type="button">Cancel</button><button className="rounded-md bg-stone-900 px-3 py-2 text-sm text-white" type="submit">Start chat</button></div></form></div>}
      {renameOpen && <div className="fixed inset-0 z-30 grid place-items-center bg-black/25 px-4"><form className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl" onSubmit={(event) => { event.preventDefault(); void submitRename(); }}><h2 className="text-base font-semibold">Rename conversation</h2><p className="mt-1 text-sm text-slate-500">Choose a name that will appear for everyone in this chat.</p><input autoFocus className="mt-4 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500" maxLength={80} onChange={(event) => setRenameValue(event.target.value)} required value={renameValue} />{renameError && <p className="mt-2 text-sm text-red-600">{renameError}</p>}<div className="mt-4 flex justify-end gap-2"><button className="px-3 py-2 text-sm text-slate-500" disabled={renamePending} onClick={() => setRenameOpen(false)} type="button">Cancel</button><button className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:bg-slate-400" disabled={renamePending || !renameValue.trim()} type="submit">{renamePending ? "Saving…" : "Save name"}</button></div></form></div>}
      {editingMessage && <div className="fixed inset-0 z-30 grid place-items-center bg-stone-950/30 px-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingMessage(null); }}><form className="w-full max-w-md rounded-2xl border border-white/70 bg-white p-5 shadow-2xl shadow-stone-950/20" onSubmit={(event) => { event.preventDefault(); submitMessageEdit(); }}><div className="flex items-start justify-between"><div><h2 className="text-[17px] font-semibold tracking-tight">Edit message</h2><p className="mt-1 text-xs text-stone-500">Update your message for everyone.</p></div><button aria-label="Close" className="grid size-8 place-items-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200" onClick={() => setEditingMessage(null)} type="button">×</button></div><textarea autoFocus className="mt-5 min-h-28 w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 outline-none transition focus:border-stone-400 focus:bg-white focus:ring-4 focus:ring-stone-100" maxLength={4000} onChange={(event) => setEditValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} required value={editValue} /><div className="mt-4 flex justify-end gap-2"><button className="rounded-lg px-4 py-2.5 text-sm font-medium text-stone-500 hover:bg-stone-100" onClick={() => setEditingMessage(null)} type="button">Cancel</button><button className="rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700 disabled:bg-stone-300" disabled={!editValue.trim()} type="submit">Save changes</button></div></form></div>}
      {deletingMessage && <div className="fixed inset-0 z-30 grid place-items-center bg-stone-950/30 px-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeletingMessage(null); }}><section className="w-full max-w-sm rounded-2xl border border-white/70 bg-white p-5 shadow-2xl shadow-stone-950/20"><h2 className="text-[17px] font-semibold tracking-tight">Delete this message?</h2><p className="mt-1.5 text-sm leading-5 text-stone-500">It will disappear for everyone in this conversation. This cannot be undone.</p><div className="mt-5 grid grid-cols-2 gap-2"><button className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50" onClick={() => setDeletingMessage(null)} type="button">Keep message</button><button className="rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700" onClick={confirmMessageDelete} type="button">Delete</button></div></section></div>}
    </main>
  );
}
