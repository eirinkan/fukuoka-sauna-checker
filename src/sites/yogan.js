/**
 * サウナヨーガン福岡天神 (reserva.be) スクレイパー
 * URL: https://reserva.be/saunayogan
 *
 * 1部屋: プライベートサウナ (3名)
 * - ¥9,900（平日）/ ¥13,200（土日祝）
 * - 2時間30分制
 * - 時間枠: 10:00〜, 13:10〜, 16:20〜, 19:30〜
 *
 * Cloudflare保護あり → FlareSolverr使用
 */

const flaresolverr = require('../flaresolverr');

const URL = 'https://reserva.be/saunayogan/reserve?mode=service_staff&search_evt_no=eeeJyzMDY2MQIAAxwBBQ';

// 部屋情報（統一フォーマット）
const ROOM_NAME = 'プライベートサウナ（150分/定員3名）¥9,900-13,200';

// 固定の時間枠（150分制）
const TIME_SLOTS = [
  '10:00〜12:30',
  '13:10〜15:40',
  '16:20〜18:50',
  '19:30〜22:00'
];

// キャッシュされたCloudflare Cookies
let cachedCookies = null;
let cachedUserAgent = null;

/**
 * FlareSolverrでCloudflare Cookieを取得
 */
async function getCloudfareCookies() {
  if (cachedCookies && cachedUserAgent) {
    return { cookies: cachedCookies, userAgent: cachedUserAgent };
  }

  try {
    const testUrl = 'https://reserva.be/saunayogan';
    console.log('  サウナヨーガン: Cloudflare Cookie取得中...');
    const { cookies, userAgent } = await flaresolverr.getPageHtml(testUrl, 60000);

    if (cookies && cookies.length > 0) {
      cachedCookies = cookies;
      cachedUserAgent = userAgent;
      console.log(`  サウナヨーガン: Cookie ${cookies.length}個取得成功`);
      return { cookies, userAgent };
    }
  } catch (error) {
    console.log(`  サウナヨーガン: Cookie取得失敗 - ${error.message}`);
  }

  return null;
}

async function scrape(browser) {
  const page = await browser.newPage();

  try {
    // FlareSolverrからCloudflare Cookieを取得
    let cfData = null;
    const isFlareSolverrAvailable = await flaresolverr.isAvailable();
    if (isFlareSolverrAvailable) {
      cfData = await getCloudfareCookies();
    } else {
      console.log('  サウナヨーガン: FlareSolverr利用不可（直接アクセス試行）');
    }

    // User-Agentを設定
    const userAgent = cfData?.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 1280, height: 900 });

    // FlareSolverr Cookieを設定
    if (cfData?.cookies && cfData.cookies.length > 0) {
      const puppeteerCookies = cfData.cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || '.reserva.be',
        path: cookie.path || '/',
        expires: cookie.expiry || -1,
        httpOnly: cookie.httpOnly || false,
        secure: cookie.secure || false,
        sameSite: cookie.sameSite || 'Lax'
      }));
      await page.setCookie(...puppeteerCookies);
    }

    // ボット検知回避
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['ja-JP', 'ja', 'en-US', 'en'] });
      window.chrome = { runtime: {} };
    });

    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 「時間単位予約」を選択
    try {
      await page.evaluate(() => {
        const radios = document.querySelectorAll('input[type="radio"]');
        for (const radio of radios) {
          const label = radio.closest('label') || radio.parentElement;
          if (label && label.textContent.includes('時間単位')) {
            radio.click();
            return true;
          }
        }
        return false;
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 「決定」ボタンをクリック
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('button, input[type="submit"], a');
        for (const btn of buttons) {
          if (btn.textContent?.includes('決定') || btn.value?.includes('決定')) {
            btn.click();
            return true;
          }
        }
        return false;
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (e) {
      // 予約フロー操作に失敗しても続行
    }

    // カレンダーデータを取得
    const calendarData = await page.evaluate(() => {
      const data = {};

      // input.timebox 要素から取得（RESERVAの標準形式）
      const timeboxInputs = document.querySelectorAll('input.timebox');

      if (timeboxInputs.length > 0) {
        timeboxInputs.forEach(input => {
          const targetGroup = input.dataset.targetgroup; // "2026-01-06"
          const time = input.dataset.time; // "10:00～12:30"
          const vacancy = input.dataset.vacancy;

          if (targetGroup && time && vacancy === '1') {
            const dateStr = targetGroup;
            // 時間を統一形式に変換
            const timeParts = time.split('～');
            const timeRange = timeParts[0].replace(/^0/, '') + '〜' + timeParts[1].replace(/^0/, '');

            if (!data[dateStr]) {
              data[dateStr] = [];
            }
            if (!data[dateStr].includes(timeRange)) {
              data[dateStr].push(timeRange);
            }
          }
        });

        // 結果をソート
        for (const dateStr of Object.keys(data)) {
          data[dateStr].sort((a, b) => {
            const timeA = a.split(':').map(Number);
            const timeB = b.split(':').map(Number);
            return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
          });
        }
      }

      return data;
    });

    // 結果を整形
    const result = { dates: {} };
    const today = new Date();

    // 7日分の日付を確保
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      result.dates[dateStr] = {};
      result.dates[dateStr][ROOM_NAME] = calendarData[dateStr] || [];
    }

    // 取得データをマージ
    for (const [dateStr, times] of Object.entries(calendarData)) {
      if (!result.dates[dateStr]) {
        result.dates[dateStr] = {};
      }
      result.dates[dateStr][ROOM_NAME] = times;
    }

    return result;
  } finally {
    await page.close();
  }
}

module.exports = { scrape };
