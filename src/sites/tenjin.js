/**
 * テンジンサウナ (select-type.com) スクレイパー
 * URL: https://select-type.com/rsv/?id=1nwOWa5ac9Y
 *
 * 2部屋:
 * - StandardRoom (2名まで): 60分〜180分、¥2,090〜¥6,270
 * - DeluxeRoom (4名まで): 60分〜180分、¥3,135〜¥9,405
 *
 * 構造: 週間カレンダー（●受付中、×締め切り）
 */

const URL = 'https://select-type.com/rsv/?id=1nwOWa5ac9Y';

// 部屋情報
const ROOMS = [
  {
    name: 'Standard（60-180分/定員2名）¥2,090-6,270',
    courseId: '309512',  // c_id
    capacity: 2
  },
  {
    name: 'Deluxe（60-180分/定員4名）¥3,135-9,405',
    courseId: '309513',  // c_id
    capacity: 4
  }
];

// 時間選択（90分を使用）
const TIME_OPTION = '137019';  // 90分 ¥3,135

async function scrape(browser) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 1200 });

  try {
    const result = { dates: {} };

    for (const room of ROOMS) {
      await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 部屋を選択
      await page.evaluate((courseId) => {
        if (typeof rsv !== 'undefined' && rsv.chgCrsCal) {
          rsv.chgCrsCal(parseInt(courseId));
        }
      }, room.courseId);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 時間を選択（90分）- evaluate内でクリック
      await page.evaluate((timeValue) => {
        const radios = document.querySelectorAll('input[type="radio"]');
        for (const radio of radios) {
          if (radio.value === timeValue) {
            radio.click();
            break;
          }
        }
      }, TIME_OPTION);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // カレンダーデータを取得
      const calendarData = await page.evaluate(() => {
        const data = {};
        const bodyText = document.body.innerText;

        // 週間範囲を取得（例: "1/4～ 1/10"）
        const weekRangeMatch = bodyText.match(/(\d{1,2})\/(\d{1,2})～\s*(\d{1,2})\/(\d{1,2})/);
        if (!weekRangeMatch) return data;

        const year = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        // 日付の配列を作成
        const startMonth = parseInt(weekRangeMatch[1]);
        const startDay = parseInt(weekRangeMatch[2]);
        const dates = [];

        for (let i = 0; i < 7; i++) {
          const d = new Date(year, startMonth - 1, startDay + i);
          // 年跨ぎ対応
          let y = d.getFullYear();
          if (startMonth === 1 && currentMonth === 12) {
            y = year + 1;
          }
          dates.push(`${y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        }

        // カレンダーテーブルを解析
        // select-type.comのカレンダー構造: 時間×日付のグリッド
        const rows = document.querySelectorAll('.tbl_rsv tbody tr, table tbody tr');

        for (const row of rows) {
          const cells = row.querySelectorAll('td, th');
          if (cells.length < 2) continue;

          // 最初のセルから時間を取得
          const firstCellText = cells[0].textContent.trim();
          const timeMatch = firstCellText.match(/^(\d{1,2}:\d{2})$/);
          if (!timeMatch) continue;

          const startTime = timeMatch[1];
          // 90分後の終了時間を計算
          const [h, m] = startTime.split(':').map(Number);
          const endMinutes = h * 60 + m + 90;
          const endH = Math.floor(endMinutes / 60) % 24;
          const endM = endMinutes % 60;
          const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
          const timeRange = `${startTime}〜${endTime}`;

          // 各日付の空き状況をチェック
          for (let i = 1; i < cells.length && i - 1 < dates.length; i++) {
            const cell = cells[i];
            const cellText = cell.textContent.trim();
            const dateStr = dates[i - 1];

            // ● = 受付中（空きあり）
            if (cellText.includes('●') || cell.querySelector('.rsv_ok, .available, [class*="ok"]')) {
              if (!data[dateStr]) {
                data[dateStr] = [];
              }
              if (!data[dateStr].includes(timeRange)) {
                data[dateStr].push(timeRange);
              }
            }
          }
        }

        return data;
      });

      // 結果にマージ
      for (const [dateStr, times] of Object.entries(calendarData)) {
        if (!result.dates[dateStr]) {
          result.dates[dateStr] = {};
        }
        result.dates[dateStr][room.name] = times.sort();
      }

      // 7日分の日付を確保
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        if (!result.dates[dateStr]) {
          result.dates[dateStr] = {};
        }
        if (!result.dates[dateStr][room.name]) {
          result.dates[dateStr][room.name] = [];
        }
      }
    }

    return result;
  } finally {
    await page.close();
  }
}

module.exports = { scrape };
