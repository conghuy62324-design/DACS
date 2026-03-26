import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HCH Restaurant",
  description: "Trang menu va quan ly nha hang HCH Restaurant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
