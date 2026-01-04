/**
 * 脈 -MYAKU PRIVATE SAUNA- (spot-ly) スクレイパー
 * URL: https://spot-ly.jp/ja/hotels/176
 *
 * 3部屋:
 * - 休 KYU (3名): 90分プラン（午後）
 * - 水 MIZU (2名): ナイトパック、90分（午前/午後）
 * - 火 HI (4名): ナイトパック、90分（午前/午後）
 *
 * 構造: 週間カレンダー形式（◯/✕で日単位の空き表示）
 */

// 1週間分のURLを生成
function getUrl() {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 6);

  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}+00%3A00%3A00`;
  };

  return `https://spot-ly.jp/ja/hotels/176?checkinDatetime=${formatDate(today)}&checkoutDatetime=${formatDate(endDate)}`;
}

// 部屋情報（統一フォーマット：部屋名（時間/定員）価格）
const ROOM_INFO = {
  '休 -KYU-': {
    displayName: '休 KYU（90分/定員3名）¥5,500',
    capacity: 3,
    plans: {
      '90分プラン（午後）': { times: ['11:30〜13:00', '13:30〜15:00', '15:30〜17:00', '17:30〜19:00', '19:30〜21:00'] }
    }
  },
  '水 -MIZU-': {
    displayName: '水 MIZU（90分/定員2名）¥5,500',
    capacity: 2,
    plans: {
      'ナイトパック': { times: ['01:00〜08:30'], isNight: true },
      '90分プラン（午後）': { times: ['13:00〜14:30', '15:00〜16:30', '17:00〜18:30', '19:00〜20:30', '21:00〜22:30', '23:00〜00:30'] },
      '90分プラン（午前）': { times: ['09:00〜10:30', '11:00〜12:30'] }
    }
  },
  '火 -HI-': {
    displayName: '火 HI（90分/定員4名）¥5,500',
    capacity: 4,
    plans: {
      'ナイトパック': { times: ['00:30〜08:00'], isNight: true },
      '90分プラン（午後）': { times: ['14:30〜16:00', '16:30〜18:00', '18:30〜20:00', '20:30〜22:00', '22:30〜00:00'] },
      '90分プラン（午前）': { times: ['08:30〜10:00', '10:30〜12:00', '12:30〜14:00'] }
    }
  }
};

async function scrape(browser) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });

  try {
    const url = getUrl();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // ページからプランデータを抽出
    const plansData = await page.evaluate(() => {
      const allText = document.body.innerText;
      const planRegex = /【([^】]+)】([^\n]+)\n\n([^\n]+)\n([^日]+)日\n月\n火\n水\n木\n金\n土\n(\d+\/\d+)\n([◯✕])\n(\d+\/\d+)\n([◯✕])\n(\d+\/\d+)\n([◯✕])\n(\d+\/\d+)\n([◯✕])\n(\d+\/\d+)\n([◯✕])\n(\d+\/\d+)\n([◯✕])\n(\d+\/\d+)\n([◯✕])/g;

      const plans = [];
      let match;
      while ((match = planRegex.exec(allText)) !== null) {
        plans.push({
          room: match[1],
          planType: match[2],
          dates: [
            { date: match[5], available: match[6] === '◯' },
            { date: match[7], available: match[8] === '◯' },
            { date: match[9], available: match[10] === '◯' },
            { date: match[11], available: match[12] === '◯' },
            { date: match[13], available: match[14] === '◯' },
            { date: match[15], available: match[16] === '◯' },
            { date: match[17], available: match[18] === '◯' }
          ]
        });
      }
      return plans;
    });

    // 結果を整形
    const result = { dates: {} };
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    for (const plan of plansData) {
      const roomInfo = ROOM_INFO[plan.room];
      if (!roomInfo) continue;

      const planInfo = roomInfo.plans[plan.planType];
      if (!planInfo) continue;

      // 部屋名を決定（ナイトパックは別表示）
      let displayName = roomInfo.displayName;
      if (planInfo.isNight) {
        displayName = displayName.replace(/（90分/, '（night');
      }

      for (const dateInfo of plan.dates) {
        // 日付を YYYY-MM-DD 形式に変換
        const [month, day] = dateInfo.date.split('/').map(Number);
        let year = currentYear;
        // 1月で現在が12月なら来年
        if (month === 1 && currentMonth === 12) {
          year = currentYear + 1;
        }
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        if (!result.dates[dateStr]) {
          result.dates[dateStr] = {};
        }

        // 空きがある日は時間枠を設定、なければ空配列
        if (dateInfo.available) {
          // 同じ部屋の複数プランをマージ
          if (!result.dates[dateStr][displayName]) {
            result.dates[dateStr][displayName] = [];
          }
          // 時間枠を追加（重複排除）
          for (const time of planInfo.times) {
            if (!result.dates[dateStr][displayName].includes(time)) {
              result.dates[dateStr][displayName].push(time);
            }
          }
        } else {
          // 空きなしの場合も部屋は表示（空配列）
          if (!result.dates[dateStr][displayName]) {
            result.dates[dateStr][displayName] = [];
          }
        }
      }
    }

    // 時間枠をソート
    for (const dateStr of Object.keys(result.dates)) {
      for (const roomName of Object.keys(result.dates[dateStr])) {
        result.dates[dateStr][roomName].sort((a, b) => {
          const aStart = a.split('〜')[0];
          const bStart = b.split('〜')[0];
          const [aH, aM] = aStart.split(':').map(Number);
          const [bH, bM] = bStart.split(':').map(Number);
          // 深夜帯（0-6時）は24時以降として扱う
          const aHour = aH < 7 ? aH + 24 : aH;
          const bHour = bH < 7 ? bH + 24 : bH;
          return (aHour * 60 + aM) - (bHour * 60 + bM);
        });
      }
    }

    return result;
  } finally {
    await page.close();
  }
}

module.exports = { scrape };
