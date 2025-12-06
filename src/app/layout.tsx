import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Goalie Tracker",
  description: "Live tracking gólmanských statistik",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body className="min-h-screen bg-bgMain text-slate-50">
        <div className="mx-auto flex min-h-screen max-w-md flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
