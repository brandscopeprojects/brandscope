export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-base px-4 text-center">
      <h1 className="font-display text-4xl font-bold text-ink">403</h1>
      <p className="text-ink-secondary">You don’t have access to this area.</p>
    </main>
  );
}
