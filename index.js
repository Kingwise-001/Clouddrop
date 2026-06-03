const express = require("express");
const cors = require("cors");
const multer = require("multer");
const AWS = require("aws-sdk");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "http://localhost:3000",
  })
);
app.use(express.json());

// Multer setup (memory storage for S3 upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// AWS S3 setup
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

// PostgreSQL (RDS) setup
// PostgreSQL (RDS) setup
const { pool, initDatabase } = require("./db");

// Health check
app.get("/", (req, res) => {
  res.send("CloudDrop Backend is running 🚀");
});

// ===============================
// 📤 UPLOAD SINGLE FILE
// ===============================
app.post("/api/uploads/single", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: Date.now() + "_" + file.originalname,
      Body: file.buffer,
    };

    const s3Result = await s3.upload(params).promise();

    const dbResult = await pool.query(
      "INSERT INTO files(name, url) VALUES($1, $2) RETURNING *",
      [file.originalname, s3Result.Location]
    );

    res.json({
      message: "File uploaded successfully",
      file: dbResult.rows[0],
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Upload failed" });
  }
});

// ===============================
// 📤 UPLOAD BULK FILES
// ===============================
app.post("/api/uploads/bulk", upload.array("files"), async (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const uploadedFiles = [];

    for (const file of files) {
      const params = {
        Bucket: process.env.S3_BUCKET,
        Key: Date.now() + "_" + file.originalname,
        Body: file.buffer,
      };

      const result = await s3.upload(params).promise();

      const dbResult = await pool.query(
        "INSERT INTO files(name, url) VALUES($1, $2) RETURNING *",
        [file.originalname, result.Location]
      );

      uploadedFiles.push(dbResult.rows[0]);
    }

    res.json({
      message: "Bulk upload successful",
      files: uploadedFiles,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Bulk upload failed" });
  }
});

// ===============================
// 📁 GET ALL FILES
// ===============================
app.get("/api/files", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM files ORDER BY uploaded_at DESC"
    );

    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to fetch files" });
  }
});

// ===============================
// 📄 GET SINGLE FILE
// ===============================
app.get("/api/files/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query("SELECT * FROM files WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error fetching file" });
  }
});

// ===============================
// 📥 DOWNLOAD FILE
// ===============================
app.get("/api/files/:id/download", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query("SELECT url FROM files WHERE id = $1", [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    res.json({ downloadUrl: result.rows[0].url });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Download failed" });
  }
});

// ===============================
// 🗑️ DELETE FILE
// ===============================
app.delete("/api/files/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query("DELETE FROM files WHERE id = $1", [id]);

    res.json({ message: "File deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Delete failed" });
  }
});

// ===============================
// 📊 STATS
// ===============================
app.get("/api/files/stats/summary", async (req, res) => {
  try {
    const total = await pool.query("SELECT COUNT(*) FROM files");

    res.json({
      totalFiles: total.rows[0].count,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Stats error" });
  }
});

// Start server
// Start server + initialize DB
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  });
