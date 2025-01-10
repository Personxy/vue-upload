const fs = require("fs");
const path = require("path");

// 目标文件路径
const filePath = path.join(__dirname, "2GB_file.txt");

// 目标文件的大小，单位是字节
const fileSize = 2 * 1024 * 1024 * 1024; // 2GB

// 创建一个可写流
const writeStream = fs.createWriteStream(filePath);

// 数据块，每次写入 1MB 大小的块
const chunkSize = 1 * 1024 * 1024; // 1MB

// 填充数据的内容，使用一个非常简单的字符串
const chunkData = "A".repeat(chunkSize); // 1MB 数据

let writtenBytes = 0;

// 写入文件直到达到 2GB
function writeFile() {
  while (writtenBytes < fileSize) {
    writeStream.write(chunkData);
    writtenBytes += chunkSize;

    // 打印进度
    if (writtenBytes % (1024 * 1024 * 10) === 0) {
      console.log(`已写入 ${writtenBytes / (1024 * 1024)} MB`);
    }
  }

  // 文件写入完毕
  writeStream.end(() => {
    console.log("文件已成功创建！");
  });
}

// 开始写入文件
writeFile();
