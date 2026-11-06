import nodemailer from "nodemailer";

// Pengiriman email lewat akun Gmail toko (login memakai App Password, bukan password Gmail).
// Server SMTP bisa diganti lewat .env (SMTP_HOST, SMTP_PORT, SMTP_SECURE); bawaan = Gmail.
export type MailAccount = { user: string; pass: string; senderName: string };

export type MailContent = {
  to:      string;
  bcc?:    string;
  subject: string;
  html:    string;
  text:    string;
};

export const sendMail = async (account: MailAccount, mail: MailContent): Promise<void> => {
  const transport = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || "smtp.gmail.com",
    port:   Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : true,
    auth:   { user: account.user, pass: account.pass },
    // Jangan menggantung lama jika internet putus
    connectionTimeout: 15_000,
    greetingTimeout:   10_000,
    socketTimeout:     20_000,
  });
  try {
    await transport.sendMail({
      from:    { name: account.senderName, address: account.user },
      to:      mail.to,
      bcc:     mail.bcc,
      subject: mail.subject,
      html:    mail.html,
      text:    mail.text,
    });
  } finally {
    transport.close();
  }
};

// Error SMTP → pesan bahasa Indonesia untuk ditampilkan ke pengguna
export const mailErrorMessage = (err: unknown): string => {
  const e = err as { code?: string; message?: string };
  if (e?.code === "EAUTH") {
    return "Gmail menolak login. Pastikan Verifikasi 2 Langkah aktif dan App Password benar.";
  }
  if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ECONNREFUSED"].includes(e?.code ?? "")) {
    return "Tidak bisa terhubung ke server Gmail. Periksa koneksi internet.";
  }
  if (e?.code === "EENVELOPE") return "Alamat email penerima ditolak. Periksa kembali alamatnya.";
  return `Email gagal dikirim${e?.message ? `: ${e.message.slice(0, 150)}` : ""}`;
};
