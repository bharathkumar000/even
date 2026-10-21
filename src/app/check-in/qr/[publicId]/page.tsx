import { supabaseAdmin } from "@/lib/supabase/admin";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

async function generateQrDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    QRCode.toDataURL(
      url,
      { width: 320, margin: 2 },
      (err: Error | null | undefined, dataUrl: string) => {
        if (err) reject(err);
        else resolve(dataUrl);
      }
    );
  });
}

export default async function CheckInQrPublicPage({
  params,
}: {
  params: { publicId: string };
}) {
  const publicId =
    typeof params.publicId === "string" ? params.publicId : "";

  if (!publicId) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Invalid QR link</h2>
        <p className="text-text-secondary">No public identifier provided.</p>
      </div>
    );
  }

  // Look up the QR record using ONLY the public ID (server-side)
  const { data: qrRecord, error } = await supabaseAdmin
    .from("team_checkin_qrs")
    .select("team_code, qr_url, updated_at")
    .eq("public_id", publicId)
    .maybeSingle();

  if (error) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4 text-status-warning">
          Unable to load QR data
        </h2>
        <p className="text-text-secondary">Please try again later.</p>
      </div>
    );
  }

  if (!qrRecord) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4 text-status-warning">
          QR not found
        </h2>
        <p className="text-text-secondary">
          No check-in badge exists for this identifier.
        </p>
      </div>
    );
  }

  // Regenerate the QR image server-side from the clean URL
  let qrImageDataUrl: string | null = null;
  let qrGenError: string | null = null;

  try {
    qrImageDataUrl = await generateQrDataUrl(qrRecord.qr_url);
  } catch {
    qrGenError = "Failed to generate QR image";
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-xl mx-auto p-4">
      <div className="border-b border-border-color pb-6 text-center">
        <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold mb-1">
          Team Check‑In Badge
        </p>
        <h1 className="text-3xl md:text-4xl font-heading text-text-primary tracking-wider uppercase m-0">
          Team {qrRecord.team_code}
        </h1>
        <p className="font-tech text-text-secondary text-xs mt-2">
          Public check-in badge. Scanning opens this page only.
        </p>
      </div>

      {qrGenError ? (
        <div className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4 text-status-error">
            QR Generation Failed
          </h2>
          <p className="text-text-secondary">{qrGenError}</p>
        </div>
      ) : (
        <div className="glass-panel p-8 border border-accent-primary/30 space-y-6 text-center">
          <div className="flex items-center justify-center my-3">
            <div className="p-4 bg-white rounded-lg shadow-2xl inline-block border-4 border-accent-primary">
              {qrImageDataUrl ? (
                <img draggable="false"
                  src={qrImageDataUrl}
                  alt="Team Check‑In QR Code"
                  width={224}
                  height={224}
                  className="w-56 h-56 object-contain"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-black text-xs">
                  Generating QR…
                </div>
              )}
            </div>
          </div>
          <div className="text-xs text-text-secondary space-y-1">
            <p className="font-mono text-[11px] text-text-primary">
              Team Code: {qrRecord.team_code}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
