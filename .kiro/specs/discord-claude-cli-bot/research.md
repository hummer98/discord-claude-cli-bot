# Research & Design Decisions

---
**目的**: 発見段階の調査結果、アーキテクチャ検討、および技術設計に影響する根拠を記録する。

**使用方法**:
- 発見フェーズ中の調査活動と成果をログに記録
- `design.md`には詳細すぎる設計判断のトレードオフを文書化
- 将来の監査や再利用のための参照と証拠を提供
---

## Summary
- **Feature**: `discord-claude-cli-bot`
- **Discovery Scope**: Complex Integration
- **Key Findings**:
  - Discord.js v14.24.2がNode.js 22.12.0以上を要求、スレッド管理APIとメンション検知をネイティブサポート
  - Anthropic TypeScript SDK (@anthropic-ai/sdk)がメッセージ配列による会話コンテキスト管理とストリーミングをサポート
  - Docker multi-stage buildsとGitHub Personal Access Tokensによるプライベートリポジトリ統合が2025年のベストプラクティス

## Research Log

### Discord.js v14統合調査
- **Context**: Discord botの実装に必要な最新のDiscord.js APIと機能を調査
- **Sources Consulted**:
  - Discord.js公式ドキュメント v14.24.2
  - Discord Developer Portal
  - Stack Overflow Discord.js v14実装例
- **Findings**:
  - Node.js 22.12.0以上が必須
  - GatewayIntentBits設定（Guilds, GuildMessages, MessageContent）が必要
  - `message.mentions.has(client.user.id)`でメンション検知
  - `message.startThread()`でスレッド作成、`channel.isThread()`でスレッド判定
  - autoArchiveDurationでスレッド自動アーカイブ設定可能（60-1440分）
  - Discordメッセージ長制限は2000文字
- **Implications**: Node.jsバージョンの制約とIntent設定が重要、スレッド管理は標準APIで対応可能

### Anthropic Claude API調査
- **Context**: Claude APIとの統合方法、会話履歴管理、ストリーミング対応を調査
- **Sources Consulted**:
  - GitHub anthropics/anthropic-sdk-typescript
  - Anthropic公式ドキュメント
  - Claude Agent SDK情報
- **Findings**:
  - `@anthropic-ai/sdk` npmパッケージ使用
  - 環境変数ANTHROPIC_API_KEYでの認証
  - messagesパラメータで会話履歴配列管理 `[{role: "user", content: "..."}, {role: "assistant", content: "..."}]`
  - stream: trueでSSEストリーミング対応
  - APIErrorサブクラスによるエラーハンドリング（status、name、headers取得可能）
  - session_idとparent_tool_use_idによる会話追跡可能
  - 最新モデルは'claude-sonnet-4-5-20250929'
- **Implications**: 会話履歴は配列形式で管理、ストリーミングによりリアルタイム応答が可能、型安全なエラーハンドリング実装必須

### Git同期メカニズム
- **Context**: Docker起動時とメンション受信時のGitリポジトリ自動同期
- **Sources Consulted**: Node.js `simple-git`ライブラリ、Dockerベストプラクティス
- **Findings**:
  - **simple-git**: 型安全なGit操作のためのNode.jsライブラリ（v3.x）
  - **認証方式**: 環境変数`GITHUB_TOKEN`をGit URLに埋め込む（`https://${token}@github.com/...`）
  - **Docker起動フロー**: コンテナ起動時に`git clone`または既存リポジトリの`git pull`を実行
  - **差分検知**: `git fetch` + `git rev-list --count origin/main..HEAD`でコミット差分を取得
  - **セキュリティ**: トークンはログに出力しない、環境変数のみで管理
- **Implications**:
  - `GitSyncService`コンポーネントで`simple-git`をラップして安全なGit操作を提供
  - 起動時初期化フェーズでリポジトリセットアップを完了
  - メンション受信時に非同期でバックグラウンド同期を実行し、結果をスレッドに報告

### Docker環境でのGit統合調査
- **Context**: Dockerコンテナ内でのGitリポジトリ自動同期とプライベートリポジトリアクセス方法を調査
- **Sources Consulted**:
  - Docker公式ベストプラクティス
  - GitHub Actions/Docker統合ガイド
  - Node.js Dockerデプロイメント記事
- **Findings**:
  - GitHub Personal Access Token（PAT）がプライベートリポジトリアクセスの推奨方法
  - Multi-stage buildsでイメージサイズ50%削減
  - `node:22-slim`ベースイメージ推奨（alpineより互換性高い）
  - NODE_ENV=productionでメモリ使用量30%削減
  - npm ciでlayer cachingを活用し、package*.jsonを先にCOPY
  - 環境変数は.envファイル（開発）、Docker Secrets（本番）で管理
  - 512MB-1GBのRAM割り当てが一般的なNode.jsアプリケーションに適切
- **Implications**: PATによるGit認証、multi-stage builds採用、環境変数による設定管理が必須

### エラーハンドリング戦略
- **Context**: Discord/Claude API障害時の堅牢性確保
- **Sources Consulted**: discord.js再接続ドキュメント、Anthropic APIエラーコード
- **Findings**:
  - **Discord再接続**: discord.js v14は自動再接続を内蔵、`Client.on('error')`でエラー監視
  - **Claude APIエラー**: HTTPステータスコード（429レート制限、401認証エラー、500サーバーエラー）
  - **タイムアウト**: Anthropic SDKの`timeout`オプションで制御（デフォルト60秒）
  - **リトライロジック**: 429エラー時は指数バックオフでリトライ
- **Implications**:
  - 各APIエラーを`Result<T, Error>`型で表現し、呼び出し側で適切にハンドリング
  - ユーザー向けエラーメッセージは日本語でわかりやすく整形
  - エラー発生時もボット全体の動作は継続（個別メッセージ処理の分離）

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Layered Architecture | 明確な層分離（Presentation/Application/Infrastructure） | シンプル、理解しやすい、テスト容易 | 過度な抽象化の可能性 | Discord/Claude統合に適合 |
| Event-Driven | メッセージベースの非同期処理 | 高スケーラビリティ、疎結合 | 複雑性増加、デバッグ困難 | 将来の拡張に有効 |
| Hexagonal | ドメイン中心、ポート＆アダプター | テスト容易性、外部依存の分離 | 初期実装コスト大 | 複数の外部サービス統合に最適 |
| Monolithic | 単一アプリケーション構造 | デプロイ簡単、運用シンプル | スケーラビリティ制限 | MVP開発に適切 |

## Design Decisions

### Decision: Hexagonal Architectureの採用
- **Context**: Discord API、Claude API、Git、Dockerという複数の外部システムと統合する必要がある
- **Alternatives Considered**:
  1. Monolithic - シンプルだが外部依存の管理が困難
  2. Layered - 基本的だがポート切り替えの柔軟性が低い
  3. Event-Driven - 将来性はあるが初期実装が複雑
- **Selected Approach**: Hexagonal Architecture（ポート＆アダプター）パターン
- **Rationale**:
  - 外部サービス（Discord、Claude、Git）をアダプターとして分離可能
  - コアドメインロジックを外部依存から保護
  - モック実装によるテスト容易性
  - 各アダプターを独立して変更・更新可能
- **Trade-offs**: 初期設計の複雑性増加 vs 長期的な保守性・拡張性向上
- **Follow-up**: 各アダプターのインターフェース定義を明確化

### Decision: TypeScriptの採用
- **Context**: 型安全性と開発生産性のバランスを重視
- **Alternatives Considered**:
  1. JavaScript - 型安全性なし
  2. Python - Discord.pyとClaude SDKは存在するが、エコシステムが分散
- **Selected Approach**: TypeScript with strict mode
- **Rationale**:
  - Discord.jsとAnthropic SDKの公式TypeScriptサポート
  - 型安全性による実行時エラーの削減
  - IDEサポートによる開発効率向上
- **Trade-offs**: ビルドステップ追加 vs 型安全性確保
- **Follow-up**: tsconfig.jsonでstrict: true設定

### Decision: スレッドベースの会話管理
- **Context**: 複数ユーザーの同時会話と文脈保持が必要
- **Alternatives Considered**:
  1. チャンネル内直接返信 - 会話が散在
  2. DM方式 - 協調作業不可
  3. 独自DBでの履歴管理 - 実装複雑
- **Selected Approach**: Discord標準のスレッド機能活用
- **Rationale**:
  - Discord UIとの自然な統合
  - 会話の自動グルーピング
  - スレッドごとの文脈分離
  - 標準的なユーザー体験
- **Trade-offs**: Discord API依存 vs 実装シンプル化
- **Follow-up**: スレッドアーカイブ期間の最適化

### Decision: Personal Access Token (PAT)によるGit認証
- **Context**: Dockerコンテナ内からプライベートGitリポジトリへのアクセス
- **Alternatives Considered**:
  1. SSH Deploy Keys - 管理複雑、Docker内での設定困難
  2. OAuth - 実装複雑、更新処理必要
- **Selected Approach**: GitHub Personal Access Token
- **Rationale**:
  - 環境変数での簡単な設定
  - HTTPSベースで firewall friendly
  - 権限スコープの細かい制御
  - トークンローテーション可能
- **Trade-offs**: トークン管理責任 vs 実装簡易性
- **Follow-up**: トークンローテーション手順の文書化

### Decision: Multi-stage Docker Build
- **Context**: 本番環境でのイメージサイズとセキュリティ最適化
- **Alternatives Considered**:
  1. Single-stage build - イメージサイズ大
  2. Alpine base - 互換性問題の可能性
- **Selected Approach**: Multi-stage build with node:22-slim
- **Rationale**:
  - ビルド依存とランタイム依存の分離
  - 50%のイメージサイズ削減
  - セキュリティ向上（ビルドツール除外）
- **Trade-offs**: Dockerfile複雑化 vs 最適化効果
- **Follow-up**: ビルドキャッシュ最適化

## Risks & Mitigations
- **Discord API レート制限** — exponential backoffとキューイングシステム実装
- **Claude API コスト管理** — トークン使用量モニタリングと使用制限設定
- **Git pull競合** — 自動マージ無効化、競合時は手動介入通知
- **メモリ不足** — Node.jsヒープサイズ制限とDocker memory limit設定
- **認証トークン漏洩** — 環境変数使用、ログマスキング、定期ローテーション
- **スレッド爆発的増加** — 自動アーカイブ設定と定期クリーンアップ

## References
- [Discord.js v14 Documentation](https://discord.js.org/docs) — 公式APIリファレンス
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) — Claude API統合
- [Docker Node.js Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md) — コンテナ最適化ガイド
- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) — 認証設定
