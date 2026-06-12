const handler = require('../api/diagnosis');

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end(value = '') {
      this.body = value;
    }
  };
}

async function main() {
  const req = {
    method: 'POST',
    body: { brand: 'Ulike' },
    [Symbol.asyncIterator]: async function* noop() {}
  };
  const res = createMockResponse();

  await handler(req, res);

  const payload = JSON.parse(res.body);
  console.log(JSON.stringify({
    statusCode: res.statusCode,
    mode: payload.mode,
    brand: payload.brand,
    hasReportHtml: Boolean(payload.reportHtml),
    hasReportUrl: Boolean(payload.reportUrl),
    errorCode: payload.errorCode || null
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
