
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Gunakan metode POST."
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY belum diatur di Vercel."
    });
  }

  try {
    const input = req.body;

    if (!input || !input.source || !input.source.trim()) {
      return res.status(400).json({
        error: "Bahan mentah berita wajib diisi."
      });
    }

    const prompt = `
Anda adalah asisten penulisan berita resmi Bawaslu
Kabupaten Gorontalo.

Olah bahan mentah berikut menjadi rancangan berita.
Jangan mengarang fakta, nama, jabatan, tanggal, angka,
peristiwa, atau kutipan. Kutipan langsung hanya boleh
diambil persis dari bahan sumber.

Jenis berita: ${input.type || ""}
Subjek: ${input.subject || ""}
Pola judul: ${input.titleStyle || ""}
Pola lead: ${input.leadStyle || ""}
Panjang berita: ${input.length || "standar"}

BAHAN SUMBER:
${input.source}

Kembalikan HANYA JSON valid dengan struktur:
{
  "summary": "Ringkasan bahan",
  "facts": ["Fakta yang disebutkan sumber"],
  "quotes": ["Kutipan persis dari sumber"],
  "missing": ["Informasi yang perlu diverifikasi"],
  "angles": [
    {
      "id": 1,
      "title": "Judul angle",
      "focus": "Fokus berita",
      "reason": "Alasan memilih angle",
      "evidence": "Fakta pendukung",
      "direction": "Arah penulisan"
    }
  ],
  "titles": [
    {
      "title": "Alternatif judul",
      "reason": "Alasan pemilihan judul",
      "angleId": 1
    }
  ]
}

Buat tepat 5 angle dan 5 judul.
Pastikan setiap judul terkait dengan salah satu angle.
Jika kutipan langsung tidak tersedia, jangan membuatnya.
Gunakan bahasa Indonesia jurnalistik yang jelas dan netral.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: result.error?.message || "Permintaan Gemini gagal."
      });
    }

    const text = result.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("");

    if (!text) {
      return res.status(502).json({
        error: "Gemini tidak menghasilkan rancangan."
      });
    }

    const data = JSON.parse(text);

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Terjadi kesalahan pada server."
    });
  }
}
