"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Recharts is heavy: load it only when a chart is actually on screen, never on the server. */
const fallback = () => <Skeleton className="h-64 w-full" />;

export const TrendChart = dynamic(() => import("@/components/charts/charts").then((m) => m.TrendChart), { ssr: false, loading: fallback });
export const BarsChart = dynamic(() => import("@/components/charts/charts").then((m) => m.BarsChart), { ssr: false, loading: fallback });
