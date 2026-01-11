# 脈 -MYAKU PRIVATE SAUNA- スクレイピング要素メモ

URL: https://spot-ly.jp/ja/hotels/176

## 概要
- サイト: spot-ly.jp
- 認証: ログイン不要
- URLパラメータで日付範囲指定可能

## 部屋情報

### 休 KYU（定員3名）
- 90分プラン（午後）: 11:30~ / 13:30~ / 15:30~ / 17:30~ / 19:30~
- 料金: ¥9,130〜

### 水 MIZU（定員2名）
- ナイトパック: AM1:00 ~ AM8:30（¥8,800〜）
- 90分プラン（午後）: 13:00~ / 15:00~ / 17:00~ / 19:00~ / 21:00~ / 23:00~（¥6,600〜）
- 90分プラン（午前）: 9:00~ / 11:00~（¥6,600〜）

### 火 HI（定員4名）
- ナイトパック: AM0:30 ~ AM8:00（¥10,120〜）
- 90分プラン（午後）: 14:30~ / 16:30~ / 18:30~ / 20:30~ / 22:30~（¥7,150〜）
- 90分プラン（午前）: 8:30~ / 10:30~ / 12:30~（¥7,150〜）

---

## スクレイピングフロー

### 1. ページアクセス
```
https://spot-ly.jp/ja/hotels/176?checkinDatetime=YYYY-MM-DD+00%3A00%3A00&checkoutDatetime=YYYY-MM-DD+00%3A00%3A00
```

### 2. 空室状況ページへ移動
```javascript
// 黒い「予約する」ボタンをクリック
await page.click('button.bg-black');
```

### 3. プランカードの取得
各プランは「予約する」ボタン（`button.w-[144px]`）を持つカードで表示される

```javascript
// プラン順序の取得
const buttons = document.querySelectorAll('button.w-\\[144px\\]');
```

### 4. モーダルを開いて時間帯を取得
```javascript
// 「予約する」ボタンをクリックしてモーダルを開く
await page.evaluate((planIndex) => {
  const buttons = document.querySelectorAll('button.w-\\[144px\\]');
  buttons[planIndex].click();
}, planIndex);
```

---

## DOM要素

### 空室状況カレンダー（概要表示）
```html
<!-- 空いている日 -->
<div>
  <span>1/12</span>
  <span>○</span>
</div>

<!-- 埋まっている日 -->
<div>
  <span>1/11</span>
  <span>×</span>
</div>
```

### モーダル内の時間帯ボタン
```html
<!-- 空いている時間帯 -->
<button class="flex flex-col ...">
  <span>13:00</span>
  <span>-</span>
  <span>14:30</span>
</button>

<!-- 埋まっている時間帯 -->
<button disabled="" class="flex flex-col ...">
  <span>21:00</span>
  <span>-</span>
  <span>22:30</span>
</button>
```

### 判定方法
```javascript
// ボタンのdisabled属性で判定
const isAvailable = !button.disabled;

// または
const isAvailable = button.getAttribute('disabled') === null;
```

---

## 重要なセレクタ

| 要素 | セレクタ |
|------|---------|
| 予約ボタン | `button.w-[144px]` |
| モーダル | `div` containing "日時を選ぶ" |
| 時間帯ボタン | `button.flex.flex-col` または `button[class*="flex-col"]` |
| 空き判定 | `button:not([disabled])` |
| 埋まり判定 | `button[disabled]` |

---

## 注意事項

1. **プランの順序**: ページ上の表示順序は固定ではないため、プラン名でマッチング
2. **午前/午後の区別**: プラン名の先頭20文字でマッチング（短いと誤判定の可能性）
3. **モーダルのクリーンアップ**: 次のプランを開く前に既存モーダルを削除
4. **disabled属性の反映タイミング**: Reactの場合、DOMへの反映に若干の遅延あり
5. **ナイトパック**: 日をまたぐため、表示日の翌日の予約となる

---

## デバッグ用コード

```javascript
// 全時間帯ボタンの状態を確認
const buttons = document.querySelectorAll('button[class*="flex-col"]');
buttons.forEach((btn, i) => {
  const text = btn.innerText.replace(/\n/g, ' ');
  console.log(`[${i}] disabled=${btn.disabled} text="${text}"`);
});
```
