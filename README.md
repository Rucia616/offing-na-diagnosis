# 远汐 Offing 北美业务诊断

这个项目包含一个静态入口页和一个 Vercel Serverless API：

- `index.html`：用户只输入品牌名。
- `api/diagnosis.js`：调用 OpenAI Responses API 生成独立 HTML 报告。
- `reports/generated/`：API 可把报告写回 GitHub Pages 仓库，形成可分享链接。

## 线上环境变量

必须配置：

- `OPENAI_API_KEY`：用于生成真实诊断报告。
- `REPORTS_GITHUB_TOKEN`：GitHub fine-grained token，需要当前仓库 contents read/write 权限，用于发布报告 HTML。

建议配置：

- `REPORTS_REPO=Rucia616/offing-na-diagnosis`
- `REPORTS_BRANCH=main`
- `REPORTS_PUBLIC_BASE_URL=https://rucia616.github.io/offing-na-diagnosis/`
- `OPENAI_MODEL=gpt-5.5`
- `OPENAI_MAX_OUTPUT_TOKENS=18000`

本地联调：

```bash
npm run test:api
```

如果只想验证前端链路，可以临时设置 `ALLOW_MOCK_DIAGNOSIS=1`。
