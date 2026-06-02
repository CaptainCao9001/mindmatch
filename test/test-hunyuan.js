// ============================================================
// 命令行 API 测试工具 — 直接验证 Key 是否可用（绕过浏览器 CORS）
// 使用: node test/test-hunyuan.js <你的API_Key>
// ============================================================

const apiKey = process.argv[2];
if (!apiKey) {
  console.log('❌ 用法: node test/test-hunyuan.js <你的API_Key>');
  console.log('   例如: node test/test-hunyuan.js sk-xxxxxx');
  process.exit(1);
}

const ENDPOINT = 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions';
const TIMEOUT = 15000;

async function test() {
  console.log('🔍 正在测试混元 API 连接...\n');
  console.log(`   Key: ${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`);
  console.log(`   端点: ${ENDPOINT}`);
  console.log(`   模型: hunyuan-lite\n`);

  const start = Date.now();

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), TIMEOUT);

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'hunyuan-lite',
        messages: [{ role: 'user', content: '请用一句话回复：你好，世界。' }],
        temperature: 0.7,
        max_tokens: 50,
      }),
      signal: controller.signal,
    });

    const elapsed = Date.now() - start;

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.log(`❌ HTTP ${res.status}: ${errData.error?.message || '未知错误'}\n`);
      if (res.status === 401) console.log('   → Key 无效或未授权');
      if (res.status === 403) console.log('   → 服务未开通或 Key 无权限');
      if (res.status === 429) console.log('   → 请求频率过高，稍后重试');
      process.exit(2);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;

    console.log(`✅ 连接成功！耗时 ${elapsed}ms\n`);
    console.log(`   回复: "${content}"\n`);
    console.log(`📊 使用量: prompt_tokens=${data.usage?.prompt_tokens || '?'}, completion_tokens=${data.usage?.completion_tokens || '?'}\n`);
    console.log('🎉 Key 可用，可以开始使用了！');
    process.exit(0);
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log(`❌ 连接超时 (${TIMEOUT}ms)`);
      console.log('   → 网络不通或混元 API 不可达');
    } else {
      console.log(`❌ 网络错误: ${err.message}`);
    }
    process.exit(3);
  }
}

test();
