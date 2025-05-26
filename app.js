import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

const PORT = 3000;
const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";

import Pino from "pino";

let sock = null;

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState("session");

  sock = makeWASocket({
    auth: state,
    logger: Pino({ level: "silent" }),
    browser: ["LexaaDev", "Safari", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("✅ QR code received, generating...");
      const qrcode = await import("qrcode-terminal");
      qrcode.default.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log("❌ Connection closed. Reconnecting?", shouldReconnect);
      if (shouldReconnect) {
        startSock();
      }
    } else if (connection === "open") {
      console.log("✅ WhatsApp connected!");
    }
  });
}

startSock();

// Endpoint untuk menerima form dan kirim pesan ke WA tujuan
app.post("/api/send-message", async (req, res) => {
  const { name, email, phone, message } = req.body;

  // Nomor tujuan WA, format internasional tanpa +
  const targetNumber = "62882020568373";

  const text = `📩 Pesan Baru dari Formulir Kontak:

👤 Nama: ${name}
📧 Email: ${email}
📞 No. Telp/WA: ${phone}
📝 Pesan: ${message}`;

  try {
    await sock.sendMessage(`${targetNumber}@s.whatsapp.net`, {
      text,
    });
    res.status(200).json({ message: "Pesan berhasil dikirim!" });
  } catch (error) {
    console.error("Gagal kirim pesan:", error);
    res.status(500).send("Gagal mengirim pesan.");
  }
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
