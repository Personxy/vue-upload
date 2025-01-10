self.importScripts(
  "https://cdnjs.cloudflare.com/ajax/libs/spark-md5/3.0.0/spark-md5.min.js"
); // 引入 SparkMD5 库

self.onmessage = function (e) {
  const { file, chunkSize } = e.data;
  const chunks = Math.ceil(file.size / chunkSize);
  const spark = new SparkMD5.ArrayBuffer();
  const fileReader = new FileReader();

  let currentChunk = 0;

  const loadChunk = (start, end) => {
    return new Promise((resolve, reject) => {
      fileReader.onload = (e) => {
        spark.append(e.target.result);
        resolve();
      };

      fileReader.onerror = reject;
      fileReader.readAsArrayBuffer(file.slice(start, end));
    });
  };

  const readNextChunk = async () => {
    if (currentChunk < chunks) {
      const start = currentChunk * chunkSize;
      const end = Math.min(start + chunkSize, file.size);

      await loadChunk(start, end);
      currentChunk++;
      postMessage({
        type: "progress",
        progress: Math.ceil((currentChunk / chunks) * 100),
      });

      return readNextChunk(); // 继续读取下一个分片
    }
  };

  readNextChunk()
    .then(() => {
      const hash = spark.end();
      postMessage({ type: "completed", hash });
    })
    .catch((err) => {
      postMessage({ type: "error", error: err.message });
    });
};
