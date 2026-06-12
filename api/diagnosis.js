const crypto = require('node:crypto');

const DEFAULT_REPO = 'Rucia616/offing-na-diagnosis';
const DEFAULT_PUBLIC_BASE_URL = 'https://rucia616.github.io/offing-na-diagnosis/';
const DEFAULT_MODEL = 'gpt-5.5';
const MAX_BRAND_LENGTH = 80;

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { errorCode: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported.' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { errorCode: 'BAD_JSON', message: '请求体不是有效 JSON。' });
    return;
  }

  const brand = cleanBrand(body.brand);
  if (!brand) {
    sendJson(res, 400, { errorCode: 'MISSING_BRAND', message: '请输入品牌名。' });
    return;
  }

  if (brand.length > MAX_BRAND_LENGTH) {
    sendJson(res, 400, { errorCode: 'BRAND_TOO_LONG', message: '品牌名过长，请保留品牌主名称。' });
    return;
  }

  try {
    let report;

    if (!process.env.OPENAI_API_KEY) {
      if (process.env.ALLOW_MOCK_DIAGNOSIS !== '1') {
        sendJson(res, 503, {
          errorCode: 'MISSING_OPENAI_API_KEY',
          message: '诊断引擎还缺少 OPENAI_API_KEY。配置后即可生成真实报告。'
        });
        return;
      }

      report = {
        title: `${brand} 北美业务诊断`,
        conclusion: '这是接口联调用演示报告，不包含真实联网诊断结论。',
        html: buildMockReportHtml(brand)
      };
    } else {
      report = await generateReportWithOpenAI({
        brand,
        clientPrompt: typeof body.prompt === 'string' ? body.prompt : ''
      });
    }

    const safeHtml = ensureFullHtml(sanitizeReportHtml(report.html), brand);
    const publishResult = await publishReportIfConfigured({ brand, html: safeHtml });

    if (publishResult.reportUrl) {
      sendJson(res, 200, {
        ok: true,
        mode: 'published',
        brand,
        reportTitle: report.title || `${brand} 北美业务诊断`,
        conclusion: report.conclusion || '',
        reportUrl: publishResult.reportUrl,
        reportPath: publishResult.reportPath,
        githubUrl: publishResult.githubUrl,
        note: '报告已写入公开仓库。GitHub Pages 刚发布时可能需要 1-2 分钟刷新。'
      });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      mode: process.env.OPENAI_API_KEY ? 'temporary' : 'mock',
      brand,
      reportTitle: report.title || `${brand} 北美业务诊断`,
      conclusion: report.conclusion || '',
      reportHtml: safeHtml,
      publishError: publishResult.error || null,
      note: '已生成报告 HTML，但还没有配置公开存储密钥；当前返回临时报告。'
    });
  } catch (error) {
    console.error('[diagnosis:error]', error);
    sendJson(res, 500, {
      errorCode: 'DIAGNOSIS_FAILED',
      message: normalizePublicError(error)
    });
  }
};

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function cleanBrand(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '');
}

async function generateReportWithOpenAI({ brand, clientPrompt }) {
  let includeWebSearch = true;
  let useStructuredOutput = true;
  let data = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    data = await callOpenAI(buildOpenAIRequestBody({
      brand,
      clientPrompt,
      includeWebSearch,
      useStructuredOutput
    }));

    if (data.retryWithoutWebSearch && includeWebSearch) {
      includeWebSearch = false;
      continue;
    }

    if (data.retryWithoutStructuredOutput && useStructuredOutput) {
      useStructuredOutput = false;
      continue;
    }

    break;
  }

  const outputText = collectResponseText(data);
  const parsed = parseReportPayload(outputText);

  if (!parsed.html) {
    throw new Error('OpenAI did not return report HTML.');
  }

  return parsed;
}

function buildOpenAIRequestBody({ brand, clientPrompt, includeWebSearch, useStructuredOutput }) {
  const today = new Date().toISOString().slice(0, 10);
  const systemPrompt = [
    '你是远汐 Offing 的北美业务诊断合伙人，负责生成可直接交付给品牌 CEO / 北美 GM / 电商负责人的专业 HTML 报告。',
    '输出必须遵守 rucia-na-business-diagnosis v1.19.0：商业专业、证据先行、品牌 VI、阶段判断、五颗星总分、三大业务板块、Top 3 关键问题可视化、90/180 天路线图。',
    '不要写成 AI 口水报告。少形容词，多事实、影响、动作。禁止编造确切数字；估算必须标注「估算」和口径边界。',
    '报告是远汐 Offing 免费北美业务诊断，视觉母版使用 Offing 纸色、深墨、海绿、8px 卡片，并叠加被诊断品牌 15-25% 的真实 VI。',
    '必须使用品牌真实 logo：优先官方 logo URL 或官网可复查图片。找不到时写明「官方 logo 待核验」，不要伪造 logo。',
    `今天日期是 ${today}。所有时效数据、价格、units sold、销售规模、管理层或渠道事实都必须按最新公开信息核验。`
  ].join('\n');

  const userPrompt = [
    `请给「${brand}」生成一份北美业务诊断独立 HTML 报告。`,
    '',
    '报告必须包含以下结构：',
    '1. hero：品牌真实 logo 在标题上方；视觉标题为「北美业务诊断」；一句话结论；北美业务情况总分；五颗星；业务健康度、业务机会分、问题致命度三个子分。',
    '2. 品牌阶段判断：0-1 / 1-10 / 10-100 / 100+；说明当前动作是否符合阶段标准；加入销售规模校准，美元和人民币双币种。',
    '3. 一页看懂：健康分、机会分、Top 3 关键问题、业务信号看板。',
    '4. 三大业务板块：品牌、Marketing、电商。每块先打分，再写做得好的 3 条和做得不好的 3 条，必须带证据 ID 或数据缺口。',
    '5. 三大关键问题：每个问题用诊断卡，不要密集长段。卡内有严重度、证据微图表、影响路径、建议动作和证据链接。',
    '6. 竞品横向对比、11 维度评分、增长机会、90/180 天路线图、风险预警和证据表。',
    '',
    'HTML 设计要求：单文件、内联 CSS、无需外部 JS、移动端可读、带 @media print。允许使用外部图片 URL，但不要依赖脚本。固定导航可用锚点。',
    '证据要求：强判断必须出现证据 ID，例如 E1、E2。每条证据要有来源、抓取日期、事实/数字、置信度和链接。',
    '销售规模要求：如果公开披露了 units sold，必须取最新可复查数字作为底线；全球累计终端销售额必须同时换算 USD / RMB 并写明汇率日期和来源。',
    '',
    '返回格式必须是严格 JSON，不要 Markdown，不要代码块：',
    '{"title":"品牌名 北美业务诊断","conclusion":"一句话结论","html":"完整 HTML 字符串"}',
    '',
    clientPrompt ? `前端附加要求：\n${clientPrompt}` : ''
  ].join('\n');

  const requestBody = {
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2,
    max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 18000)
  };

  if (useStructuredOutput) {
    requestBody.text = {
      format: {
        type: 'json_schema',
        name: 'offing_diagnosis_report',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            conclusion: { type: 'string' },
            html: { type: 'string' }
          },
          required: ['title', 'conclusion', 'html'],
          additionalProperties: false
        }
      }
    };
  }

  if (includeWebSearch && process.env.OPENAI_DISABLE_WEB_SEARCH !== '1') {
    requestBody.tools = [{ type: 'web_search' }];
  }

  return requestBody;
}

async function callOpenAI(requestBody) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (error) {
    data = { raw };
  }

  if (!response.ok) {
    const message = data.error && data.error.message ? data.error.message : raw;
    if (requestBody.tools && response.status === 400 && /web[_ ]?search|tool/i.test(message)) {
      return { retryWithoutWebSearch: true };
    }
    if (requestBody.text && response.status === 400 && /json_schema|structured|text\.format|format/i.test(message)) {
      return { retryWithoutStructuredOutput: true };
    }
    throw new Error(`OpenAI API ${response.status}: ${message}`);
  }

  return data;
}

function collectResponseText(data) {
  if (typeof data.output_text === 'string') return data.output_text;

  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') parts.push(content.text);
      if (typeof content.output_text === 'string') parts.push(content.output_text);
    }
  }
  return parts.join('\n').trim();
}

function parseReportPayload(text) {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```(?:json|html)?/i, '')
    .replace(/```$/i, '')
    .trim();

  if (/<!doctype html|<html[\s>]/i.test(cleaned)) {
    return { html: cleaned };
  }

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error('Model output was not JSON or HTML.');
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  return {
    title: parsed.title,
    conclusion: parsed.conclusion,
    html: parsed.html
  };
}

function sanitizeReportHtml(html) {
  return String(html || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

function ensureFullHtml(html, brand) {
  if (/<!doctype html/i.test(html) && /<html[\s>]/i.test(html)) return html;
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<title>${escapeHtml(brand)} 北美业务诊断</title>`,
    '</head>',
    '<body>',
    html,
    '</body>',
    '</html>'
  ].join('');
}

async function publishReportIfConfigured({ brand, html }) {
  const token = process.env.GITHUB_TOKEN || process.env.REPORTS_GITHUB_TOKEN;
  if (!token) {
    return { error: 'Missing GITHUB_TOKEN or REPORTS_GITHUB_TOKEN.' };
  }

  const repo = process.env.REPORTS_REPO || DEFAULT_REPO;
  const branch = process.env.REPORTS_BRANCH || 'main';
  const publicBaseUrl = process.env.REPORTS_PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE_URL;
  const reportPath = `reports/generated/${slugify(brand)}-offing-na-diagnosis-${dateStamp()}-${shortId()}.html`;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${reportPath}`;

  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'offing-na-diagnosis'
    },
    body: JSON.stringify({
      message: `Add ${brand} diagnosis report`,
      branch,
      content: Buffer.from(html, 'utf8').toString('base64')
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      error: data.message ? `GitHub publish failed: ${data.message}` : `GitHub publish failed: ${response.status}`
    };
  }

  return {
    reportPath,
    reportUrl: new URL(reportPath, ensureTrailingSlash(publicBaseUrl)).toString(),
    githubUrl: data.content && data.content.html_url ? data.content.html_url : null
  };
}

function slugify(value) {
  const base = String(value || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return base || `brand-${shortId()}`;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function shortId() {
  return crypto.randomBytes(4).toString('hex');
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

function normalizePublicError(error) {
  const message = error && error.message ? error.message : String(error);
  if (/OpenAI API/i.test(message)) return '诊断生成服务返回错误，请检查 OpenAI 模型、额度或 web search 权限。';
  return '诊断生成失败，请稍后重试或联系远汐团队。';
}

function buildMockReportHtml(brand) {
  const safeBrand = escapeHtml(brand);
  const today = dateStamp();

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeBrand} 北美业务诊断</title>
  <style>
    :root { --paper:#f8faf6; --surface:#fffffb; --ink:#0d1716; --body:#30413f; --muted:#6f7d78; --line:#d8e2dc; --sea:#2d6261; --slate:#13211f; --gold:#a99556; --red:#d70015; }
    * { box-sizing: border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","PingFang SC","Microsoft YaHei",Arial,sans-serif; color:var(--ink); background:var(--paper); }
    main { width:min(1080px, calc(100% - 36px)); margin:0 auto; padding:32px 0 70px; }
    .hero { min-height:82vh; display:grid; align-content:center; border-bottom:1px solid var(--line); }
    .logo { width:92px; min-height:42px; display:grid; place-items:center; border:1px solid var(--line); border-radius:8px; background:var(--surface); color:var(--sea); font-weight:800; }
    h1 { margin:24px 0 12px; font-size:clamp(48px, 8vw, 92px); line-height:1; }
    .lead { max-width:760px; color:var(--body); font-size:20px; line-height:1.6; }
    .score { margin-top:34px; display:grid; grid-template-columns:1.1fr repeat(3, 1fr); gap:12px; }
    .card { padding:18px; border:1px solid var(--line); border-radius:8px; background:var(--surface); }
    .big { background:var(--slate); color:white; }
    .stars { color:var(--gold); font-size:30px; letter-spacing:0; }
    section { padding:34px 0; border-bottom:1px solid var(--line); }
    h2 { margin:0 0 16px; font-size:30px; }
    .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    .bar { height:10px; background:#edf1ec; border-radius:99px; overflow:hidden; margin-top:12px; }
    .bar span { display:block; height:100%; background:var(--sea); width:68%; }
    .risk .bar span { background:var(--red); width:54%; }
    .muted { color:var(--muted); }
    @media (max-width:760px) { .score,.grid { grid-template-columns:1fr; } .hero { min-height:auto; padding:72px 0 34px; } }
    @media print { body { background:white; } main { width:auto; padding:0; } .card { break-inside:avoid; } }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div class="logo">${safeBrand}</div>
      <h1>北美业务诊断</h1>
      <p class="lead">这是后端联调用演示报告，用来验证「提交品牌名 -> 生成 HTML -> 返回报告」链路。真实上线后，这里会替换为联网证据、品牌 VI、销售规模和阶段判断。</p>
      <div class="score">
        <div class="card big"><strong>北美业务情况总分</strong><div class="stars">★★★☆☆</div><div>3.4 / 5</div></div>
        <div class="card"><strong>业务健康度</strong><div class="bar"><span></span></div><p class="muted">68 / 100</p></div>
        <div class="card"><strong>业务机会分</strong><div class="bar"><span style="width:76%"></span></div><p class="muted">76 / 100</p></div>
        <div class="card risk"><strong>问题致命度</strong><div class="bar"><span></span></div><p class="muted">54 / 100</p></div>
      </div>
    </section>
    <section>
      <h2>品牌阶段判断</h2>
      <div class="grid">
        <div class="card"><strong>当前阶段</strong><p>待真实诊断：需联网核验销售规模、渠道结构、主力 SKU 和口碑。</p></div>
        <div class="card"><strong>销售规模校准</strong><p>演示环境不生成真实估算；上线后输出 USD / RMB 区间和证据 ID。</p></div>
        <div class="card"><strong>下一步</strong><p>配置 OPENAI_API_KEY 与 GitHub 发布密钥后，即可生成可分享报告链接。</p></div>
      </div>
    </section>
    <section>
      <h2>三大板块诊断</h2>
      <div class="grid">
        <div class="card"><strong>品牌板块</strong><p>演示占位。真实报告会写做得好的 3 条、做得不好的 3 条和证据 ID。</p></div>
        <div class="card"><strong>Marketing 板块</strong><p>演示占位。真实报告会采样搜索、社媒、内容和广告公开信号。</p></div>
        <div class="card"><strong>电商板块</strong><p>演示占位。真实报告会比较官网、Amazon、零售渠道和竞品价格。</p></div>
      </div>
    </section>
    <section>
      <h2>数据状态</h2>
      <p class="muted">生成日期：${today}。当前为 mock 模式，不可作为商业判断。</p>
    </section>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
