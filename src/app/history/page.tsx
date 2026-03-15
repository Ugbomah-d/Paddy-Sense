"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
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

interface HistoryItem {
  id: string | number;
  predicted_class: string;
  confidence: number;
  severity?: "low" | "medium" | "high";
  created_at: string;
  image_url?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

function getSeverity(confidence: number, disease: string): "low" | "medium" | "high" {
  if (disease.toLowerCase() === "healthy") return "low";
  const c = confidence > 1 ? confidence / 100 : confidence;
  if (c >= 0.9) return "high";
  if (c >= 0.75) return "medium";
  return "low";
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "high":   return "bg-red-100 text-red-700";
    case "medium": return "bg-yellow-100 text-yellow-700";
    case "low":    return "bg-green-100 text-green-700";
    default:       return "bg-gray-100 text-gray-600";
  }
}

export default function HistoryPage() {
  const { user, token, isAuthReady } = useAuth();
  const router = useRouter();
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [loadingScans, setLoadingScans] = useState(false);
  const [selectedScans, setSelectedScans] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isAuthReady && !user) router.push("/login");
  }, [isAuthReady, user, router]);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setLoadingScans(true);
    try {
      const res = await fetch(`${API_BASE}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json() as HistoryItem[];
        setScans(data.map((item) => ({
          id: String(item.id),
          disease: item.predicted_class,
          confidence: item.confidence > 1
            ? Math.round(item.confidence)
            : Math.round(item.confidence * 100),
          image: item.image_url ? `${API_BASE}${item.image_url}` : "",
          date: new Date(item.created_at),
          severity: item.severity ?? getSeverity(item.confidence, item.predicted_class),
        })));
        return;
      }
    } catch {
      // fall through to localStorage
    } finally {
      setLoadingScans(false);
    }

    // Fallback
    try {
      const history = JSON.parse(
        localStorage.getItem("scanHistory") || "[]"
      ) as StoredScanResult[];
      setScans(history.map((s) => ({ ...s, date: new Date(s.date) })));
    } catch {
      setScans([]);
    }
  }, [user, token]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const deleteSelected = async () => {
    // Try to delete on backend first
    await Promise.allSettled(
      selectedScans.map((id) =>
        fetch(`${API_BASE}/history/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
      )
    );

    const remaining = scans.filter((s) => !selectedScans.includes(s.id));
    localStorage.setItem("scanHistory", JSON.stringify(remaining));
    setScans(remaining);
    setSelectedScans([]);
    setShowDeleteConfirm(false);
  };

  const deleteAllHistory = async () => {
    // Try backend bulk delete if endpoint exists
    await fetch(`${API_BASE}/history`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});

    localStorage.setItem("scanHistory", "[]");
    setScans([]);
    setSelectedScans([]);
    setShowDeleteConfirm(false);
  };

  const toggleScanSelection = (id: string) => {
    setSelectedScans((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

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
      <section className="surface p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Scan History</h1>
            <p className="mt-2 text-sm text-slate-600">
              Review your previous detections and manage stored scans.
            </p>
          </div>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            {selectedScans.length > 0 && (
              <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger w-full">
                Delete Selected ({selectedScans.length})
              </button>
            )}
            {scans.length > 0 && (
              <button onClick={deleteAllHistory} className="btn-secondary w-full">
                Delete All
              </button>
            )}
          </div>
        </div>

        {scans.length > 0 && (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <article className="surface-soft p-4 text-center">
              <p className="text-2xl font-semibold text-green-700">{scans.length}</p>
              <p className="text-xs text-slate-600">Total Scans</p>
            </article>
            <article className="surface-soft p-4 text-center">
              <p className="text-2xl font-semibold text-yellow-700">
                {scans.filter((s) => s.severity === "high").length}
              </p>
              <p className="text-xs text-slate-600">High Severity</p>
            </article>
            <article className="surface-soft p-4 text-center">
              <p className="text-2xl font-semibold text-sky-700">
                {scans.filter((s) => s.disease.toLowerCase() === "healthy").length}
              </p>
              <p className="text-xs text-slate-600">Healthy Leaves</p>
            </article>
          </div>
        )}
      </section>

      {loadingScans ? (
        <section className="surface p-10 text-center text-sm text-slate-500">
          Loading history...
        </section>
      ) : scans.length === 0 ? (
        <section className="surface p-10 text-center">
          <p className="text-sm text-slate-600">No scan history yet.</p>
          <Link href="/camera" className="btn-primary mt-4">Start First Scan</Link>
        </section>
      ) : (
        <section className="space-y-3">
          {scans.map((scan) => (
            <article key={scan.id} className="surface p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedScans.includes(scan.id)}
                    onChange={() => toggleScanSelection(scan.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-green-700 focus:ring-green-600"
                  />
                  {scan.image ? (
                    <Image
                      src={scan.image}
                      alt={scan.disease}
                      width={110}
                      height={110}
                      className="h-24 w-24 rounded-xl object-cover sm:h-28 sm:w-28"
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-xl bg-slate-100 flex items-center justify-center sm:h-28 sm:w-28">
                      <span className="text-xs text-slate-400">No image</span>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{scan.disease}</h2>
                      <p className="text-xs text-slate-500 sm:text-sm">
                        {scan.date.toLocaleDateString()} at {scan.date.toLocaleTimeString()}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${getSeverityColor(scan.severity)}`}>
                      {scan.severity}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">Confidence: {scan.confidence}%</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="surface w-full max-w-sm p-5">
            <h3 className="text-lg font-semibold text-slate-900">Confirm Delete</h3>
            <p className="mt-2 text-sm text-slate-600">
              Delete {selectedScans.length} selected scan(s)? This action cannot be undone.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={deleteSelected} className="btn-danger w-full">Delete</button>
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary w-full">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}