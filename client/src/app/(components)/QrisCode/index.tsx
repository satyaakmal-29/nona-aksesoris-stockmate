"use client";

import { useEffect, useState } from "react";

// Gambar QR dari teks QRIS (dibuat di browser dengan library qrcode).
const QrisCode = ({ payload, size = 260 }: { payload: string; size?: number }) => {
  const [result, setResult] = useState<{ payload: string; src: string | null; error: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    import("qrcode")
      .then(({ toDataURL }) =>
        toDataURL(payload, { errorCorrectionLevel: "M", margin: 2, width: size * 2 })
      )
      .then((src) => active && setResult({ payload, src, error: false }))
      .catch(() => active && setResult({ payload, src: null, error: true }));
    return () => { active = false; };
  }, [payload, size]);

  const current = result?.payload === payload ? result : null;

  if (current?.error) {
    return (
      <div style={{ width: size, height: size }} className="flex items-center justify-center rounded-lg bg-red-50 p-4 text-center text-xs text-red-600">
        Gagal membuat gambar QR
      </div>
    );
  }
  if (!current?.src) {
    return <div style={{ width: size, height: size }} className="animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={current.src} alt="QRIS" width={size} height={size} className="rounded-lg bg-white p-1" />
  );
};

export default QrisCode;
