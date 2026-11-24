import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-6xl font-extrabold text-primary">404</p>
      <h1 className="text-xl font-bold">הדף לא נמצא, או שאין לכם גישה אליו</h1>
      <Link href="/" className="font-semibold text-primary underline">חזרה לדף הבית</Link>
    </main>
  );
}
