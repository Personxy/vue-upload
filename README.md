# Upload File 项目

这是一个文件上传项目，包含前端和后端两个部分。

## 项目结构

- `front-end/` - 前端项目目录
- `back-end/` - 后端项目目录

### 前端项目

前端项目使用 Vue.js 构建，位于 `front-end/` 目录下。

#### 安装依赖

在 `front-end/` 目录下运行以下命令来安装项目依赖：

```sh
cd front-end
npm install

```

#### 运行项目

在 [front-end](./front-end/) 目录下运行以下命令来启动开发服务器：

```
npm run serve
```

#### 构建项目

在 [front-end](./front-end/) 目录下运行以下命令来构建项目：

```
npm run build
```

### 后端项目

后端项目使用 Node.js 和 Express 构建，位于 [back-end](./back-end/) 目录下。

#### 安装依赖

在 [back-end](./back-end/) 目录下运行以下命令来安装项目依赖：

```
cd back-end
npm install
```

#### 运行项目

在 [back-end](./back-end/) 目录下运行以下命令来启动服务器：

```
npm start
```

### 后端项目依赖

- `cors` - 用于处理跨域请求
- `express` - Web 框架
- `fs` - 文件系统模块
- `multer` - 中间件，用于处理 `multipart/form-data` 类型的表单数据
- `nodemon` - 用于自动重启 Node.js 应用

## 使用的主要技术栈

### 前端

- Vue.js
- Vue Router
- Vuex
- Element UI
- Axios

### 后端

- Node.js
- Express

## 贡献

欢迎提交问题和贡献代码！

## 许可证

本项目使用 MIT 许可证。 ```
