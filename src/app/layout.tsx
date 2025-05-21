import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StagewiseToolbar } from '@stagewise/toolbar-next';

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });
//
// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

export const metadata: Metadata = {
  title: "空余时间",
  description: "兴趣班空余时间统计",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const stagewiseConfig = { plugins: [] };
  return (
    <html lang="zh-CN">
      <body
        // className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        className="antialiased"
      >
        {children}
        {process.env.NODE_ENV === 'development' && (
          <StagewiseToolbar config={stagewiseConfig} />
        )}
      </body>
    </html>
  );
}
