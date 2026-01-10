/**
 * 脈 -MYAKU PRIVATE SAUNA- (spot-ly) スクレイパー
 * URL: https://spot-ly.jp/ja/hotels/176
 *
 * 3部屋・7プラン:
 * - 休 KYU: 90分プラン（午後）
 * - 水 MIZU: ナイトパック、90分プラン（午後）、90分プラン（午前）
 * - 火 HI: ナイトパック、90分プラン（午後）、90分プラン（午前）
 *
 * 実装: モーダルを開いて時間帯ごとの空き状況を取得
 */

const BASE_URL = 'https://spot-ly.jp/ja/hotels/176';

// プラン情報（ページに表示される順番、予約ボタンのindex）
// 料金は公式サイト https://www.myaku-sauna.com/ より
const PLANS = [
  { name: '休 KYU（90分/定員3名）¥9,130〜', buttonIndex: 12, selectIndex: 0, isNight: false },
  { name: '水 MIZU（night/定員2名）¥8,800〜', buttonIndex: 15, selectIndex: 2, isNight: true },
  { name: '水 MIZU（90分/定員2名）¥6,600〜', buttonIndex: 16, selectIndex: 4, isNight: false },
  { name: '火 HI（night/定員4名）¥10,120〜', buttonIndex: 20, selectIndex: 8, isNight: true },
  { name: '火 HI（90分/定員4名）¥7,150〜', buttonIndex: 21, selectIndex: 10, isNight: false }
];

// 時間帯（固定）
const TIME_SLOTS = ['11:30〜13:00', '13:30〜15:00', '15:30〜17:00', '17:30〜19:00', '19:30〜21:00'];

async function scrape(browser) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // メインページに移動
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const result = { dates: {} };
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 各プランについてモーダルを開いて時間帯を取得
    for (const plan of PLANS) {
      try {
        // 人数を1名に設定（React Selectをキーボード操作で開く）
        await page.evaluate((selectIndex) => {
          const input = document.getElementById(`react-select-${selectIndex + 2}-input`);
          if (input) {
            input.focus();
            const keydown = new KeyboardEvent('keydown', {
              key: 'ArrowDown',
              code: 'ArrowDown',
              keyCode: 40,
              which: 40,
              bubbles: true
            });
            input.dispatchEvent(keydown);
          }
        }, plan.selectIndex);
        await new Promise(resolve => setTimeout(resolve, 500));

        // 1名を選択
        await page.evaluate(() => {
          const options = document.querySelectorAll('[class*="option"]');
          for (let i = 0; i < options.length; i++) {
            if (options[i].textContent.trim() === '1名') {
              options[i].click();
              break;
            }
          }
        });
        await new Promise(resolve => setTimeout(resolve, 500));

        // 予約するボタンをクリック
        await page.evaluate((buttonIndex) => {
          const buttons = document.querySelectorAll('button');
          if (buttons[buttonIndex]) {
            buttons[buttonIndex].click();
          }
        }, plan.buttonIndex);
        await new Promise(resolve => setTimeout(resolve, 1500));

        // モーダルから時間帯データを取得
        const slots = await page.evaluate((currentYear, currentMonth) => {
          const results = [];
          const buttons = document.querySelectorAll('button');

          // 時間帯ボタンを探す（11:30-13:00形式）
          const timeButtons = [];
          for (let i = 0; i < buttons.length; i++) {
            const text = buttons[i].textContent.trim().replace(/\s+/g, '');
            if (text.match(/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/)) {
              timeButtons.push({
                text: text,
                disabled: buttons[i].disabled
              });
            }
          }

          // 7日間 × 5時間帯 = 35ボタン
          // 列順に並んでいる（1日目の全時間帯、2日目の全時間帯...）
          const slotsPerDay = 5;
          const daysCount = 7;

          // 日付ヘッダーを取得
          const dateHeaders = [];
          const allElements = document.querySelectorAll('*');
          for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            const text = el.textContent.trim();
            // "10\n土" のような形式を探す
            if (text.match(/^\d{1,2}\n[日月火水木金土]$/) && el.children.length === 0) {
              const match = text.match(/^(\d{1,2})/);
              if (match) {
                dateHeaders.push(parseInt(match[1]));
              }
            }
          }

          // 時間帯ごとに処理（行順）
          for (let slot = 0; slot < slotsPerDay; slot++) {
            for (let day = 0; day < daysCount; day++) {
              const idx = day * slotsPerDay + slot;
              if (idx < timeButtons.length && !timeButtons[idx].disabled) {
                const dayOfMonth = dateHeaders[day] || (10 + day); // フォールバック
                results.push({
                  day: dayOfMonth,
                  slotIndex: slot,
                  timeText: timeButtons[idx].text
                });
              }
            }
          }

          return results;
        }, currentYear, currentMonth);

        // 結果を整形
        for (const slot of slots) {
          // 月と年を判定
          let month = currentMonth;
          let year = currentYear;
          if (slot.day < now.getDate() - 7) {
            month = currentMonth + 1;
            if (month > 12) {
              month = 1;
              year = currentYear + 1;
            }
          }

          let dateStr = `${year}-${String(month).padStart(2, '0')}-${String(slot.day).padStart(2, '0')}`;

          // ナイトプランは前日として表示
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

          const timeSlot = TIME_SLOTS[slot.slotIndex];
          if (timeSlot && !result.dates[dateStr][plan.name].includes(timeSlot)) {
            result.dates[dateStr][plan.name].push(timeSlot);
          }
        }

        // モーダルを閉じる
        await page.evaluate(() => {
          const closeBtn = document.querySelector('[class*="close"], button svg');
          if (closeBtn) {
            closeBtn.closest('button')?.click();
          }
          // ×ボタンまたはモーダル外をクリック
          const modal = document.querySelector('[role="dialog"], [class*="modal"]');
          if (modal) {
            const closeButton = modal.querySelector('button');
            if (closeButton && closeButton.querySelector('svg')) {
              closeButton.click();
            }
          }
        });
        await new Promise(resolve => setTimeout(resolve, 500));

        // ESCキーでモーダルを閉じる
        await page.keyboard.press('Escape');
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.log(`    → 脈: ${plan.name} の取得でエラー: ${err.message}`);
      }
    }

    console.log(`    → 脈: ${Object.keys(result.dates).length}日分のデータ取得`);
    return result;

  } finally {
    await page.close();
  }
}

module.exports = { scrape };
