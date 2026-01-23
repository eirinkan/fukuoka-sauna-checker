#!/usr/bin/env node
/**
 * デイリーヘルスチェックスクリプト
 * 本番APIから空き状況を取得し、問題があればChatworkに通知
 *
 * 使用方法:
 *   node scripts/daily-check.js
 *
 * 環境変数:
 *   CHATWORK_API_TOKEN - ChatworkのAPIトークン
 *   CHATWORK_ROOM_ID - 通知先のルームID
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const PRODUCTION_URL = 'https://private-sauna-availability-526007709848.asia-northeast1.run.app';

// Chatwork設定
const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN || 'bc9f6cb17aba84d7f01c4c2d5cfbd487';
const CHATWORK_ROOM_ID = process.env.CHATWORK_ROOM_ID || '513598';

/**
 * Chatworkにメッセージを送信
 */
async function sendChatworkMessage(message) {
  try {
    const response = await fetch(
      `https://api.chatwork.com/v2/rooms/${CHATWORK_ROOM_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'X-ChatWorkToken': CHATWORK_API_TOKEN,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `body=${encodeURIComponent(message)}`
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Chatwork] 送信エラー:', response.status, errorText);
      return false;
    }

    console.log('[Chatwork] 送信成功');
    return true;
  } catch (error) {
    console.error('[Chatwork] 送信エラー:', error.message);
    return false;
  }
}

/**
 * 本番APIから空き状況を取得
 */
async function fetchAvailability(date) {
  const url = `${PRODUCTION_URL}/api/availability?date=${date}`;
  console.log(`[API] ${url} を取得中...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}

/**
 * ヘルスチェックを実行
 */
async function runHealthCheck() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const timeStr = today.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

  console.log(`\n========================================`);
  console.log(`デイリーヘルスチェック: ${timeStr}`);
  console.log(`========================================\n`);

  const results = {
    date: dateStr,
    timestamp: timeStr,
    facilities: [],
    hasError: false,
    hasWarning: false,
    errors: [],
    warnings: []
  };

  try {
    const data = await fetchAvailability(dateStr);

    // 各施設をチェック
    for (const facility of data.facilities) {
      const totalSlots = facility.rooms.reduce((sum, room) => sum + room.availableSlots.length, 0);
      const roomCount = facility.rooms.length;

      const facilityResult = {
        name: facility.name,
        totalSlots,
        roomCount,
        status: 'ok'
      };

      // エラー判定
      if (roomCount === 0) {
        facilityResult.status = 'error';
        results.hasError = true;
        results.errors.push(`${facility.name}: 部屋データが0件`);
      } else if (facility.error) {
        facilityResult.status = 'error';
        results.hasError = true;
        results.errors.push(`${facility.name}: ${facility.error}`);
      }

      // 警告判定（空き枠が極端に少ない）
      if (totalSlots === 0 && !facilityResult.status === 'error') {
        facilityResult.status = 'warning';
        results.hasWarning = true;
        results.warnings.push(`${facility.name}: 空き枠が0件（予約で埋まっている可能性あり）`);
      }

      results.facilities.push(facilityResult);

      // コンソール出力
      const statusIcon = facilityResult.status === 'ok' ? '✓' : facilityResult.status === 'warning' ? '!' : '✗';
      console.log(`[${statusIcon}] ${facility.name}: ${totalSlots}枠 (${roomCount}部屋)`);
    }

    console.log(`\n----------------------------------------`);
    console.log(`総施設数: ${results.facilities.length}`);
    console.log(`エラー: ${results.errors.length}件`);
    console.log(`警告: ${results.warnings.length}件`);
    console.log(`----------------------------------------\n`);

  } catch (error) {
    results.hasError = true;
    results.errors.push(`API取得エラー: ${error.message}`);
    console.error(`[エラー] API取得失敗: ${error.message}`);
  }

  // Chatwork通知
  if (results.hasError) {
    const message = buildErrorMessage(results);
    await sendChatworkMessage(message);
  } else {
    console.log('[通知] エラーなし - Chatwork通知はスキップ');

    // 正常でも通知したい場合はこちらを有効化
    // const message = buildOkMessage(results);
    // await sendChatworkMessage(message);
  }

  return results;
}

/**
 * エラー通知メッセージを構築
 */
function buildErrorMessage(results) {
  let message = `[info][title]【サウナ空き状況チェッカー】[警告] デイリーチェックでエラー検出[/title]`;
  message += `${results.date} のデータ取得で問題を検出しました。\n\n`;

  if (results.errors.length > 0) {
    message += `【エラー】\n`;
    for (const error of results.errors) {
      message += `・${error}\n`;
    }
  }

  if (results.warnings.length > 0) {
    message += `\n【警告】\n`;
    for (const warning of results.warnings) {
      message += `・${warning}\n`;
    }
  }

  message += `\n${results.timestamp}[/info]`;
  return message;
}

/**
 * 正常通知メッセージを構築
 */
function buildOkMessage(results) {
  const totalSlots = results.facilities.reduce((sum, f) => sum + f.totalSlots, 0);

  let message = `[info][title]【サウナ空き状況チェッカー】[ok] デイリーチェック正常[/title]`;
  message += `${results.date} のデータ取得は正常です。\n\n`;
  message += `・施設数: ${results.facilities.length}\n`;
  message += `・総空き枠数: ${totalSlots}\n`;
  message += `\n${results.timestamp}[/info]`;
  return message;
}

// メイン実行
runHealthCheck()
  .then(results => {
    process.exit(results.hasError ? 1 : 0);
  })
  .catch(error => {
    console.error('予期しないエラー:', error);
    process.exit(1);
  });
