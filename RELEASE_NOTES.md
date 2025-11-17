# Release Notes - v1.0.0

## 🎉 初回リリース

Discord Claude CLI Botの初回リリースです。このボットは、Discord上でClaudeと自然に対話できる環境を提供します。

## ✨ 主な機能

### Discord統合
- **@メンション対応**: DiscordチャンネルでボットにメンションすることでClaudeとの対話を開始
- **スレッド管理**: 会話ごとに自動的にスレッドを作成し、履歴を保持
- **継続的な対話**: スレッド内では@メンション不要で会話を継続可能
- **ステータス確認**: `@ClaudeBot status` コマンドでボットの稼働状況を確認

### Claude統合
- **Claude Code CLI統合**: 最新のClaude APIを活用した高品質な応答
- **複数の認証方式**:
  - OAuth Token（推奨）: Claude Pro/Max契約者向け
  - API Key: 従量課金での利用

### Git同期機能
- **自動同期**: 新しいスレッド作成時にGitリポジトリを自動同期
- **変更通知**: リポジトリに更新がある場合は通知
- **プライベートリポジトリ対応**: GitHubトークンによる認証サポート

### ロギング
- **構造化ログ**: Winstonを使用した高品質なログ出力
- **自動ローテーション**: 日次ローテーション、7日間保持
- **機密情報マスキング**: APIキーやトークンを自動的にマスク

### デプロイメント
- **Docker対応**: Docker/Podman両対応のコンテナ化
- **柔軟なデプロイ先**: ローカル、クラウド、VPS、PaaSなど多様な環境に対応
- **簡単セットアップ**: docker-composeまたはTaskfile経由で1コマンド起動
- **環境変数管理**: `.env.docker`ファイルによる簡単な設定

## 🏗️ アーキテクチャ

### クリーンアーキテクチャ採用
- **Adapters層**: 外部サービス（Discord、Claude、Git、Config）との統合
- **Services層**: ビジネスロジック（会話管理、ステータス、オーケストレーション）
- **Infrastructure層**: 横断的関心事（ロギング）
- **型安全性**: TypeScript 5.xによる完全な型定義

### 主要コンポーネント
- **BotOrchestrator**: 全体の制御とコンポーネント間の調整
- **MessageHandler**: Discordメッセージの処理
- **ThreadManager**: スレッド管理とメッセージ履歴の取得
- **ConversationService**: Claude APIとの対話管理
- **GitAdapter**: リポジトリ同期機能
- **Logger**: 構造化ログとマスキング

## 📦 技術スタック

- **Runtime**: Node.js 22 LTS
- **Language**: TypeScript 5.x
- **Discord**: discord.js v14.24
- **Claude**: @anthropic-ai/sdk v0.69
- **Git**: simple-git v3.30
- **Logging**: Winston v3.18
- **Testing**: Jest v30.2
- **Container**: Docker/Podman対応
- **Task Runner**: Taskfile (go-task)

## 🚀 デプロイ方法

### 最小限のセットアップ

1. **トークンの取得**
   ```bash
   # Claude OAuth Token
   npm install -g @anthropic-ai/claude-code
   claude auth login
   claude setup-token

   # GitHub Token (プライベートリポジトリの場合)
   gh auth login
   gh auth token
   ```

2. **環境変数の設定**
   ```bash
   cp .env.docker.example .env.docker
   # .env.dockerを編集してトークンを設定
   ```

3. **起動**
   ```bash
   # Podman + Task
   task dev:build

   # Docker Compose
   docker-compose up -d
   ```

詳細なセットアップ手順は[README.md](./README.md)を参照してください。

## 📋 対応環境

### デプロイ環境
- ✅ ローカル環境（macOS/Linux/Windows+WSL2）
- ✅ クラウド（AWS ECS/Fargate、GCP Cloud Run、Azure Container Instances）
- ✅ VPS（ConoHa、さくらのVPS、任意のDocker対応VPS）
- ✅ PaaS（Railway、Render、Fly.io）

### 認証方式
- ✅ Discord Bot Token
- ✅ Claude OAuth Token（推奨）
- ✅ Anthropic API Key（代替）
- ✅ GitHub Personal Access Token（プライベートリポジトリ用）

## 🧪 テストカバレッジ

主要なコンポーネントにユニットテストを実装:
- MessageHandler
- ThreadManager
- ConversationService
- ConversationMapper
- ClaudeAdapter
- GitAdapter
- ConfigAdapter
- Logger
- StatusService
- BotOrchestrator
- DiscordClient

## 📚 ドキュメント

### セットアップガイド
- [README.md](./README.md) - 完全なセットアップ手順

### デプロイメント
- [ConoHa VPSへのデプロイ](https://gist.github.com/hummer98/6ec47882f6be7d256947f5c9766a150c) - 詳細なVPSデプロイガイド (Gist)

## 🔒 セキュリティ

- ✅ 環境変数による機密情報管理
- ✅ ログ出力時の自動マスキング
- ✅ `.gitignore`による機密ファイルの除外
- ✅ Docker Secretsサポート（計画中）

## 🐛 既知の問題

現時点で既知の問題はありません。

## 🙏 謝辞

このプロジェクトは以下の技術を活用しています:
- Anthropic Claude API
- Discord.js
- Winston
- Simple-git

## 📄 ライセンス

MIT License

## 🔗 リンク

- [GitHub Repository](https://github.com/yourusername/discord-claude-cli-bot)
- [Issue Tracker](https://github.com/yourusername/discord-claude-cli-bot/issues)
- [Discord Developer Portal](https://discord.com/developers/docs)
- [Anthropic Documentation](https://docs.anthropic.com/)

---

**Full Changelog**: 初回リリース

🤖 Generated with Claude Code
