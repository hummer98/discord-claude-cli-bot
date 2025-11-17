# Claude Code CLI セットアップガイド

このドキュメントでは、Discord-Claude BotでClaude Code CLIを使用するためのセットアップ手順を説明します。

## 概要

このボットは**Claude Code CLI**をOAuthトークン方式で使用します:

1. 任意の環境で `claude setup-token` を実行
2. 生成されたトークンを環境変数 `CLAUDE_CODE_OAUTH_TOKEN` に設定
3. Docker起動時に自動認証

## 前提条件

- **Claude Pro または Max契約** (OAuth認証に必要)
- または **Anthropic APIキー** (従量課金の代替方式)
- Node.js 20+ (ローカルPCでのトークン生成用)

## セットアップ手順

### オプションA: OAuth Token (推奨、GitHub Actions方式)

#### ステップ1: Claude Code CLIのインストール

ローカルPC (Mac/Linux/Windows) で実行:

```bash
# Claude Code CLIをグローバルインストール
npm install -g @anthropic-ai/claude-code

# インストール確認
claude --version
```

#### ステップ2: OAuth認証

```bash
# ブラウザベースのOAuth認証を開始
claude auth login

# ブラウザが自動的に開きます
# Claude.ai にログイン (Claude Pro/Max アカウント)
# 認証を承認
```

成功すると、ローカルPCに認証情報が保存されます:
- macOS: `~/.claude/credentials.json` または Keychain
- Linux: `~/.claude/credentials.json`
- Windows: `%USERPROFILE%\.claude\credentials.json`

#### ステップ3: OAuth トークン生成

```bash
# 長期有効なOAuthトークンを生成
claude setup-token

# 出力例:
# Your setup token:
#
# CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
#
# Add this to your environment variables or CI/CD secrets.
```

**重要**: この `CLAUDE_CODE_OAUTH_TOKEN` をコピーしてください。

#### ステップ4: .env.dockerファイルに設定

プロジェクトルートの `.env.docker` ファイルを編集:

```bash
cd /path/to/discord-claude-cli-bot
cp .env.docker.example .env.docker
```

`.env.docker` を編集:

```bash
DISCORD_BOT_TOKEN=your_discord_bot_token_here
GIT_REPOSITORY_URL=https://github.com/your/repo.git

# OAuth認証（推奨）
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### ステップ5: Docker起動

```bash
# Podman + Task
task dev:build

# または Docker Compose
docker-compose up -d
```

#### ステップ6: 動作確認

```bash
# ログ確認
task logs:follow
# または
docker-compose logs -f

# 認証確認 (コンテナ内でCLI実行)
docker exec -it discord-claude-cli-bot claude --version
```

成功すれば以下のようなログが表示されます:

```
[INFO] Claude CLI ready { version: '1.0.56', authMethod: 'OAuth (CLAUDE_CODE_OAUTH_TOKEN)' }
```

---

### オプションB: API Key (従量課金)

Claude Pro契約がない場合の代替方式:

#### ステップ1: APIキー取得

1. [Anthropic Console](https://console.anthropic.com/) にアクセス
2. 「API Keys」セクションでキーを生成
3. `sk-ant-api03-...` で始まるキーをコピー

#### ステップ2: .env.dockerファイルに設定

```bash
DISCORD_BOT_TOKEN=your_discord_bot_token_here
GIT_REPOSITORY_URL=https://github.com/your/repo.git

# API Key認証 (従量課金)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### ステップ3: Docker起動

```bash
docker-compose up -d
```

**注意**: APIキー方式は従量課金です。Claude Pro契約の無料利用枠は使用されません。

---

## トラブルシューティング

### 認証エラー: "Claude CLI not authenticated"

**原因**: トークンが正しく設定されていない

**解決策**:

1. 環境変数を確認:
   ```bash
   docker-compose config | grep ANTHROPIC
   ```

2. トークンを再生成:
   ```bash
   # ローカルPCで
   claude setup-token
   ```

3. `.env.docker` ファイルを更新してDockerを再起動:
   ```bash
   task dev:rebuild
   ```

### トークン有効期限切れ

**症状**: 以前は動いていたが突然認証エラー

**原因**:
- Claude Pro/Max契約が終了
- トークンが手動で無効化された

**解決策**:

```bash
# ローカルPCで再認証
claude auth login

# 新しいトークンを生成
claude setup-token

# .env.dockerを更新してDocker再起動
```

### オンボーディングプロンプトが表示される

**症状**: Dockerコンテナ内で `claude` コマンドを実行すると対話プロンプトが表示

**原因**: `~/.claude.json` または `~/.claude/credentials.json` が不足

**解決策**: Dockerfileで既に対処済み。以下を確認:

```bash
# コンテナ内で確認
docker exec -it discord-claude-cli-bot ls -la /home/botuser/.claude*

# 出力例:
# -rw-r--r-- 1 botuser botuser  88 ... .claude.json
# -rw-r--r-- 1 botuser botuser  60 ... credentials.json
```

### 環境変数の優先順位

Claude CLIは以下の順序で認証を試みます:

```
1. ANTHROPIC_API_KEY (最優先)
   ↓ 設定されていない場合
2. ANTHROPIC_AUTH_TOKEN
   ↓ 設定されていない場合
3. ~/.claude/credentials.json
   ↓ 設定されていない場合
4. エラー: 認証が必要
```

**重要**: 両方設定した場合、`ANTHROPIC_API_KEY` が優先されます（従量課金に切り替わります）。

---

## GitHub Actionsとの比較

| 項目 | GitHub Actions | Discord Bot |
|------|----------------|-------------|
| トークン生成 | ローカルで `claude setup-token` | 同じ |
| 環境変数名 | `CLAUDE_CODE_OAUTH_TOKEN` | 同じ |
| 設定場所 | GitHub Secrets | `.env.docker` ファイル |
| Docker設定 | Actionが自動実行 | Dockerfileで設定 |
| 実行方式 | ワークフローで1回限り | 24/7稼働 |

---

## セキュリティベストプラクティス

### トークンの管理

```bash
# ✅ 良い例: .env.dockerファイル (gitignoreに追加済み)
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-xxxxx

# ❌ 悪い例: コードにハードコード
const token = "sk-ant-oat01-xxxxx"; // 絶対にやらない
```

### トークンのローテーション

定期的にトークンを再生成することを推奨:

```bash
# 30日ごとに実行
claude setup-token

# 新しいトークンを .env.docker に更新
# Docker再起動
task dev:rebuild
```

### ログのマスキング

トークンはログに自動的にマスクされます:

```
[INFO] Claude CLI ready { authMethod: 'OAuth (CLAUDE_CODE_OAUTH_TOKEN)' }
# トークンの値は表示されません
```

---

## 参考リンク

- [Claude Code CLI 公式ドキュメント](https://code.claude.com/docs)
- [GitHub Actions for Claude Code](https://github.com/anthropics/claude-code-action)
- [Anthropic API ドキュメント](https://docs.anthropic.com/)

---

## よくある質問 (FAQ)

### Q1: Claude Pro契約なしで使えますか？

**A**: はい。`ANTHROPIC_API_KEY` を使用した従量課金方式で利用できます。

### Q2: トークンの有効期限は？

**A**: `CLAUDE_CODE_OAUTH_TOKEN` はClaude Pro/Max契約期間中有効です。契約終了時は再生成が必要です。

### Q3: 複数のボットで同じトークンを使えますか？

**A**: はい。同じトークンを複数のDocker環境で使用できます（ただし利用規約を確認してください）。

### Q4: GitHub ActionsとDiscord Botで同じトークンを使えますか？

**A**: はい。`claude setup-token` で生成したトークンはどちらでも使用可能です。

### Q5: API使用量の確認方法は？

**OAuth Token**: Claude.aiのダッシュボードで確認
**API Key**: [Anthropic Console](https://console.anthropic.com/settings/usage) で確認

---

## サポート

問題が解決しない場合:

1. [GitHub Issues](https://github.com/yourusername/discord-claude-cli-bot/issues) で報告
2. [Claude Code GitHub Issues](https://github.com/anthropics/claude-code/issues) を検索
3. ログファイルを確認: `./volumes/logs/discord-bot-*.log`
