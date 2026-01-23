/**
 * 通知機能
 * スクレイピング故障時にChatwork通知を送信
 */

// 設定（環境変数から読み込み）
function getConfig() {
  return {
    enabled: process.env.NOTIFICATION_ENABLED === 'true',
    chatwork: {
      apiToken: process.env.CHATWORK_API_TOKEN,
      roomId: process.env.CHATWORK_ROOM_ID
    }
  };
}

/**
 * Chatworkにメッセージを送信
 * @param {string} message - 送信するメッセージ
 * @returns {Promise<boolean>} 送信成功かどうか
 */
async function sendChatworkMessage(message) {
  const config = getConfig();

  if (!config.enabled) {
    console.log('[通知] 通知が無効化されています');
    return false;
  }

  if (!config.chatwork.apiToken) {
    console.error('[通知] CHATWORK_API_TOKENが設定されていません');
    return false;
  }

  if (!config.chatwork.roomId) {
    console.error('[通知] CHATWORK_ROOM_IDが設定されていません');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.chatwork.com/v2/rooms/${config.chatwork.roomId}/messages`,
      {
        method: 'POST',
        headers: {
          'X-ChatWorkToken': config.chatwork.apiToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `body=${encodeURIComponent(message)}`
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[通知] Chatwork送信エラー:', response.status, errorText);
      return false;
    }

    console.log('[通知] Chatwork送信成功');
    return true;
  } catch (error) {
    console.error('[通知] Chatwork送信エラー:', error.message);
    return false;
  }
}

/**
 * 通知を送信
 * @param {Object} notification - 通知内容
 * @returns {Promise<boolean>} 送信成功かどうか
 */
async function sendNotification(notification) {
  // タイトルの決定
  let title = '【サウナ空き状況チェッカー】';
  switch (notification.type) {
    case 'consecutive_failures':
      title += '[警告] スクレイピング連続失敗';
      break;
    case 'ai_fallback':
      title += '[info] AI Visionフォールバック';
      break;
    case 'recovery':
      title += '[ok] スクレイピング復旧';
      break;
    case 'daily_check_error':
      title += '[警告] デイリーチェックでエラー検出';
      break;
    case 'daily_check_ok':
      title += '[ok] デイリーチェック正常';
      break;
    default:
      title += '通知';
  }

  // メッセージ本文の作成
  let body = `[info][title]${title}[/title]`;
  body += notification.message;

  if (notification.details) {
    body += '\n\n';
    for (const [key, value] of Object.entries(notification.details)) {
      body += `・${key}: ${value}\n`;
    }
  }

  body += `\n${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}[/info]`;

  return await sendChatworkMessage(body);
}

/**
 * 連続失敗アラートを送信
 * @param {string} siteName - サイト名
 * @param {number} failureCount - 連続失敗回数
 * @param {string} lastError - 最後のエラーメッセージ
 */
async function sendFailureAlert(siteName, failureCount, lastError) {
  await sendNotification({
    type: 'consecutive_failures',
    message: `${siteName} のスクレイピングが ${failureCount} 回連続で失敗しています。\nサイト構造が変更された可能性があります。`,
    details: {
      サイト名: siteName,
      連続失敗回数: failureCount,
      エラー: lastError || '不明'
    }
  });
}

/**
 * AI Visionフォールバック通知を送信
 * @param {string} siteName - サイト名
 * @param {number} slots - 取得した空き枠数
 */
async function sendFallbackNotification(siteName, slots) {
  await sendNotification({
    type: 'ai_fallback',
    message: `${siteName} のDOM解析に失敗し、AI Vision（Gemini）にフォールバックしました。\nデータは正常に取得できましたが、サイト構造が変更された可能性があります。`,
    details: {
      サイト名: siteName,
      フォールバック方式: 'Gemini Vision API',
      取得した空き枠数: slots
    }
  });
}

/**
 * 復旧通知を送信
 * @param {string} siteName - サイト名
 */
async function sendRecoveryNotification(siteName) {
  await sendNotification({
    type: 'recovery',
    message: `${siteName} のスクレイピングが復旧しました。`,
    details: {
      サイト名: siteName,
      ステータス: '正常'
    }
  });
}

/**
 * デイリーサマリーを送信
 * @param {Object} summary - ヘルスサマリー
 */
async function sendDailySummary(summary) {
  if (!summary.unhealthySites.length) {
    return;
  }

  let message = `本日のスクレイピングヘルスサマリー\n\n`;
  message += `正常サイト数: ${summary.healthySites}/${summary.totalSites}\n`;

  if (summary.unhealthySites.length > 0) {
    message += '\n【異常検知サイト】\n';
    for (const site of summary.unhealthySites) {
      message += `・${site.name}: 連続失敗 ${site.consecutiveFailures} 回\n`;
    }
  }

  await sendNotification({
    type: 'daily_summary',
    message,
    details: {
      総サイト数: summary.totalSites,
      正常サイト数: summary.healthySites,
      異常サイト数: summary.unhealthySites.length
    }
  });
}

/**
 * テスト用: Chatwork接続テスト
 */
async function testConnection() {
  const config = getConfig();

  if (!config.chatwork.apiToken || !config.chatwork.roomId) {
    console.log('[テスト] Chatwork設定がありません');
    return false;
  }

  return await sendChatworkMessage('[info][title]テスト通知[/title]サウナ空き状況チェッカーからのテスト通知です。[/info]');
}

module.exports = {
  sendNotification,
  sendFailureAlert,
  sendFallbackNotification,
  sendRecoveryNotification,
  sendDailySummary,
  testConnection,
  getConfig
};
