"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ScanResult {
  id: string;
  disease: string;
  confidence: number;
  image: string;
  date: Date;
  severity: "low" | "medium" | "high";
}

type StoredScanResult = Omit<ScanResult, "date"> & { date: string };

// Flask /history returns an array of these
interface HistoryItem {
  id: string | number;
  predicted_class: string;
  confidence: number;
  severity?: "low" | "medium" | "high";
  created_at: string;
}

const fieldTips = [
  "Scan leaves in natural light for clearer results.",
  "Capture both sides of the leaf when possible.",
  "Review high severity scans and act quickly.",
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

function getSeverity(confidence: number, disease: string): "low" | "medium" | "high" {
  if (disease.toLowerCase() === "healthy") return "low";
  const c = confidence > 1 ? confidence / 100 : confidence;
  if (c >= 0.9) return "high";
  if (c >= 0.75) return "medium";
  return "low";
}

export default function HomePage() {
  const { user, token, isAuthReady } = useAuth();
  const router = useRouter();
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [loadingScans, setLoadingScans] = useState(false);

  useEffect(() => {
    if (isAuthReady && !user) {
      router.push("/login");
    }
  }, [isAuthReady, user, router]);

  useEffect(() => {
    if (!user) {
      setScans([]);
      return;
    }

    const fetchHistory = async () => {
      setLoadingScans(true);
      try {
        const res = await fetch(`${API_BASE}/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json() as HistoryItem[];
          const mapped: ScanResult[] = data.map((item) => ({
            id: String(item.id),
            disease: item.predicted_class,
            confidence: item.confidence > 1
              ? Math.round(item.confidence)
              : Math.round(item.confidence * 100),
            image: "",
            date: new Date(item.created_at),
            severity: item.severity ?? getSeverity(item.confidence, item.predicted_class),
          }));
          setScans(mapped);
          return;
        }
      } catch {
        // fall through to localStorage
      } finally {
        setLoadingScans(false);
      }

      // Fallback to localStorage if API unavailable
      try {
        const history = JSON.parse(
          localStorage.getItem("scanHistory") || "[]"
        ) as StoredScanResult[];
        setScans(history.map((s) => ({ ...s, date: new Date(s.date) })));
      } catch {
        setScans([]);
      }
    };

    fetchHistory();
  }, [user, token]);

  const stats = useMemo(() => ({
    total: scans.length,
    highSeverity: scans.filter((s) => s.severity === "high").length,
    healthy: scans.filter((s) => s.disease.toLowerCase() === "healthy").length,
  }), [scans]);

  const latestScan = scans[0];
  const recentScans = scans.slice(0, 3);

  if (!isAuthReady) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="surface p-6 text-sm text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="surface p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Home Base</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
              Welcome back, {user.name || "Farmer"}.
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Quick actions and your latest field insights in one place.
            </p>
          </div>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            <Link href="/camera" className="btn-primary w-full">Start Scan</Link>
            <Link href="/history" className="btn-secondary w-full">View History</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="surface p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Scans</p>
          <p className="mt-3 text-3xl font-semibold text-green-700">
            {loadingScans ? "—" : stats.total}
          </p>
          <p className="mt-2 text-sm text-slate-600">Your scanned leaves to date.</p>
        </article>
        <article className="surface p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">High Severity</p>
          <p className="mt-3 text-3xl font-semibold text-red-600">
            {loadingScans ? "—" : stats.highSeverity}
          </p>
          <p className="mt-2 text-sm text-slate-600">Needs fast field attention.</p>
        </article>
        <article className="surface p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Healthy Leaves</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-700">
            {loadingScans ? "—" : stats.healthy}
          </p>
          <p className="mt-2 text-sm text-slate-600">Great condition scans.</p>
        </article>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="surface p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Latest Activity</h2>
              <p className="mt-2 text-sm text-slate-600">Your most recent scans and notes.</p>
            </div>
            <Link href="/history" className="text-sm font-semibold text-green-700 hover:text-green-800">
              View all
            </Link>
          </div>

          {loadingScans ? (
            <div className="mt-6 text-sm text-slate-500">Loading scans...</div>
          ) : recentScans.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-center">
              <p className="text-sm text-slate-600">
                No scans yet. Start a new scan to build your history.
              </p>
              <Link href="/camera" className="btn-primary mt-4">Start First Scan</Link>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {recentScans.map((scan) => (
                <div
                  key={scan.id}
                  className="surface-soft flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{scan.disease}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {scan.date.toLocaleDateString()} at {scan.date.toLocaleTimeString()}
                    </p>
                    <p className="mt-2 text-xs text-slate-600">Confidence: {scan.confidence}%</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                      scan.severity === "high"
                        ? "bg-red-100 text-red-700"
                        : scan.severity === "medium"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {scan.severity} severity
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="surface p-6">
            <h3 className="text-lg font-semibold text-slate-900">Latest Scan</h3>
            {latestScan ? (
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p><span className="font-semibold text-slate-800">Disease:</span> {latestScan.disease}</p>
                <p><span className="font-semibold text-slate-800">Confidence:</span> {latestScan.confidence}%</p>
                <p><span className="font-semibold text-slate-800">Severity:</span> {latestScan.severity}</p>
                <p><span className="font-semibold text-slate-800">Date:</span> {latestScan.date.toLocaleDateString()}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                No scans yet. Capture your first leaf to populate this panel.
              </p>
            )}
          </div>

          <div className="surface p-6">
            <h3 className="text-lg font-semibold text-slate-900">Field Checklist</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {fieldTips.map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-green-600" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/settings"
              className="mt-4 inline-flex text-sm font-semibold text-green-700 hover:text-green-800"
            >
              Update preferences
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}