"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-bold">משהו השתבש</h1>
      <p className="text-muted">נסו שוב. אם זה חוזר, דווחו לנו דרך &quot;דיווח תקלה&quot;.</p>
      <button type="button" onClick={reset} className="rounded-full bg-primary px-5 py-2 font-semibold text-on-primary">ניסיון נוסף</button>
    </main>
  );
}
