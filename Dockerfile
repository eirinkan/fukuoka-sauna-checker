FROM ghcr.io/puppeteer/puppeteer:24.1.1

# rootユーザーでセットアップ
USER root

# 日本語フォントをインストール
RUN apt-get update && apt-get install -y \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 作業ディレクトリを作成し権限を設定
RUN mkdir -p /app/data && chown -R pptruser:pptruser /app

WORKDIR /app

# 依存関係ファイルをコピーしてインストール
COPY --chown=pptruser:pptruser package*.json ./
RUN npm ci --only=production

# アプリケーションをコピー
COPY --chown=pptruser:pptruser . .

# pptruser に切り替え
USER pptruser

# Cloud RunはPORT環境変数を使用
ENV PORT=8080
EXPOSE 8080

# 起動コマンド
CMD ["npm", "start"]
