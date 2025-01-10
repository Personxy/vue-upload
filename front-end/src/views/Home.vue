<!-- ChunkUpload.vue -->
<template>
  <div class="upload-container">
    <el-card class="box-card">
      <div slot="header" class="clearfix">
        <span>上传镜像</span>
      </div>
      <el-input
        v-model="mirroInfo"
        autocomplete="off"
        type="textarea"
        placeholder="请填写文件信息"
        style="margin-top: 6px; margin-bottom: 12px" />
      <el-upload
        class="upload-demo"
        drag
        action="#"
        :auto-upload="false"
        :on-change="handleFileChange"
        :show-file-list="false">
        <div v-if="!currentFile">
          <i class="el-icon-upload"></i>
          <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        </div>
        <div
          v-else
          class="el-upload-dragger"
          style="display: flex; flex-direction: column; align-items: center; justify-content: center">
          <i class="el-icon-document" style="font-size: 36px"></i>
          <!-- <el-button type="primary">重新选择文件</el-button> -->
        </div>
      </el-upload>

      <div v-if="currentFile" class="upload-info">
        <p>文件名：{{ currentFile.name }}</p>
        <p>文件大小：{{ formatFileSize(currentFile.size) }}</p>
        <p v-if="status == 'hashing'">
          文件准备中<span v-if="hashProgress !== 0 || hashProgress !== 100">{{ hashProgress }}%</span>
        </p>
        <el-progress :percentage="uploadProgress" v-if="uploading"> </el-progress>
        <el-button type="primary" @click="startUpload" :disabled="uploading">
          {{ uploading ? "上传中..." : "开始上传" }}
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script>
import SparkMD5 from "spark-md5";
import axios from "axios";
export default {
  name: "ChunkUpload",
  data() {
    return {
      currentFile: null,
      chunkSize: 2 * 1024 * 1024, // 2MB per chunk
      chunks: [],
      uploadProgress: 0,
      uploading: false,
      mirroInfo: "",
      status: "",
      hashProgress: 0,
    };
  },
  methods: {
    handleFileChange(file) {
      this.currentFile = file.raw;
      this.uploadProgress = 0;
    },
    // 计算文件 hash 一个一个计算
    async calculateHash(file) {
      this.status = "hashing";

      // 动态计算分片大小
      const chunkSize = this.calculateChunkSize(file.size); // 获取合适的分片大小
      const chunks = Math.ceil(file.size / chunkSize);
      const spark = new SparkMD5.ArrayBuffer();
      const fileReader = new FileReader();

      let currentChunk = 0;

      return new Promise((resolve) => {
        const loadNext = () => {
          const start = currentChunk * chunkSize;
          const end = start + chunkSize >= file.size ? file.size : start + chunkSize;

          fileReader.readAsArrayBuffer(file.slice(start, end));
        };

        fileReader.onload = (e) => {
          console.log("读取chunk:", currentChunk + 1, "/", chunks);
          spark.append(e.target.result);
          currentChunk++;

          // 计算当前的百分比进度
          const progress = Math.ceil((currentChunk / chunks) * 100);
          this.hashProgress = progress; // 更新进度状态

          if (currentChunk < chunks) {
            loadNext();
          } else {
            const hash = spark.end();
            console.log("文件hash计算完成:", hash);
            this.status = "";
            resolve(hash);
          }
        };

        fileReader.onerror = () => {
          console.error("文件读取错误");
        };

        loadNext();
      });
    },

    // webworker 计算文件 hash
    // async calculateHash(file) {
    //   this.status = "hashing";

    //   // 动态计算分片大小
    //   const chunkSize = this.calculateChunkSize(file.size); // 获取合适的分片大小

    //   return new Promise((resolve, reject) => {
    //     // 创建 Web Worker
    //     const worker = new Worker("/worker.js");

    //     // 监听 Web Worker 消息
    //     worker.onmessage = (e) => {
    //       const { type, progress, hash, error } = e.data;

    //       if (type === "progress") {
    //         this.hashProgress = progress; // 更新进度条
    //       } else if (type === "completed") {
    //         this.status = "";
    //         resolve(hash); // 返回计算出的hash
    //         worker.terminate(); // 结束 Worker
    //       } else if (type === "error") {
    //         this.status = "";
    //         reject(new Error(error)); // 出现错误
    //         worker.terminate(); // 结束 Worker
    //       }
    //     };

    //     // 向 Worker 发送数据
    //     worker.postMessage({ file, chunkSize });
    //   });
    // },

    // 动态计算分片大小的函数
    calculateChunkSize(fileSize) {
      if (fileSize <= 20 * 1024 * 1024) {
        // 小于等于20MB的文件分片大小为2MB
        return 2 * 1024 * 1024;
      } else if (fileSize <= 1 * 1024 * 1024 * 1024) {
        // 大于20MB小于等于1GB的文件分片大小为5MB
        return 10 * 1024 * 1024;
      } else {
        // 大于1GB的文件分片大小为20MB
        return 100 * 1024 * 1024;
      }
    },
    // 创建分片
    createFileChunks() {
      const chunkSize = this.calculateChunkSize(this.currentFile.size); // 动态计算分片大小
      const chunks = [];
      let cur = 0;
      while (cur < this.currentFile.size) {
        chunks.push({
          index: chunks.length,
          file: this.currentFile.slice(cur, cur + chunkSize),
        });
        cur += chunkSize;
      }
      return chunks;
    },
    // 分片上传
    async startUpload() {
      if (!this.currentFile) return;

      try {
        this.uploading = true;
        this.uploadProgress = 0;
        this.chunks = this.createFileChunks();
        console.log(this.chunks);
        // 打印计算文件哈希的开始时间
        console.time("Hash Calculation Time"); // 记录开始时间
        const fileHash = await this.calculateHash(this.currentFile);
        // 打印计算文件哈希的结束时间
        console.timeEnd("Hash Calculation Time"); // 输出耗时
        console.log(fileHash);

        // 检查文件是否已上传
        const checkResponse = await fetch("http://localhost:30001/api/upload/check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileHash,
            fileName: this.currentFile.name,
            fileSize: this.currentFile.size,
          }),
        });

        const { uploaded, uploadedChunks = [] } = await checkResponse.json();

        if (uploaded) {
          this.uploadProgress = 100;
          this.$message.success("文件已存在，秒传成功！");
          this.uploading = false;
          return;
        }

        // 上传所有分片，确保每个分片上传成功后再上传下一个
        for (let i = 0; i < this.chunks.length; i++) {
          const chunk = this.chunks[i];
          if (uploadedChunks.includes(chunk.index)) continue; // 如果分片已上传，跳过

          const formData = new FormData();
          formData.append("chunk", chunk.file);
          formData.append("hash", fileHash);
          formData.append("chunkIndex", chunk.index);
          formData.append("fileName", this.currentFile.name);

          console.log("上传参数:", {
            hash: fileHash,
            chunkIndex: chunk.index,
            fileName: this.currentFile.name,
          });

          try {
            const uploadResponse = await fetch("http://localhost:30001/api/upload/chunk", {
              method: "POST",
              body: formData,
            });

            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload chunk ${chunk.index}`);
            }

            // 上传成功后更新进度条
            this.uploadProgress = Math.ceil(((i + 1) / this.chunks.length) * 100);
            console.log(`Chunk ${chunk.index} uploaded successfully`);
          } catch (error) {
            console.error("Upload error:", error);
            this.$message.error(`分片 ${chunk.index} 上传失败，请重试`);
            break; // 如果上传失败，停止上传并退出
          }
        }

        // 通知服务器合并分片
        const mergeResponse = await fetch("http://localhost:30001/api/upload/merge", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileHash,
            fileName: this.currentFile.name,
            size: this.currentFile.size,
          }),
        });

        if (!mergeResponse.ok) {
          throw new Error("合并分片失败");
        }

        this.$message.success("上传成功！");
      } catch (error) {
        console.error("Upload error:", error);
        this.$message.error("上传失败，请重试");
      } finally {
        this.uploading = false;
      }
    },

    //直接上传
    // async startUpload() {
    //   if (!this.currentFile) return;

    //   try {
    //     this.uploading = true; // 开始上传时，显示进度条
    //     this.uploadProgress = 0; // 初始化进度

    //     // 创建 FormData 实例，直接上传整个文件
    //     const formData = new FormData();
    //     formData.append("file", this.currentFile);

    //     // 使用 axios 进行上传并监听进度
    //     const config = {
    //       headers: {
    //         "Content-Type": "multipart/form-data", // 设置正确的请求头
    //       },
    //       onUploadProgress: (event) => {
    //         if (event.lengthComputable) {
    //           const progress = Math.ceil((event.loaded / event.total) * 100);
    //           this.uploadProgress = progress; // 更新进度条
    //         }
    //       },
    //     };

    //     // 发送上传请求
    //     const response = await axios.post(
    //       "http://localhost:30001/api/upload-direct",
    //       formData,
    //       config
    //     );

    //     if (response.status === 200) {
    //       this.uploadProgress = 100; // 上传完成
    //       this.$message.success("文件上传成功！");
    //     } else {
    //       throw new Error("文件上传失败");
    //     }
    //   } catch (error) {
    //     console.error("Upload error:", error);
    //     this.$message.error("上传失败，请重试");
    //   } finally {
    //     this.uploading = false; // 无论成功或失败，都要将上传状态设置为 false
    //   }
    // },
    formatFileSize(bytes) {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return (bytes / Math.pow(k, i)).toPrecision(3) + " " + sizes[i];
    },
  },
};
</script>

<style scoped>
.upload-container {
  width: 600px;
  margin: 20px auto;
}
.upload-info {
  margin-top: 20px;
}
</style>
