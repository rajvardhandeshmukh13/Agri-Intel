// app/(dashboard)/history/page.tsx
// Farm History — season-by-season record (demo data).

'use client';

import Link from 'next/link';

type Season = {
  season: string;
  crop: string;
  emoji: string;
  area: string;
  sown: string;
  harvested: string;
  yieldQtl: string;
  yieldPerHa: string;
  price: string;
  mandi: string;
  net: string;
  action: string;
  status: "In progress" | "Completed";
  health: string;
};

const seasons: Season[] = [
  {
    season: "Kharif 2026",
    crop: "Soybean",
    emoji: "🌱",
    area: "3.5 ha · rainfed",
    sown: "19 Jun 2026",
    harvested: "Expected 14 Oct 2026",
    yieldQtl: "68.3 qtl (est.)",
    yieldPerHa: "16.1 qtl/ha",
    price: "₹4,380 / qtl today",
    mandi: "Pune mandi",
    net: "₹2,86,745 (est.)",
    action: "Sell Now — advised 8 Oct 2026",
    status: "In progress",
    health: "NDVI 0.62 · Moderate",
  },
  {
    season: "Summer 2026",
    crop: "Green Gram (Moong)",
    emoji: "🫛",
    area: "1.5 ha · irrigated",
    sown: "18 Mar 2026",
    harvested: "08 Jun 2026",
    yieldQtl: "6.4 qtl",
    yieldPerHa: "4.3 qtl/ha",
    price: "₹7,150 / qtl",
    mandi: "Latur mandi",
    net: "₹43,826",
    action: "Sold in single lot — advised 30 May 2026",
    status: "Completed",
    health: "NDVI 0.58 · Good",
  },
  {
    season: "Rabi 2025–26",
    crop: "Gram (Chana)",
    emoji: "🫘",
    area: "2.0 ha · rainfed",
    sown: "14 Oct 2025",
    harvested: "26 Feb 2026",
    yieldQtl: "19.8 qtl",
    yieldPerHa: "9.9 qtl/ha",
    price: "₹5,480 / qtl",
    mandi: "Latur mandi",
    net: "₹1,03,262",
    action: "Held 3 weeks for MSP rise — advised 20 Jan 2026",
    status: "Completed",
    health: "NDVI 0.55 · Good",
  },
  {
    season: "Kharif 2025",
    crop: "Soybean",
    emoji: "🌱",
    area: "3.5 ha · rainfed",
    sown: "21 Jun 2025",
    harvested: "11 Oct 2025",
    yieldQtl: "61.5 qtl",
    yieldPerHa: "17.6 qtl/ha",
    price: "₹4,010 / qtl",
    mandi: "Pune mandi",
    net: "₹2,36,842",
    action: "Sold in two lots before rain — advised 28 Sep 2025",
    status: "Completed",
    health: "NDVI 0.60 · Moderate",
  },
  {
    season: "Rabi 2024–25",
    crop: "Wheat",
    emoji: "🌾",
    area: "2.5 ha · irrigated",
    sown: "08 Nov 2024",
    harvested: "18 Mar 2025",
    yieldQtl: "92.0 qtl",
    yieldPerHa: "36.8 qtl/ha",
    price: "₹2,650 / qtl",
    mandi: "Latur mandi",
    net: "₹2,38,405",
    action: "Stored 1 month, sold on price peak — advised 05 Apr 2025",
    status: "Completed",
    health: "NDVI 0.71 · Good",
  },
];

export default function FarmHistoryPage() {
  const completed = seasons.filter((s) => s.status === 'Completed');
  const totalNet = completed.reduce((sum, s) => sum + Number(s.net.replace(/[^\d]/g, '')), 0);

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/farm" aria-label="Back to My Farm" className="flex size-8 items-center justify-center rounded-lg border border-border bg-card">←</Link>
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Farm History</h2>
          <p className="text-sm text-muted-foreground">Season-by-season record</p>
        </div>
      </div>

      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-xs">
          <p className="text-xl font-bold">{seasons.length}</p>
          <p className="text-[11px] text-muted-foreground">Seasons tracked</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-xs">
          <p className="text-xl font-bold text-primary">{new Set(seasons.map((s) => s.crop)).size}</p>
          <p className="text-[11px] text-muted-foreground">Crops grown</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-xs">
          <p className="text-xl font-bold text-primary">₹{(totalNet / 100000).toFixed(1)}L</p>
          <p className="text-[11px] text-muted-foreground">Total net realized</p>
        </div>
      </section>

      <div className="space-y-4">
        {seasons.map((s) => (
          <SeasonCard key={s.season} season={s} />
        ))}
      </div>
    </div>
  );
}

function SeasonCard({ season: s }: { season: Season }) {
  const inProgress = s.status === "In progress";
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{s.emoji}</span>
          <div>
            <h2 className="text-base font-bold leading-tight">{s.season}</h2>
            <p className="text-sm text-muted-foreground">{s.crop}</p>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            inProgress
              ? "bg-amber-100 text-amber-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {s.status}
        </span>
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        {s.area} · {s.health}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
            Sown / Harvested
          </p>
          <p className="mt-0.5 font-medium">
            {s.sown} → {s.harvested}
          </p>
        </div>
        <div>
          <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
            Yield
          </p>
          <p className="mt-0.5 font-medium">
            {s.yieldQtl} <span className="text-muted-foreground">({s.yieldPerHa})</span>
          </p>
        </div>
        <div>
          <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
            Sold at
          </p>
          <p className="mt-0.5 font-medium">
            {s.price} <span className="text-muted-foreground">· {s.mandi}</span>
          </p>
        </div>
        <div>
          <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
            Net Realization
          </p>
          <p className="mt-0.5 font-semibold text-primary">{s.net}</p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-muted px-3 py-2">
        <span className="text-sm">💰</span>
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Advice followed: </span>
          {s.action}
        </p>
      </div>
    </section>
  );
}

