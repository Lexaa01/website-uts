import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

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
const SECRET_KEY = "lexaa1234";

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

mongoose.connect(
  "mongodb://Lexaa01:Rahmat0507@ac-edbl3az-shard-00-00.vjxomi1.mongodb.net:27017,ac-edbl3az-shard-00-01.vjxomi1.mongodb.net:27017,ac-edbl3az-shard-00-02.vjxomi1.mongodb.net:27017/?ssl=true&replicaSet=atlas-jod0w6-shard-0&authSource=admin&retryWrites=true&w=majority",
  {
    dbName: "db_wisata",
  }
);

// Schema User
const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const User = mongoose.model("User", UserSchema);

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token tidak ditemukan." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token tidak valid." });
  }
}

app.get("/api/profile", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Endpoint Login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user)
    return res
      .status(401)
      .json({ success: false, message: "Username atau password salah." });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch)
    return res
      .status(401)
      .json({ success: false, message: "Username atau password salah." });

  // Generate JWT token
  const token = jwt.sign(
    { userId: user._id, username: user.username },
    SECRET_KEY,
    {
      expiresIn: "2h",
    }
  );

  return res.json({ success: true, message: "Login berhasil.", token });
});

// Endpoint register
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res
      .status(400)
      .json({ success: false, message: "Username dan password wajib diisi." });

  const existingUser = await User.findOne({ username });
  if (existingUser)
    return res
      .status(409)
      .json({ success: false, message: "Username sudah terdaftar." });

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({ username, password: hashedPassword });
  await newUser.save();

  return res.json({ success: true, message: "Registrasi berhasil." });
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
