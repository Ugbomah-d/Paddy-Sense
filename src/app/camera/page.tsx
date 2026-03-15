"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Image from "next/image";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

interface ScanResult {
  id: string;
  disease: string;
  confidence: number;
  image: string;
  date: Date;
  severity: "low" | "medium" | "high";
}

interface PredictResponse {
  predicted_class: string;
  confidence: number;
}

function getSeverity(confidence: number, disease: string): "low" | "medium" | "high" {
  if (disease.toLowerCase() === "healthy") return "low";
  const c = confidence > 1 ? confidence / 100 : confidence;
  if (c >= 0.9) return "high";
  if (c >= 0.75) return "medium";
  return "low";
}

export default function CameraPage() {
  const { user, token, isAuthReady } = useAuth();
  const router = useRouter();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBackCamera, setIsBackCamera] = useState(true);
  const [sourceWasUpload, setSourceWasUpload] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthReady && !user) router.push("/login");
  }, [isAuthReady, user, router]);

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: isBackCamera ? "environment" : "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      setStream(mediaStream);
      setIsCameraActive(true);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch {
      alert("Unable to access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
      setIsCameraActive(false);
    }
  };

  const flipCamera = () => {
    stopCamera();
    setIsBackCamera((prev) => !prev);
    setTimeout(() => startCamera(), 100);
  };

  const captureImage = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg");
    setSourceWasUpload(false);
    setCapturedImage(imageData);
    stopCamera();
    analyzeImage(imageData);
  };

  const handleUploadClick = () => uploadInputRef.current?.click();

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const imageData = reader.result as string;
      stopCamera();
      setSourceWasUpload(true);
      setCapturedImage(imageData);
      analyzeImage(imageData);
      e.target.value = "";
    };
    reader.onerror = () => {
      alert("Unable to read the selected image.");
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (imageData: string) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const blob = await fetch(imageData).then((r) => r.blob());
      const formData = new FormData();
      formData.append("image", blob, "leaf.jpg");

      const response = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(errBody.message ?? `Server error: ${response.status}`);
      }

      const data: PredictResponse = await response.json();
      const confidenceDecimal = data.confidence > 1 ? data.confidence / 100 : data.confidence;

      const scanResult: ScanResult = {
        id: Date.now().toString(),
        disease: data.predicted_class,
        confidence: Math.round(confidenceDecimal * 100),
        image: imageData,
        date: new Date(),
        severity: getSeverity(confidenceDecimal, data.predicted_class),
      };

      setResult(scanResult);

      const history: ScanResult[] = JSON.parse(localStorage.getItem("scanHistory") ?? "[]");
      history.unshift(scanResult);
      localStorage.setItem("scanHistory", JSON.stringify(history));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Goes back to upload if image came from upload, camera otherwise
  const resetScan = () => {
    setCapturedImage(null);
    setResult(null);
    setError(null);
    if (sourceWasUpload) {
      uploadInputRef.current?.click();
    } else {
      startCamera();
    }
  };

  if (!isAuthReady) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="surface p-6 text-sm text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="surface p-5 sm:p-6">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Disease Detector</h1>
        <p className="mt-2 text-sm text-slate-600">
          Point your camera at a rice leaf and capture a clear frame for analysis.
        </p>
      </header>

      <section className="surface overflow-hidden">
        <div className={`relative aspect-[4/5] w-full bg-slate-900 sm:aspect-video ${result ? "hidden" : ""}`}>
          {/* Idle */}
          {!isCameraActive && !capturedImage && !isAnalyzing && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="flex w-full max-w-xs flex-col gap-3">
                <button onClick={startCamera} className="btn-primary w-full">Start Camera</button>
                <button onClick={handleUploadClick} className="btn-secondary w-full">Upload Image</button>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadChange}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Live camera */}
          {isCameraActive && (
            <>
              <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
              <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                Align leaf in frame
              </div>
              <div className="absolute bottom-4 left-0 right-0 px-4">
                <div className="mx-auto grid max-w-sm grid-cols-3 gap-3">
                  <button
                    onClick={flipCamera}
                    className="inline-flex items-center justify-center rounded-full bg-black/55 p-3 text-white transition hover:bg-black/70"
                    aria-label="Flip camera"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                  <button
                    onClick={captureImage}
                    className="inline-flex items-center justify-center rounded-full bg-white p-4 text-green-700 shadow-lg transition hover:bg-slate-100"
                    aria-label="Capture image"
                  >
                    <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  </button>
                  <button
                    onClick={stopCamera}
                    className="inline-flex items-center justify-center rounded-full bg-red-600 p-3 text-white transition hover:bg-red-700"
                    aria-label="Stop camera"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Analysing overlay */}
          {capturedImage && isAnalyzing && (
            <>
              <Image src={capturedImage} alt="Captured leaf" fill className="object-cover opacity-40" />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <div className="mb-4 h-14 w-14 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
                <p className="text-sm font-medium text-white sm:text-base">Analysing image…</p>
              </div>
            </>
          )}

          {/* Captured preview
          {capturedImage && !isAnalyzing && !result && !error && (
            <Image src={capturedImage} alt="Captured leaf" fill className="object-cover" />
          )} */}

          {/* Error */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900/85 p-6 text-center">
              <svg className="h-10 w-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-sm text-white">{error}</p>
              <button onClick={resetScan} className="btn-primary">Try Again</button>
            </div>
          )}
        </div>

        {/* Result card */}
        {result && (
          <div className="space-y-4 p-4 sm:p-6">
            <Image
              src={result.image}
              alt="Analysed leaf"
              width={640}
              height={360}
              className="h-52 w-full rounded-xl object-cover sm:h-64"
            />
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">{result.disease}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                result.severity === "high" ? "bg-red-100 text-red-700"
                : result.severity === "medium" ? "bg-yellow-100 text-yellow-700"
                : "bg-green-100 text-green-700"
              }`}>
                {result.severity} severity
              </span>
            </div>
            <p className="text-sm text-slate-600">Confidence: {result.confidence}%</p>
            <button onClick={resetScan} className="btn-primary w-full sm:w-auto">
              {sourceWasUpload ? "Upload Another Image" : "Scan Another Leaf"}
            </button>
          </div>
        )}

        {isCameraActive && (
          <div className="border-t border-slate-200 bg-green-50/80 px-4 py-3 text-xs text-green-800 sm:text-sm">
            Tip: Keep lighting bright and hold the phone steady for better results.
          </div>
        )}
      </section>

      {/* Hidden upload input always mounted so resetScan can trigger it */}
      {!isCameraActive && (capturedImage || result) && (
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          onChange={handleUploadChange}
          className="hidden"
        />
      )}
    </div>
  );
}