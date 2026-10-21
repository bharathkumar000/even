"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";

interface CheckinQrClientViewProps {
  teamCode: string;
  qrUrl: string;
  updatedAt: string;
}

export default function CheckinQrClientView({
  teamCode,
  qrUrl,
  updatedAt,
}: CheckinQrClientViewProps) {
  const [qrImageDataUrl, setQrImageDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(
      qrUrl,
      { width: 320, margin: 2 },
      (err: Error | null | undefined, dataUrl: string) => {
        if (err) {
          setError("Failed to generate QR image");
        } else {
          setQrImageDataUrl(dataUrl);
        }
      }
    );
  }, [qrUrl]);

  const downloadQr = () => {
    if (!qrImageDataUrl) return;
    const a = document.createElement("a");
    a.href = qrImageDataUrl;
    a.download = `team-${teamCode}-checkin.png`;
    a.click();
  };

  if (error) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4 text-status-error">
          QR Error
        </h2>
        <p className="text-text-secondary">{error}</p>
      </div>
    );
  }

  if (!qrImageDataUrl) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <h2 className="text-2xl font-bold mb-4">Verifying QR…</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-8 border border-accent-primary/30 space-y-6 text-center">
        <div className="flex items-center justify-center my-3">
          <div className="p-4 bg-white rounded-lg shadow-2xl inline-block border-4 border-accent-primary">
            <img draggable="false"
              src={qrImageDataUrl}
              alt="Check‑In QR Code"
              width={224}
              height={224}
              className="w-56 h-56 object-contain"
            />
          </div>
        </div>
        <div className="text-xs text-text-secondary space-y-1">
          <p className="font-mono text-[11px] text-text-primary">
            Team Code: {teamCode}
          </p>
          <p className="font-mono text-[11px] text-text-primary">
            Verified: {new Date(updatedAt).toLocaleString()}
          </p>
        </div>
        <button
          onClick={downloadQr}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 text-black font-bold uppercase text-xs rounded"
        >
          <Download size={14} />
          Download QR
        </button>
      </div>
    </div>
  );
}
