/**
 * 脈 -MYAKU PRIVATE SAUNA- (spot-ly) スクレイパー
 * URL: https://spot-ly.jp/ja/hotels/176
 *
 * 3部屋:
 * - 休 KYU (3名): 90分プラン（午後）¥9,130〜
 * - 水 MIZU (2名): ナイトパック ¥8,800〜、90分（午前/午後）¥6,600〜
 * - 火 HI (4名): ナイトパック ¥10,120〜、90分（午前/午後）¥7,150〜
 *
 * 注意: spot-lyは日単位の空き状況（◯/✕）のみ提供。
 * 詳細な時間帯別空き状況は予約サイトで確認が必要。
 */

const BASE_URL = 'https://spot-ly.jp/ja/hotels/176';

/**
 * メインページから日単位の空き状況を取得（従来方式・フォールバック用）
 */
async function scrapeDailyAvailability(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 3000));

  const plansData = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    const plans = [];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const today = new Date().getDate();

    // 各プランのパターン
    const planPatterns = [
      { room: '休 KYU', plan: '90分プラン（午後）', displayName: '休 KYU（90分/定員3名）¥9,130〜', times: ['11:30〜13:00', '13:30〜15:00', '15:30〜17:00', '17:30〜19:00', '19:30〜21:00'] },
      { room: '水 MIZU', plan: 'ナイトパック', displayName: '水 MIZU（night/定員2名）¥8,800〜', times: ['01:00〜08:30'], isNight: true },
      { room: '水 MIZU', plan: '90分プラン（午後）', displayName: '水 MIZU（90分/定員2名）¥6,600〜', times: ['13:00〜14:30', '15:00〜16:30', '17:00〜18:30', '19:00〜20:30', '21:00〜22:30', '23:00〜00:30'] },
      { room: '水 MIZU', plan: '90分プラン（午前）', displayName: '水 MIZU（90分/定員2名）¥6,600〜', times: ['09:00〜10:30', '11:00〜12:30'] },
      { room: '火 HI', plan: 'ナイトパック', displayName: '火 HI（night/定員4名）¥10,120〜', times: ['00:30〜08:00'], isNight: true },
      { room: '火 HI', plan: '90分プラン（午後）', displayName: '火 HI（90分/定員4名）¥7,150〜', times: ['14:30〜16:00', '16:30〜18:00', '18:30〜20:00', '20:30〜22:00', '22:30〜00:00'] },
      { room: '火 HI', plan: '90分プラン（午前）', displayName: '火 HI（90分/定員4名）¥7,150〜', times: ['08:30〜10:00', '10:30〜12:00', '12:30〜14:00'] }
    ];

    for (const pattern of planPatterns) {
      // プランセクションを探す
      const regex = new RegExp(
        `【${pattern.room.replace(' ', '\\s*-?')}[^】]*】${pattern.plan}[\\s\\S]*?` +
        `([月火水木金土日]\\n[月火水木金土日]\\n[月火水木金土日]\\n[月火水木金土日]\\n[月火水木金土日]\\n[月火水木金土日]\\n[月火水木金土日]\\n)` +
        `([\\s\\S]*?)\\n大人`
      );

      const match = bodyText.match(regex);
      if (match) {
        const calendarText = match[2];
        const dateAvailPairs = calendarText.trim().split('\n');

        const dates = [];
        for (let i = 0; i < dateAvailPairs.length - 1; i += 2) {
          const dateStr = dateAvailPairs[i];
          const avail = dateAvailPairs[i + 1];

          const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})/);
          if (dateMatch) {
            let month = parseInt(dateMatch[1]);
            let day = parseInt(dateMatch[2]);
            let year = currentYear;

            if (month === 1 && currentMonth === 12) {
              year = currentYear + 1;
            }

            dates.push({
              date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
              available: avail === '◯'
            });
          }
        }

        plans.push({
          ...pattern,
          dates
        });
      }
    }

    return plans;
  });

  return plansData;
}

async function scrape(browser) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });

  try {
    const result = { dates: {} };

    // 日単位の空き状況を取得（フォールバック用）
    console.log('    → 日単位の空き状況を取得中...');
    const dailyData = await scrapeDailyAvailability(page);

    // 日単位データを結果に変換
    // spot-lyは日単位の空き情報のみ提供のため、「空き枠あり」として表示
    for (const plan of dailyData) {
      for (const dateInfo of plan.dates) {
        if (!dateInfo.available) continue;

        let dateStr = dateInfo.date;

        // ナイトパックは前日として表示
        if (plan.isNight) {
          const d = new Date(dateStr);
          d.setDate(d.getDate() - 1);
          dateStr = d.toISOString().split('T')[0];
        }

        if (!result.dates[dateStr]) {
          result.dates[dateStr] = {};
        }

        if (!result.dates[dateStr][plan.displayName]) {
          result.dates[dateStr][plan.displayName] = [];
        }

        // 日単位の空き情報として「空き枠あり」を1つだけ追加
        // ※詳細な時間帯はspot-lyサイトで確認が必要
        const availabilityNote = '空き枠あり（詳細は予約サイトで）';
        if (!result.dates[dateStr][plan.displayName].includes(availabilityNote)) {
          result.dates[dateStr][plan.displayName].push(availabilityNote);
        }
      }
    }

    console.log(`    → 脈: ${Object.keys(result.dates).length}日分のデータ取得`);
    return result;
  } finally {
    await page.close();
  }
}

module.exports = { scrape };
