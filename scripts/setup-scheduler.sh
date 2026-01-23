#!/bin/bash
#
# デイリーチェックのスケジュール設定スクリプト
#
# 使用方法:
#   ./scripts/setup-scheduler.sh install   - スケジュールを登録
#   ./scripts/setup-scheduler.sh uninstall - スケジュールを解除
#   ./scripts/setup-scheduler.sh status    - 状態を確認
#   ./scripts/setup-scheduler.sh test      - 即時実行テスト
#

PLIST_NAME="com.sauna.daily-check"
PLIST_SRC="$(dirname "$0")/com.sauna.daily-check.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

case "$1" in
  install)
    echo "スケジュールを登録します..."

    # 既存のジョブをアンロード
    launchctl unload "$PLIST_DEST" 2>/dev/null

    # plistをコピー
    cp "$PLIST_SRC" "$PLIST_DEST"

    # ジョブをロード
    launchctl load "$PLIST_DEST"

    echo "✓ 登録完了"
    echo ""
    echo "スケジュール: 毎日 9:00"
    echo "ログ: ~/dev/サウナ/logs/daily-check.log"
    echo ""
    echo "状態確認: launchctl list | grep sauna"
    ;;

  uninstall)
    echo "スケジュールを解除します..."

    launchctl unload "$PLIST_DEST" 2>/dev/null
    rm -f "$PLIST_DEST"

    echo "✓ 解除完了"
    ;;

  status)
    echo "スケジュール状態:"
    launchctl list | grep -E "PID|$PLIST_NAME" | head -5
    echo ""

    if [ -f "$PLIST_DEST" ]; then
      echo "✓ plistがインストールされています"
    else
      echo "✗ plistがインストールされていません"
    fi

    echo ""
    echo "最新のログ (10行):"
    tail -10 "$HOME/dev/サウナ/logs/daily-check.log" 2>/dev/null || echo "(ログなし)"
    ;;

  test)
    echo "即時実行テスト..."
    echo ""
    cd "$(dirname "$0")/.."
    node scripts/daily-check.js
    ;;

  *)
    echo "使用方法: $0 {install|uninstall|status|test}"
    echo ""
    echo "  install   - スケジュールを登録 (毎日9:00)"
    echo "  uninstall - スケジュールを解除"
    echo "  status    - 状態を確認"
    echo "  test      - 即時実行テスト"
    exit 1
    ;;
esac
