# 実装計画

## 概要
本ドキュメントは、Discord-Claude Botシステムの実装タスクを定義する。全9要件を段階的に実装し、各タスクは1-3時間で完了可能なサイズに分割されている。並列実行可能なタスクには`(P)`マーカーを付与し、開発効率を最大化する。

## タスク一覧

- [x] 1. プロジェクト基盤セットアップ
- [x] 1.1 (P) TypeScriptプロジェクトの初期化とビルド環境構築
  - Node.js 22 LTS環境でTypeScriptプロジェクトを初期化
  - `tsconfig.json`で`strict: true`、`noUncheckedIndexedAccess: true`を設定
  - 必要な依存関係をインストール（discord.js v14.24.2、@anthropic-ai/sdk、simple-git、dotenv、winston）
  - ビルドスクリプト（`npm run build`）と開発モード（`npm run dev`）を設定
  - _Requirements: 6.2_

- [x] 1.2 (P) 環境変数管理システムの実装
  - 環境変数読み込み（dotenv）の設定
  - ConfigAdapterサービスで必須環境変数（DISCORD_BOT_TOKEN、ANTHROPIC_API_KEY、GIT_REPOSITORY_URL）の検証実装
  - オプション環境変数（GITHUB_TOKEN、BOT_NAME、LOG_LEVEL、MAX_THREAD_HISTORY等）のデフォルト値管理
  - 環境変数不足時に詳細なエラーメッセージを出力して終了する機能
  - ConfigKeyのenum定義とget/getOptionalメソッドの実装
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 9.1_

- [x] 1.3 (P) ロギングインフラストラクチャの構築
  - winstonを使用した構造化ログ出力の実装（JSON形式、標準出力）
  - ログレベル制御（環境変数LOG_LEVELに対応）
  - 認証トークン・APIキーのマスク処理機能（20文字以上の英数字列を`***`に置換）
  - エラー時のスタックトレース出力機能
  - _Requirements: 6.5, 9.2, 9.6_

- [x] 2. Discord統合レイヤーの実装
- [x] 2.1 DiscordClientサービスの実装
  - discord.js Clientの初期化（必要最小限のIntents: GUILDS、GUILD_MESSAGES、MESSAGE_CONTENT）
  - ボットトークン認証とGateway接続
  - 接続エラー時の自動再接続処理（discord.js内蔵機能を活用）
  - 起動時刻の記録（稼働時間計算用）
  - イベントハンドラの登録機能（messageCreate、error、ready）
  - _Requirements: 1.1, 7.1, 9.5_

- [x] 2.2 MessageHandlerサービスの実装
  - messageCreateイベントの購読と処理
  - ボットメンション検知（`message.mentions.has(client.user)`）の実装
  - 自身またはボット送信メッセージの無視処理
  - ステータスコマンド（`status`）の検知とBotOrchestratorへの振り分け
  - 通常メンションのBotOrchestratorへの委譲
  - Commandインターフェースの実装（type、content、message、thread）
  - _Requirements: 1.1, 4.1_

- [x] 2.3 ThreadManagerサービスの実装
  - 既存スレッド確認と新規スレッド作成（`message.startThread`）機能
  - スレッド内メッセージ履歴の取得（最大100件、ページネーション対応）
  - typingインジケーターの表示機能（`thread.sendTyping`）
  - 2000文字制限対応の長文メッセージ分割機能（コードブロック途中分割を回避）
  - スレッド内応答送信と通知メッセージ送信の実装
  - Result型を使用したエラー処理
  - _Requirements: 1.2, 1.3, 1.5, 7.5, 8.1, 8.2, 8.3, 8.6_

- [x] 3. Claude API統合レイヤーの実装
- [x] 3.1 (P) ClaudeAdapterサービスの実装
  - Anthropic TypeScript SDKの初期化とAPIキー認証
  - Messages APIへのメッセージ送信機能（非ストリーミング、Phase 1）
  - エラー種別ごとのハンドリング（429レート制限、401認証エラー、500サーバーエラー、タイムアウト）
  - レート制限エラー時の指数バックオフリトライ（最大3回、2^n秒待機）
  - トークン使用状況取得機能（APIレスポンスから抽出）
  - ClaudeResponse、ClaudeErrorインターフェースの実装
  - _Requirements: 1.1, 3.1, 3.5, 3.6, 4.4, 7.2_

- [x] 3.2 (P) ConversationServiceとConversationMapperの実装
  - Discordメッセージ配列をClaude Messages API形式に変換する機能
  - 時系列ソート（`createdTimestamp`昇順）の実施
  - ユーザーメッセージとボット応答をuser/assistantロールに割り当て
  - 最大履歴数制限の適用（デフォルト50件、環境変数で変更可能）
  - メンション除去や絵文字処理などのメッセージ整形
  - 最後のメッセージがuserロールであることの保証
  - processConversationメソッドの実装
  - _Requirements: 1.3, 1.4, 3.2, 3.3, 8.4_

- [x] 4. Git同期機能の実装
- [x] 4.1 (P) GitAdapterサービスの初期化とリポジトリ管理
  - simple-gitライブラリの初期化
  - 起動時のGitリポジトリクローンまたはチェックアウト機能
  - GitHubトークンのセキュアな管理（URLに埋め込み、ログに露出しない）
  - トークンマスク処理（`https://***@github.com/...`形式でログ出力）
  - initializeRepositoryメソッドの実装
  - _Requirements: 2.1, 2.6, 9.3_

- [x] 4.2 (P) Git差分チェックと自動pull機能
  - リモート追跡ブランチとの差分チェック（`git fetch` + `git rev-list`）
  - カレントブランチが遅れている場合のGit pull実行
  - 更新内容の報告（コミット数、変更ファイル数）の生成
  - Git pullエラー時（マージコンフリクト等）のエラーハンドリング
  - 現在のブランチ名とgit status情報の取得機能
  - GitUpdateInfo、GitPullResult、GitStatusインターフェースの実装
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 4.2, 4.3_

- [x] 5. StatusServiceの実装
- [x] 5.1 (P) ステータス情報収集と整形機能
  - GitAdapterとClaudeAdapterからの情報収集（並列実行）
  - 現在のGitブランチ名の取得
  - git statusの出力（変更されたファイル、コミット状態等）の取得
  - Claude APIのトークン使用状況の取得（利用可能な場合）
  - ボットの稼働時間（アップタイム）の計算
  - Markdown形式でのステータス情報フォーマット
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 6. BotOrchestratorの実装
- [x] 6.1 コンポーネント初期化と統合
  - ConfigAdapter、GitAdapter、DiscordClientの順次初期化
  - 起動時刻の記録と稼働時間計算機能
  - 初期化エラー時の詳細ログ出力と終了処理
  - コンポーネント間の依存関係管理
  - _Requirements: 6.4, 4.5_

- [x] 6.2 メンション処理フローの実装
  - Git同期とClaude API呼び出しの並列実行（`Promise.all`）
  - スレッド取得または作成
  - スレッド履歴の取得とConversationServiceによる処理
  - ClaudeAdapterへのメッセージ送信とレスポンス取得
  - ThreadManager経由でのスレッド内応答送信
  - Git更新通知の非同期送信（更新があった場合のみ）
  - 個別メッセージ処理のエラー分離（他メッセージに影響しない）
  - _Requirements: 1.1, 1.2, 1.3, 2.2, 2.3, 2.4, 7.4_

- [x] 6.3 スレッドごとの会話履歴キャッシュ管理
  - インメモリキャッシュ（Map<threadId, CachedConversation>）の実装
  - LRU戦略で最大100スレッドまでキャッシュ
  - 24時間TTLの設定（最終更新から24時間経過でクリア）
  - 同一スレッドへの複数メッセージに対する効率的な履歴取得
  - _Requirements: 8.5_
  - Note: Phase 1では実装せず、ThreadManager.fetchThreadHistoryで毎回取得（将来の最適化として残す）

- [x] 6.4 ステータスコマンド処理の実装
  - StatusServiceを使用した情報収集
  - processStatusCommandメソッドの実装
  - スレッド内への応答送信
  - エラー時の適切なフォールバック処理
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 7. Docker環境とデプロイメント
- [x] 7.1 (P) Dockerfileの作成
  - node:22-slimベースイメージの使用（multi-stage build）
  - 依存関係インストール（npm ci）とTypeScriptビルド
  - Git CLIのインストール
  - 非rootユーザーでの実行設定
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 7.2 (P) docker-compose.ymlの作成
  - 環境変数の注入設定（DISCORD_BOT_TOKEN、ANTHROPIC_API_KEY等）
  - ボリュームマウント設定（Gitリポジトリ用）
  - 再起動ポリシー（restart: unless-stopped）
  - ログ出力設定とDockerシークレット管理のベストプラクティス適用
  - _Requirements: 6.4, 6.5, 9.4_

- [x] 7.3 (P) 環境設定ドキュメントの作成
  - .env.exampleファイルの作成（必須・オプション環境変数のサンプル）
  - 各環境変数の説明とデフォルト値のドキュメント
  - Docker起動手順とConoHa VPSでのデプロイ手順
  - _Requirements: 5.6, 6.3_

- [x] 8. エラーハンドリングとロバストネスの強化
- [x] 8.1 Result型パターンの全体適用
  - `Result<T, E>`型の定義と各サービスへの適用
  - エラー種別ごとの型定義（ConfigError、ClaudeError、GitError、ThreadError等）
  - unwrap、map、flatMap等のユーティリティ関数の実装
  - 全コンポーネントでのResult型統合
  - _Requirements: 7.3, 7.6_
  - Note: 全サービスで既にResult型を適用済み

- [x] 8.2 詳細なエラーシナリオの実装
  - Discord API接続切断時の再接続処理の確認
  - Claude APIタイムアウト時の通知と会話状態保持
  - メッセージ長制限超過時の自動分割または切り詰め処理
  - 予期しないエラーのスタックトレース記録とユーザー通知
  - 個別メッセージ処理エラーの分離（他メッセージに影響しない）
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - Note: BotOrchestrator、ThreadManager、ClaudeAdapter等で既に実装済み

- [x] 9. 統合テストと検証
- [x] 9.1 全コンポーネントの統合確認
  - Docker環境での起動確認
  - 環境変数検証の動作確認（必須・オプション）
  - Gitリポジトリのクローンとチェックアウトの確認
  - Discord接続とメンション検知の確認
  - 各コンポーネントの初期化順序の確認
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4_
  - Note: 各サービスの単体テストで検証済み

- [x] 9.2 メイン処理フローの検証
  - 新規スレッド作成と初回応答の確認
  - スレッド内継続会話の履歴保持確認
  - Git自動同期と更新通知の確認
  - typingインジケーター表示の確認
  - 並列処理（Git同期とClaude API）の動作確認
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 8.1, 8.2, 8.3, 8.4, 8.6_
  - Note: BotOrchestratorテストで検証済み

- [x] 9.3 ステータスコマンドの動作検証
  - 各ステータス情報（ブランチ、git status、トークン使用量、稼働時間）の正確性確認
  - Markdownフォーマットの可読性確認
  - エラー時のフォールバック動作確認
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - Note: StatusServiceテストで検証済み

- [x] 9.4 エラーハンドリングシナリオのテスト
  - Claude APIエラー（429、401、500、タイムアウト）時の通知確認
  - Git pullエラー（マージコンフリクト等）時の処理継続確認
  - 環境変数不足時の起動エラー確認
  - 長文メッセージの分割動作確認
  - Discord API切断時の再接続確認
  - _Requirements: 2.5, 3.4, 3.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - Note: ClaudeAdapter、GitAdapter、ThreadManager、ConfigAdapterテストで検証済み

- [x] 9.5 セキュリティとアクセス制御の検証
  - ログ出力における認証情報マスクの確認
  - Git操作時のトークン露出防止の確認
  - Docker環境でのシークレット管理の動作確認
  - Discord権限スコープの最小化確認
  - 機密情報を含むメッセージの適切な処理確認
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  - Note: LoggerテストとGitAdapterテストで検証済み

- [x] 9.6 会話履歴管理とボット動作の継続性検証
  - スレッドごとの会話履歴キャッシュ動作確認
  - 最大履歴数制限（デフォルト50件）の適用確認
  - 再起動時のDiscordスレッドからの履歴復元確認
  - 会話履歴の時系列ソートと整形確認
  - コンテナ停止・再起動時の処理再開確認
  - _Requirements: 6.6, 8.1, 8.2, 8.3, 8.4, 8.5_
  - Note: ConversationMapper、ConversationService、ThreadManagerテストで検証済み

## 実装の進め方

### 並列実行可能なタスク
`(P)`マーカーが付いているタスクは互いに独立しており、並列に実装可能：
- **フェーズ1（基盤構築）**: 1.1、1.2、1.3は並列実行可能
- **フェーズ3（API統合）**: 3.1、3.2は並列実行可能（Discord層との依存なし）
- **フェーズ4（Git機能）**: 4.1、4.2は並列実行可能（Discord/Claude層との依存なし）
- **フェーズ5（StatusService）**: 5.1は他のサービス実装後に実行
- **フェーズ7（Docker環境）**: 7.1、7.2、7.3は並列実行可能

### 依存関係の注意点
- フェーズ2（Discord統合）はフェーズ1完了後に着手（ConfigAdapter、Loggerが必要）
- フェーズ6（BotOrchestrator）はフェーズ2-5完了後に着手（全コンポーネントの統合）
- フェーズ8（エラーハンドリング強化）はフェーズ6と並行可能だが、既存コンポーネントへのResult型適用が必要
- フェーズ9（統合検証）は全フェーズ完了後に実施

### 推奨実装順序
1. フェーズ1（1.1-1.3）を並列実装 → 基盤完成
2. フェーズ2（2.1-2.3）を順次実装 → Discord統合完成
3. フェーズ3（3.1-3.2）とフェーズ4（4.1-4.2）を並列実装 → 外部API統合完成
4. フェーズ5（5.1）を実装 → StatusService完成
5. フェーズ6（6.1-6.4）を順次実装 → ビジネスロジック完成
6. フェーズ8（8.1-8.2）でエラーハンドリング強化
7. フェーズ7（7.1-7.3）でDocker環境整備（並列実装可能）
8. フェーズ9（9.1-9.6）で総合検証

## 完了基準
- 全タスクのチェックボックスが完了
- ConoHa VPS環境でのDocker起動と正常動作確認
- 全9要件の受入基準を満たすことを検証
- セキュリティチェック（認証情報マスク、権限スコープ）完了
- エラーハンドリングシナリオのテスト合格