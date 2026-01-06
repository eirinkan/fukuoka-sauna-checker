FROM ghcr.io/puppeteer/puppeteer:24.1.1

# 日本語フォントをインストール
USER root
RUN apt-get update && apt-get install -y \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# pptruser（Puppeteer公式イメージのデフォルトユーザー）に戻す
USER pptruser

WORKDIR /app

# 依存関係をインストール
COPY package*.json ./
RUN npm ci --only=production

# アプリケーションをコピー
COPY . .

# データディレクトリを作成
RUN mkdir -p /app/data

# Cloud RunはPORT環境変数を使用
ENV PORT=8080
EXPOSE 8080

# 起動コマンド
CMD ["npm", "start"]
