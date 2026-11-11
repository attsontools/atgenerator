# AT Generator

密码、UUID、ULID、NanoID、二维码、Lorem、假数据、骰子和抽奖工具。项目同时发布独立桌面应用和可安装到 AT Tool 的插件包。

## 开发

```bash
corepack pnpm install
corepack pnpm dev
corepack pnpm test
corepack pnpm build
corepack pnpm build:plugin
corepack pnpm tauri:dev
```

插件身份为 `com.attson.generator`，申请 `host.theme.read` 和 `host.file.save` 权限；文件权限只用于通过系统对话框保存二维码 PNG。

## 发布

向 GitHub `prod` Environment 配置以下 Secrets：

- `ATGENERATOR_PUBLISHER_KEY_ID`
- `ATGENERATOR_PUBLISHER_PRIVATE_KEY`
- `ATGENERATOR_PUBLISHER_PUBLIC_KEY`

推送 `v` 前缀的 SemVer tag 后，Release workflow 会构建五个平台安装包和五个签名 `.atpkg`。
