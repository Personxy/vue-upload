// index.js
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const app = express();

// 设置上传文件夹
const UPLOAD_DIR = path.resolve(__dirname, "uploads");

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

// 存储配置
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 判断上传方式，如果是分片上传，则按照分片上传的路径处理
    const isChunkUpload = req.body.hash && req.body.chunkIndex;

    if (isChunkUpload) {
      // 分片上传时，将文件存储到一个基于 hash 值的文件夹中
      const hash = req.body.hash || "temp";
      const chunkDir = path.resolve(UPLOAD_DIR, hash);
      if (!fs.existsSync(chunkDir)) {
        fs.mkdirSync(chunkDir, { recursive: true });
      }
      cb(null, chunkDir);
    } else {
      // 直接上传时，将文件存储到 uploads 文件夹中
      cb(null, UPLOAD_DIR);
    }
  },
  filename: function (req, file, cb) {
    // 如果是分片上传，则使用 chunkIndex 来保存分片文件
    const isChunkUpload = req.body.chunkIndex !== undefined;
    if (isChunkUpload) {
      const chunkIndex = req.body.chunkIndex || "0";
      cb(null, chunkIndex.toString());
    } else {
      // 直接上传时，使用原始文件名保存文件
      cb(null, file.originalname);
    }
  },
});

// 创建 multer 实例
const upload = multer({ storage });
const handleUpload = upload.single("chunk");
// 添加 json 中间件，用于解析 JSON 请求体

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 允许跨域请求
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

//直接上传接口
app.post("/api/upload-direct", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  console.log("Direct upload file:", req.file);
  res.json({
    success: true,
    filename: req.file.filename,
    path: req.file.path,
  });
});

// 检查文件是否已上传
app.post("/api/upload/check", async (req, res) => {
  const { fileHash, fileName } = req.body;
  const filePath = path.resolve(UPLOAD_DIR, fileName);

  if (fs.existsSync(filePath)) {
    res.json({
      uploaded: true,
    });
    return;
  }

  const chunkDir = path.resolve(UPLOAD_DIR, fileHash);
  let uploadedChunks = [];

  if (fs.existsSync(chunkDir)) {
    uploadedChunks = fs.readdirSync(chunkDir);
  }

  res.json({
    uploaded: false,
    uploadedChunks: uploadedChunks.map((chunk) => parseInt(chunk)),
  });
});

// 上传分片
app.post("/api/upload/chunk", (req, res) => {
  handleUpload(req, res, function (err) {
    if (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ error: err.message });
    }

    // 确保有文件上传
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // 获取参数
    const { hash, chunkIndex } = req.body;

    // 如果这时能获取到参数，手动移动文件到正确的位置
    if (hash && hash !== "temp") {
      const tempPath = req.file.path;
      const targetDir = path.resolve(UPLOAD_DIR, hash);
      const targetPath = path.resolve(targetDir, chunkIndex.toString());

      // 确保目标目录存在
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // 移动文件到正确的位置
      try {
        fs.renameSync(tempPath, targetPath);
      } catch (error) {
        return res.status(500).json({ error: "Error saving chunk" });
      }
    }

    res.json({
      success: true,
      body: req.body,
      file: {
        path: req.file.path,
        filename: req.file.filename,
      },
    });
  });
});

// 合并分片
app.post("/api/upload/merge", async (req, res) => {
  const { fileHash, fileName, size } = req.body;

  if (!fileHash || !fileName) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const chunkDir = path.resolve(UPLOAD_DIR, fileHash);
  const filePath = path.resolve(UPLOAD_DIR, fileName);

  if (!fs.existsSync(chunkDir)) {
    return res.status(400).json({ error: "Chunks not found" });
  }

  try {
    const chunks = fs.readdirSync(chunkDir);
    // 按索引排序
    chunks.sort((a, b) => a - b);

    // 创建写入流
    const writeStream = fs.createWriteStream(filePath);

    for (const chunk of chunks) {
      const chunkPath = path.resolve(chunkDir, chunk);
      const chunkData = fs.readFileSync(chunkPath);
      writeStream.write(chunkData);
    }

    writeStream.end();

    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    deleteDirRecursively(chunkDir);
    res.json({
      code: 0,
      message: "合并成功",
    });
  } catch (error) {
    console.error("Merge error:", error);
    res.status(500).json({
      code: 1,
      message: "合并失败",
      error: error.message,
    });
  }
});
// 递归删除目录中的所有文件和子目录
function deleteDirRecursively(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // 如果是目录，则递归删除目录中的内容
      deleteDirRecursively(filePath);
      fs.rmdirSync(filePath); // 删除空目录
    } else {
      // 如果是文件，则直接删除文件
      fs.unlinkSync(filePath);
    }
  });
}
const PORT = process.env.PORT || 30001;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
