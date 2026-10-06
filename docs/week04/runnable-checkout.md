# 第四讲全新检出运行验收

2026-10-07。用户要求把预置数据库和PDF放入远端分支。此前这些文件被忽略，本次改为明确白名单：native-library.sqlite、native-seed.json及四份以file_asset_id命名的PDF；完整桌面库、临时导出、凭据和额外原件继续排除。

同时把构建所需的Patchouli核心源码、41条迁移、许可和散列清单入库。prepare-runtime.mjs先核验预置资源及原核心源码，再按锁文件编译Blazor核心、按固定URL和SHA-256准备RapidOCR。build/start自动运行该步骤；test/check自动生成迁移。普通使用无需桌面文献库、WPS目录或另一个Patchouli源码目录。

验证在Windows临时目录中，仅从Git索引导出新检出，不复制旧node_modules、编译核心、OCR权重、构建产物或教师的桌面库：

- 冻结锁文件安装成功；16项单元检查、TypeScript检查与Stencil生产构建通过。
- 原核心从随库提供的源码编译；三份OCR模型实际下载，SHA-256与清单一致。
- SQLite和四份PDF逐项长度、SHA-256一致；4题录、4文档、353页，完整性与外键通过。
- 浏览器首次导出与预置库的schema和表行一致；collectivization及金銀实际检索命中。
- 原生Microsoft.Data.Sqlite与Patchouli校验器回读，再由网页回读修改后的库，PDF仍可定位。
- 实际扫描PDF导入：缺题名或作者不写入SQLite；后台识别可隐藏并重新查看进度，RapidOCR边界框树、索引及桌面回读通过。
- D26图节点可继续点击，跨历史/正文/OCR页切换保留校对草稿。

运行命令见apps/week04/README.md。首次安装和构建需联网获取npm/NuGet依赖和固定OCR权重；模型和编译产物不加入Git。CI与手动发布构建阶段均补入第四讲检查，本次不执行发布。
