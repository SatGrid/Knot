const conversations = [
  { name: "Maya", preview: "See you tomorrow", time: "9:42", active: true },
  { name: "Project group", preview: "Jon: I pushed the update", time: "8:18" },
  { name: "Leo", preview: "Sounds good", time: "Yesterday" },
];

export default function Home() {
  return (
    <main className="h-dvh bg-stone-100 p-0 text-stone-900 sm:p-4">
      <div className="mx-auto grid h-full max-w-6xl overflow-hidden border-stone-300 bg-white sm:grid-cols-[280px_1fr] sm:rounded-lg sm:border">
        <aside className="hidden border-r border-stone-200 sm:flex sm:flex-col">
          <header className="flex h-16 items-center justify-between border-b border-stone-200 px-4">
            <h1 className="text-lg font-semibold">Knot</h1>
            <button aria-label="Start a new conversation" className="grid size-8 place-items-center rounded-md border border-stone-300 text-xl leading-none hover:bg-stone-50" type="button">
              +
            </button>
          </header>

          <div className="p-3">
            <label className="sr-only" htmlFor="conversation-search">Search conversations</label>
            <input className="h-9 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-sm outline-none placeholder:text-stone-400 focus:border-stone-500" id="conversation-search" placeholder="Search" type="search" />
          </div>

          <nav aria-label="Conversations" className="flex-1 px-2">
            {conversations.map((conversation) => (
              <button className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left ${conversation.active ? "bg-stone-100" : "hover:bg-stone-50"}`} key={conversation.name} type="button">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-stone-200 text-sm font-medium">{conversation.name.charAt(0)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{conversation.name}</span>
                    <span className="shrink-0 text-xs text-stone-400">{conversation.time}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-stone-500">{conversation.preview}</span>
                </span>
              </button>
            ))}
          </nav>

          <footer className="flex items-center gap-3 border-t border-stone-200 p-4">
            <span className="grid size-8 place-items-center rounded-full bg-stone-900 text-xs font-medium text-white">S</span>
            <span className="text-sm font-medium">Satya</span>
          </footer>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 px-4 sm:px-5">
            <div className="flex items-center gap-3">
              <button aria-label="Open conversations" className="text-xl sm:hidden" type="button">≡</button>
              <span className="grid size-9 place-items-center rounded-full bg-stone-200 text-sm font-medium">M</span>
              <div>
                <h2 className="text-sm font-semibold">Maya</h2>
                <p className="text-xs text-stone-500">Online</p>
              </div>
            </div>
            <button aria-label="Conversation options" className="px-2 text-xl text-stone-500" type="button">···</button>
          </header>

          <div className="flex flex-1 flex-col justify-end overflow-y-auto px-4 py-6 sm:px-8">
            <p className="mb-6 text-center text-xs text-stone-400">Today</p>
            <div className="space-y-4">
              <div className="flex justify-start">
                <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-stone-100 px-4 py-2.5 text-sm leading-6">Are we still meeting at the café tomorrow?</div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[78%] rounded-2xl rounded-br-md bg-stone-900 px-4 py-2.5 text-sm leading-6 text-white">Yes, 10 works for me.</div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-stone-100 px-4 py-2.5 text-sm leading-6">Perfect. See you tomorrow.</div>
              </div>
            </div>
          </div>

          <form className="flex shrink-0 items-end gap-2 border-t border-stone-200 p-3 sm:p-4">
            <button aria-label="Add attachment" className="grid size-10 shrink-0 place-items-center rounded-md text-xl text-stone-500 hover:bg-stone-100" type="button">+</button>
            <label className="sr-only" htmlFor="message">Message Maya</label>
            <textarea className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm leading-6 outline-none placeholder:text-stone-400 focus:border-stone-500" id="message" placeholder="Write a message" rows={1} />
            <button aria-label="Send message" className="grid size-10 shrink-0 place-items-center rounded-lg bg-stone-900 text-lg text-white hover:bg-stone-700" type="submit">→</button>
          </form>
        </section>
      </div>
    </main>
  );
}
