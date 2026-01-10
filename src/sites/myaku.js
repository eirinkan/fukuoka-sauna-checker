/**
 * 脈 -MYAKU PRIVATE SAUNA- (spot-ly) スクレイパー
 * URL: https://spot-ly.jp/ja/hotels/176
 *
 * モーダル内の時間帯ボタンから詳細な空き状況を取得
 */

const BASE_URL = 'https://spot-ly.jp/ja/hotels/176';

// プラン情報（順序は空室状況ページでの表示順）
const PLANS = [
  {
    name: '休 KYU（90分/定員3名）¥9,130〜',
    planTitle: '【休 -KYU-】90分プラン（午後）',
    timeSlots: ['11:30〜13:00', '13:30〜15:00', '15:30〜17:00', '17:30〜19:00', '19:30〜21:00'],
    isNight: false,
    index: 0
  },
  {
    name: '水 MIZU（night/定員2名）¥8,800〜',
    planTitle: '【水 -MIZU-】ナイトパック',
    timeSlots: ['1:00〜8:30'],
    isNight: true,
    index: 1
  },
  {
    name: '水 MIZU（90分午後/定員2名）¥6,600〜',
    planTitle: '【水 -MIZU-】90分プラン（午後）',
    timeSlots: ['13:00〜14:30', '15:00〜16:30', '17:00〜18:30', '19:00〜20:30', '21:00〜22:30', '23:00〜0:30'],
    isNight: false,
    index: 2
  },
  {
    name: '水 MIZU（90分午前/定員2名）¥6,600〜',
    planTitle: '【水 -MIZU-】90分プラン（午前）',
    timeSlots: ['9:00〜10:30', '11:00〜12:30'],
    isNight: false,
    index: 3
  },
  {
    name: '火 HI（night/定員4名）¥10,120〜',
    planTitle: '【火 -HI-】ナイトパック',
    timeSlots: ['0:30〜8:00'],
    isNight: true,
    index: 4
  },
  {
    name: '火 HI（90分午後/定員4名）¥7,150〜',
    planTitle: '【火 -HI-】90分プラン（午後）',
    timeSlots: ['14:30〜16:00', '16:30〜18:00', '18:30〜20:00', '20:30〜22:00', '22:30〜0:00'],
    isNight: false,
    index: 5
  },
  {
    name: '火 HI（90分午前/定員4名）¥7,150〜',
    planTitle: '【火 -HI-】90分プラン（午前）',
    timeSlots: ['8:30〜10:00', '10:30〜12:00', '12:30〜14:00'],
    isNight: false,
    index: 6
  }
];

async function scrape(browser) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });

  try {
    console.log('    → 脈: アクセス中...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const result = { dates: {} };
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 空室状況ページへ移動
    await page.click('button.bg-black');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 現在のURL確認（空室状況ページに移動していることを確認）
    const currentUrl = page.url();
    if (!currentUrl.includes('checkinDatetime')) {
      console.log('    → 脈: 空室状況ページへの移動に失敗');
      return result;
    }

    // 各プランを処理
    for (const plan of PLANS) {
      console.log(`    → ${plan.planTitle}: スクレイピング中...`);

      try {
        // ページ内の全React Selectと予約するボタンを取得
        const planCount = await page.evaluate(() => {
          const selectContainers = document.querySelectorAll('.css-b62m3t-container');
          const reserveButtons = document.querySelectorAll('button.w-\\[144px\\]');
          return { selects: selectContainers.length, buttons: reserveButtons.length };
        });

        if (plan.index * 2 >= planCount.selects) {
          console.log(`    → ${plan.planTitle}: ドロップダウンが見つかりません`);
          continue;
        }

        // このプランの大人ドロップダウンのインデックス（各プランに2つ: 大人と子供）
        const selectIndex = plan.index * 2;

        // ドロップダウンをクリックして1名を選択
        await page.evaluate((idx) => {
          const selectContainers = document.querySelectorAll('.css-b62m3t-container');
          if (selectContainers[idx]) {
            const control = selectContainers[idx].querySelector('.css-13cymwt-control');
            if (control) {
              control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            }
          }
        }, selectIndex);
        await new Promise(resolve => setTimeout(resolve, 500));

        // 1名オプションをクリック
        await page.evaluate(() => {
          const options = document.querySelectorAll('[class*="option"]');
          for (const opt of options) {
            if (opt.innerText.trim() === '1名') {
              opt.click();
              return true;
            }
          }
          return false;
        });
        await new Promise(resolve => setTimeout(resolve, 500));

        // 予約するボタンをクリック
        const buttonClicked = await page.evaluate((idx) => {
          const reserveButtons = document.querySelectorAll('button.w-\\[144px\\]');
          if (reserveButtons[idx] && !reserveButtons[idx].disabled) {
            reserveButtons[idx].click();
            return true;
          }
          return false;
        }, plan.index);

        if (!buttonClicked) {
          console.log(`    → ${plan.planTitle}: ボタンが無効です`);
          continue;
        }

        // モーダルが開くのを待つ
        await new Promise(resolve => setTimeout(resolve, 2000));

        // モーダル内の時間帯ボタンから空き状況を取得
        const availability = await page.evaluate((timeSlots) => {
          // 時間帯ボタンを取得（モーダル内のflexボタン）
          const timeButtons = document.querySelectorAll('button[class*="flex-col"][class*="border"]');
          if (timeButtons.length === 0) {
            return { error: 'ボタンが見つかりません', count: 0 };
          }

          // 日付ヘッダーを取得
          const headerRow = document.querySelector('[class*="grid"]');
          const dateTexts = [];
          if (headerRow) {
            const dateEls = headerRow.querySelectorAll('div');
            dateEls.forEach(el => {
              const text = el.innerText.trim();
              if (text.match(/^\d{1,2}\n[日月火水木金土]$/)) {
                const day = parseInt(text.split('\n')[0]);
                dateTexts.push(day);
              }
            });
          }

          // 7日分の日付を推定
          const dates = [];
          if (dateTexts.length > 0) {
            for (const day of dateTexts) {
              dates.push({ day });
            }
          } else {
            // 日付が取得できない場合は今日から7日分
            const today = new Date();
            for (let i = 0; i < 7; i++) {
              const d = new Date(today);
              d.setDate(d.getDate() + i);
              dates.push({ day: d.getDate(), month: d.getMonth() + 1 });
            }
          }

          // ボタン数と時間帯数から日数を計算
          const slotsPerDay = timeSlots.length;
          const numDays = Math.min(Math.floor(timeButtons.length / slotsPerDay), 7);

          const availableSlots = [];

          for (let dayIdx = 0; dayIdx < numDays; dayIdx++) {
            const dateInfo = dates[dayIdx] || { day: dayIdx + 1 };

            for (let slotIdx = 0; slotIdx < slotsPerDay; slotIdx++) {
              const btnIndex = dayIdx * slotsPerDay + slotIdx;
              const btn = timeButtons[btnIndex];

              if (btn && !btn.disabled) {
                availableSlots.push({
                  day: dateInfo.day,
                  month: dateInfo.month,
                  timeSlot: timeSlots[slotIdx]
                });
              }
            }
          }

          return {
            totalButtons: timeButtons.length,
            slotsPerDay,
            numDays,
            availableSlots
          };
        }, plan.timeSlots);

        // モーダルを閉じる（×ボタンまたはESC）
        await page.keyboard.press('Escape');
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (availability.error) {
          console.log(`    → ${plan.planTitle}: ${availability.error}`);
          continue;
        }

        // 結果を処理
        let addedCount = 0;
        if (availability.availableSlots) {
          for (const slot of availability.availableSlots) {
            let month = slot.month || currentMonth;
            let year = currentYear;

            if (slot.day < now.getDate() - 7) {
              month = currentMonth + 1;
              if (month > 12) {
                month = 1;
                year++;
              }
            }

            let dateStr = `${year}-${String(month).padStart(2, '0')}-${String(slot.day).padStart(2, '0')}`;

            if (plan.isNight) {
              const d = new Date(dateStr);
              d.setDate(d.getDate() - 1);
              dateStr = d.toISOString().split('T')[0];
            }

            if (!result.dates[dateStr]) {
              result.dates[dateStr] = {};
            }
            if (!result.dates[dateStr][plan.name]) {
              result.dates[dateStr][plan.name] = [];
            }
            if (!result.dates[dateStr][plan.name].includes(slot.timeSlot)) {
              result.dates[dateStr][plan.name].push(slot.timeSlot);
              addedCount++;
            }
          }
        }

        console.log(`    → ${plan.planTitle}: 完了 (${addedCount}枠)`);

      } catch (err) {
        console.log(`    → ${plan.planTitle}: エラー - ${err.message}`);
      }
    }

    console.log(`    → 脈: ${Object.keys(result.dates).length}日分のデータ取得`);
    return result;

  } finally {
    await page.close();
  }
}

module.exports = { scrape };
