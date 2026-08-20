import type { Metadata } from "next";
import { DM_Serif_Display, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";

/**
 * The design system's three typefaces, in the three roles it names: Inter for
 * all UI text and body copy, DM Serif Display for display and section
 * headings (loaded italic *and* roman — the system only ever sets it italic,
 * but a synthesised oblique from a roman-only load is not the same letterform
 * and is exactly what the tight -0.03em tracking would expose), and IBM Plex
 * Mono for statistics and financial figures at weight 300.
 *
 * All three are self-hosted through `next/font`, so `tokens/typography.css`'s
 * stacks resolve to a local family rather than a Google Fonts request —
 * `globals.css` does the re-pointing, the same substitution the design
 * system's own README asks for.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Incentiv",
  description: "Private-markets infrastructure for Indian companies.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${dmSerifDisplay.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
