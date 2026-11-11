# AT Generator Review Profile

## 项目边界

- 项目名称：`atgenerator`，对外名称固定为“生成器”。
- 同一套 Vue UI 同时构建独立 Tauri 应用和 AT Tool 插件，不维护两套业务实现。
- `src/generators.ts` 和 `src/qr.ts` 保持宿主无关；平台与桌面能力只通过 `src/host/` 适配。
- 本仓库只持有 Generator Publisher 发布职责。Root、Catalog 的生成和签名属于 `attsontools/attool`。

## 固定身份与权限

- 插件身份固定为 `appId=com.attson.generator`、`publisher.id=com.attson`、名称“生成器”。
- Tauri identifier 固定为 `com.attson.generator`。
- 插件只声明 `host.theme.read` 与 `host.file.save`；文件保存必须使用 base64 和系统保存对话框，不允许应用指定任意落盘路径。
- 身份、Publisher key ID、Host API 范围或权限变化属于信任边界变更，必须同时检查 Catalog 兼容性。

## 架构规则

- `src/App.vue` 不直接导入 Tauri API 或 Plugin SDK；宿主调用通过 `GeneratorHost`。
- plugin 模式连接失败必须显示阻塞错误，不得静默退化为 standalone。
- standalone 模式可以自行维护主题；plugin 模式主题由宿主握手和事件驱动。
- 密码、ID、Lorem、假数据、骰子和抽奖逻辑必须位于可独立测试的纯函数模块。
- QR 编码使用 `qrcode-generator`，Canvas 只负责渲染；`quietZone=0` 无留白，正数兼容为 4 模块留白。
- 不为二维码新增 AT Tool Host API 或权限；独立应用只保留保存 PNG 所需的最小 Rust command。

## 打包与签名

- 插件资产名固定为 `AT.Generator_<version>_<os>_<arch>.atpkg`。
- Release 必须精确包含五个平台安装包和五个相应 `.atpkg`，不得缺少、重复或夹带其他资产。
- GitHub Actions `prod` Environment 提供 `ATGENERATOR_PUBLISHER_KEY_ID`、`ATGENERATOR_PUBLISHER_PRIVATE_KEY`、`ATGENERATOR_PUBLISHER_PUBLIC_KEY`。
- Publisher 私钥必须为 Ed25519 且与配置的原始公钥匹配；任何缺失、格式错误或不匹配都必须 fail closed。
- manifest 签名前必须列出包内全部业务文件及 SHA-256；发布前必须重新解包验证签名、身份、目标、文件集合和哈希。
- Publisher 私钥不得进入源码、日志、构建产物、测试夹具或 Catalog 仓库。

## 测试与审查

- 生成核心、QR、宿主适配和打包脚本变更先写或更新测试，再实现。
- 运行 `pnpm test`、`pnpm build`、`pnpm build:plugin` 和 `cargo test --manifest-path src-tauri/Cargo.toml`。
- UI 变更至少检查桌面与窄屏，确认六个页签、滚动、主题、复制和二维码保存反馈正常。
- 重点搜索遗留的 `text`、`AT.Text`、`com.attson.text`、`ATTEXT_`，这些通常表示复制模板未完成。
- 不引入新依赖，除非现有平台能力确实无法满足需求；QR 编码库是本项目明确批准的唯一业务依赖。

## 关键文件

- `src/generators.ts`：宿主无关的随机生成核心。
- `src/qr.ts`：QR 矩阵、兼容几何与 PNG 渲染。
- `src/App.vue`：六类生成器交互。
- `src/host/standalone.ts`：独立应用适配。
- `src/host/plugin.ts`：AT Tool 插件适配。
- `scripts/package-plugin.mjs`：插件清单、签名、归档和回读验证。
- `scripts/verify-release.mjs`：版本一致性与 Release 资产集合验证。
- `.github/workflows/release.yml`：五平台独立应用和插件发布。
