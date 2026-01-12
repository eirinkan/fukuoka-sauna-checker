/**
 * サウナヨーガン福岡天神 (reserva.be) スクレイパー
 * URL: https://reserva.be/saunayogan
 *
 * 1部屋: プライベートサウナ (3名)
 * - ¥9,900（平日）/ ¥13,200（土日祝）
 * - 2時間30分制
 * - 時間枠: 10:00〜, 13:10〜, 16:20〜, 20:30〜
 *
 * Cloudflare保護あり → puppeteer-extra stealth pluginで対応
 * カレンダーの日付をクリックして時間枠を取得
 */

const URL = 'https://reserva.be/saunayogan/reserve?mode=service_staff&search_evt_no=eeeJyzMDY2MQIAAxwBBQ';

// 部屋情報（統一フォーマット）
const ROOM_NAME = 'プライベートサウナ（150分/定員3名）¥9,900-13,200';

/**
 * ローカル日付をYYYY-MM-DD形式で取得
 */
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Cloudflareチャレンジ通過を待機
 */
async function waitForCloudflareChallenge(page, maxWait = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const pageTitle = await page.title();
    const pageContent = await page.content();

    // Cloudflareチャレンジページかどうかチェック
    const isChallenge =
      pageTitle.includes('Just a moment') ||
      pageTitle.includes('Cloudflare') ||
      pageTitle.includes('しばらくお待ちください') ||
      pageContent.includes('Checking your browser') ||
      pageContent.includes('cf-browser-verification');

    if (!isChallenge) {
      return true; // チャレンジ通過
    }

    // 1秒待って再チェック
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return false; // タイムアウト
}

/**
 * Puppeteerによるスクレイピング（puppeteer-extra stealth対応）
 */
async function scrape(browser) {
  const page = await browser.newPage();

  try {
    console.log('    → サウナヨーガン: puppeteer-extra stealthモードで取得開始');

    // Viewportのみ設定（stealth pluginがUserAgentなどを処理）
    await page.setViewport({ width: 1280, height: 900 });

    // ページにアクセス
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });

    // Cloudflareチャレンジ通過を待機
    const challengePassed = await waitForCloudflareChallenge(page, 30000);

    if (!challengePassed) {
      console.log('    → サウナヨーガン: Cloudflareチャレンジ通過失敗');
      // 空のデータを返す（エラーにしない）
      const result = { dates: {} };
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = formatLocalDate(date);
        result.dates[dateStr] = {};
        result.dates[dateStr][ROOM_NAME] = [];
      }
      return result;
    }

    // ページ読み込み完了を待機
    await new Promise(resolve => setTimeout(resolve, 5000));

    // デバッグ: ページタイトル確認
    const pageTitle = await page.title();
    console.log(`    → サウナヨーガン: ページタイトル = "${pageTitle}"`);

    // カレンダーのinput数を確認
    const inputCount = await page.evaluate(() => {
      return document.querySelectorAll('input[name="userselect_date"]').length;
    });
    console.log(`    → サウナヨーガン: カレンダーinput数 = ${inputCount}`);

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

    // カレンダーから利用可能な日付を取得
    const availableDates = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[name="userselect_date"][data-targetdate]:not(.is-unavailable)');
      return Array.from(inputs).map(input => input.dataset.targetdate);
    });

    console.log(`    → サウナヨーガン: 利用可能日 = ${availableDates.length}日 [${availableDates.slice(0, 5).join(', ')}...]`);

    // 対象日付（今日から7日間）と利用可能日のマッチング
    const targetDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = formatLocalDate(date);
      if (availableDates.includes(dateStr)) {
        targetDates.push(dateStr);
      }
    }

    console.log(`    → サウナヨーガン: 対象日 = ${targetDates.length}日`);

    // 各日付の時間枠を取得
    for (let i = 0; i < targetDates.length; i++) {
      const dateId = targetDates[i];

      // 2日目以降は再度ページにアクセス
      if (i > 0) {
        await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // 日付をクリック（labelをクリック）
      const clicked = await page.evaluate((dateId) => {
        const label = document.querySelector(`label[for="${dateId}"]`);
        if (label) {
          label.click();
          return true;
        }
        // 代替: inputを直接クリック
        const input = document.querySelector(`input#${CSS.escape(dateId)}`);
        if (input && !input.classList.contains('is-unavailable')) {
          input.click();
          return true;
        }
        return false;
      }, dateId);

      console.log(`    → サウナヨーガン: ${dateId} クリック = ${clicked}`);

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

        console.log(`    → サウナヨーガン: ${dateId} 空き枠 = ${timeSlots.length}個 [${timeSlots.join(', ')}]`);

        if (timeSlots.length > 0) {
          result.dates[dateId][ROOM_NAME] = timeSlots.sort((a, b) => {
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
