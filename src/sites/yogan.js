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
 * カレンダーの日付をクリックして時間枠を取得
 */

const flaresolverr = require('../flaresolverr');

const URL = 'https://reserva.be/saunayogan/reserve?mode=service_staff&search_evt_no=eeeJyzMDY2MQIAAxwBBQ';

// 部屋情報（統一フォーマット）
const ROOM_NAME = 'プライベートサウナ（150分/定員3名）¥9,900-13,200';

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

    // デバッグ: ページタイトルとURL確認
    const pageTitle = await page.title();
    console.log(`    サウナヨーガン: ページタイトル = "${pageTitle}"`);

    // Cloudflareチャレンジページかどうかチェック
    if (pageTitle.includes('Just a moment') || pageTitle.includes('Cloudflare')) {
      console.log('    サウナヨーガン: Cloudflareチャレンジページ検出 - スキップ');
      return { dates: {} };
    }

    // ローカル日付をYYYY-MM-DD形式で取得
    function formatLocalDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 結果を格納
    const result = { dates: {} };
    const today = new Date();

    // 7日分の日付を初期化
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = formatLocalDate(date);
      result.dates[dateStr] = {};
      result.dates[dateStr][ROOM_NAME] = [];
    }

    // カレンダーの日付をクリックして時間枠を取得
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const dateStr = formatLocalDate(targetDate);
      const dateId = formatLocalDate(targetDate); // YYYY-MM-DD形式

      // 2日目以降は再度ページにアクセス（goBackが効かないため）
      if (i > 0) {
        await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // 日付が利用可能か確認してクリック
      // input[id="2026-01-11"][data-targetdate]:not(.is-unavailable)
      const clicked = await page.evaluate((dateId) => {
        // カレンダーのinput要素を探す
        const input = document.querySelector(`input#${CSS.escape(dateId)}:not(.is-unavailable)`);
        if (input && input.dataset.targetdate) {
          // 対応するlabelをクリック
          const label = document.querySelector(`label[for="${dateId}"]`);
          if (label) {
            label.click();
            return 'label';
          }
          // labelがなければinputをクリック
          input.click();
          return 'input';
        }
        return null;
      }, dateId);

      console.log(`    サウナヨーガン: ${dateStr} クリック結果 = ${clicked}`);

      if (clicked) {
        // 時間枠のロードを待つ
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 時間枠を取得: input.timebox[data-vacancy="1"] の data-time
        const timeSlots = await page.evaluate(() => {
          const slots = [];

          // input.timebox[data-vacancy="1"] から取得
          const timeboxInputs = document.querySelectorAll('input.timebox[data-vacancy="1"]');
          timeboxInputs.forEach(input => {
            const time = input.dataset.time; // "10:00～12:30" 形式
            if (time) {
              // ～ を 〜 に統一
              const normalizedTime = time.replace(/[～~]/g, '〜');
              if (!slots.includes(normalizedTime)) {
                slots.push(normalizedTime);
              }
            }
          });

          return slots;
        });

        console.log(`    サウナヨーガン: ${dateStr} 空き枠 = ${timeSlots.length}個 [${timeSlots.join(', ')}]`);

        if (timeSlots.length > 0) {
          result.dates[dateStr][ROOM_NAME] = timeSlots.sort((a, b) => {
            const [aH] = a.split(':').map(Number);
            const [bH] = b.split(':').map(Number);
            return aH - bH;
          });
        }
      }
    }

    return result;
  } finally {
    await page.close();
  }
}

module.exports = { scrape };
