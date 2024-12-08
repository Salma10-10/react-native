const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const deepl = require("deepl-node");
require("dotenv").config();

const app = express();
const port = 3000;

// Configure PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const translator = new deepl.Translator(process.env.NEXT_PUBLIC_DEEPL_API_KEY);

app.use(
  cors({
    origin: "*", // or the origin of your frontend
    methods: ["POST", "GET"],
    allowedHeaders: "Content-Type",
  })
);
app.use(express.json());

// GET handler for fetching translations
app.get("/api/get-translations", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, original_text, translated_text, language, model FROM translations_native"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching translations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST handler for saving translations
app.post("/api/save-translation", async (req, res) => {
  const { originalText, translatedText, language, model } = req.body;

  if (!originalText || !translatedText || !language || !model) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const queries = Object.keys(translatedText).map((model) => {
      const query = `
        INSERT INTO translations_native (original_text, translated_text, language, model)
        VALUES ($1, $2, $3, $4)
      `;
      const values = [originalText, translatedText[model], language, model];
      return pool.query(query, values);
    });

    await Promise.all(queries);

    res.status(200).json({ message: "Translations saved successfully!" });
  } catch (error) {
    console.error("Error saving translation:", error);
    res.status(500).json({ error: "Failed to save translation" });
  }
});

// POST handler for DeepL translation
app.post("/api/translate-deepl", async (req, res) => {
  const { text, targetLang } = req.body;

  if (!text || !targetLang) {
    return res.status(400).json({ error: "Text and targetLang are required" });
  }
  try {
    const result = await translator.translateText(text, null, targetLang);
    const translatedText = Array.isArray(result)
      ? result.map((r) => r.text).join(" ")
      : result.text;

    console.log("Translation result:", translatedText);

    res.status(200).json({ translation: translatedText });
  } catch (error) {
    console.error("DeepL translation error:", error);
    res.status(500).json({ error: "Translation failed" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
