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

    // 結果を格納
    const result = { dates: {} };
    const today = new Date();

    // 7日分の日付を初期化
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      result.dates[dateStr] = {};
      result.dates[dateStr][ROOM_NAME] = [];
    }

    // カレンダーの日付リンクを取得してクリック
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const dateStr = targetDate.toISOString().split('T')[0];
      const month = targetDate.getMonth() + 1;
      const day = targetDate.getDate();

      // 日付をクリック
      const clicked = await page.evaluate((m, d) => {
        // カレンダーの日付リンクを探す
        const links = document.querySelectorAll('a, td, div');
        for (const el of links) {
          const text = el.textContent?.trim();
          // 日付だけのテキストを持つ要素を探す
          if (text === String(d)) {
            // クリック可能な要素か確認
            const style = window.getComputedStyle(el);
            if (style.cursor === 'pointer' || el.tagName === 'A' || el.onclick) {
              el.click();
              return true;
            }
          }
        }
        // aタグで日付を含むものを探す
        const dateLinks = document.querySelectorAll('a[href*="calendar"], a[href*="reserve"], td.calendar-day, .day');
        for (const link of dateLinks) {
          if (link.textContent?.includes(String(d))) {
            link.click();
            return true;
          }
        }
        return false;
      }, month, day);

      if (clicked) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 時間枠を取得
        const timeSlots = await page.evaluate(() => {
          const slots = [];

          // input.timebox 要素から取得（RESERVAの標準形式）
          const timeboxInputs = document.querySelectorAll('input.timebox');
          timeboxInputs.forEach(input => {
            const time = input.dataset.time;
            const vacancy = input.dataset.vacancy;
            if (time && vacancy === '1') {
              // 時間を統一形式に変換（10:00～12:30 → 10:00〜12:30）
              const formattedTime = time.replace('～', '〜');
              if (!slots.includes(formattedTime)) {
                slots.push(formattedTime);
              }
            }
          });

          // 他の形式も試す
          if (slots.length === 0) {
            const timeElements = document.querySelectorAll('.time-slot, .available-time, [class*="time"]');
            timeElements.forEach(el => {
              const text = el.textContent?.trim();
              if (text && text.match(/\d{1,2}:\d{2}/)) {
                // 空きありの場合のみ
                if (!el.classList.contains('disabled') && !el.classList.contains('unavailable')) {
                  slots.push(text.replace('～', '〜'));
                }
              }
            });
          }

          // ボタンやリンクで時間を含むものを探す
          if (slots.length === 0) {
            const buttons = document.querySelectorAll('button, a, label');
            buttons.forEach(btn => {
              const text = btn.textContent?.trim();
              const timeMatch = text?.match(/(\d{1,2}:\d{2})[〜～](\d{1,2}:\d{2})/);
              if (timeMatch) {
                const time = `${timeMatch[1]}〜${timeMatch[2]}`;
                if (!slots.includes(time)) {
                  slots.push(time);
                }
              }
            });
          }

          return slots;
        });

        if (timeSlots.length > 0) {
          result.dates[dateStr][ROOM_NAME] = timeSlots.sort((a, b) => {
            const [aH] = a.split(':').map(Number);
            const [bH] = b.split(':').map(Number);
            return aH - bH;
          });
        }

        // 戻る（カレンダーに戻る）
        await page.goBack({ waitUntil: 'networkidle2' }).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return result;
  } finally {
    await page.close();
  }
}

module.exports = { scrape };
