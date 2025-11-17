# Requirements Document

## Project Description (Input)
以下の仕様のDiscord-botを作成してください。技術的疑問点はネットで調査してアーキテクチャを検討してください。

- **ローカルPC上のDockerで動作**（24時間稼働可能な環境を想定）
- Discordで @{botname} でreplyするとbotを呼び出し
- 起動時にgitのリポジトリをcheckout済であること
- bot呼び出し時にカレントブランチが遅れていたら自動的にpullしてリポート
- ユーザーからのメッセージをすべてClaude APIに中継
  - Anthropic SDKを使用してClaude APIと通信
  - 会話履歴を適切に管理してコンテキストを維持
- botからの返答は最初のメッセージのスレッドで返答する
  - スレッドの内容は常に会話履歴としてClaudeに渡されて欲しい

# コマンド
- 現在のステータス表示(git status, カレントブランチ, API使用状況)

# 設定可能な項目
- botname
- github repository url

# 設定可能な環境変数
- DISCORD_BOT_TOKEN: Discordボットトークン
- ANTHROPIC_API_KEY: Anthropic APIキー
- GITHUB_TOKEN: GitHubアクセストークン（プライベートリポジトリ用）

## 技術的解決策
- **Claude API統合**: Anthropic公式SDKを使用して会話履歴を管理
- **認証方式**: APIキー認証（環境変数で設定）
- **デプロイ環境**: ローカルPC上のDockerコンテナ
  - OAuth認証問題を回避（ローカル環境ではブラウザ認証可能だが、APIキー方式を推奨）
  - 24時間稼働可能な環境を前提
  - VPS不要でコスト削減

## イントロダクション
本仕様書は、DiscordとClaude AIを統合したボットシステムの要件を定義する。本システムは、Discordユーザーがボットに対してメンション（@botname）することでClaude AIとの対話を可能にし、スレッド形式で会話を継続できる。システムはDockerコンテナとして**ローカルPC上**で動作し、Gitリポジトリと連携してコードベースの最新状態を維持する。

本システムの主な目的は以下の通り：
- Discordプラットフォーム上でClaude AIへの自然な対話インターフェースを提供
- スレッド機能を活用した文脈を保持した会話の実現
- Gitリポジトリとの自動同期によるボット動作の最新化
- ローカルDocker環境による安定したデプロイメントと低コスト運用
- Discord BotはWebSocket接続（アウトバウンド）のみのため、外部公開不要

## Requirements

### Requirement 1: Discordボット基本機能
**目的:** Discord利用者として、ボットにメンションすることでClaude AIと対話したい。これにより、Discordを離れることなくAI支援を受けられる。

#### 受入基準
1. When ユーザーがメッセージ内でボットをメンション（@botname）した場合、the Discord Botはそのメッセージを検知してClaude APIへ中継すること
2. When ボットがメンションされたメッセージを受信した場合、the Discord Botは元のメッセージに対してスレッドを作成し、その中で応答すること
3. When スレッド内でユーザーがメッセージを送信した場合、the Discord Botはメンションの有無に関わらず全てのメッセージを処理対象とし、スレッド内の全ての会話履歴をClaude APIのコンテキストとして含めること（スレッド内はメンション不要）
4. The Discord Botはスレッド内の会話履歴を時系列順に保持し、各メッセージの送信者情報（ユーザー名）を含めること
5. When Claude APIから応答を受信した場合、the Discord Botは適切にフォーマットして（コードブロック、改行等を保持）スレッド内に投稿すること
6. The Discord Botはスレッド外（通常チャンネル）ではメンションされたメッセージのみを処理し、スレッド内では全てのユーザーメッセージ（ボット自身のメッセージを除く）を処理すること

### Requirement 2: Gitリポジトリ管理
**目的:** システム管理者として、ボットが常に最新のコードベースで動作することを保証したい。これにより、コード更新を手動でデプロイする手間を削減できる。

#### 受入基準
1. When Docker Botが起動する場合、the Discord Botは指定されたGitリポジトリをクローンまたはチェックアウト済みの状態であること
2. When 新しいスレッドが作成される場合（初回メンション時）、the Discord Botはカレントブランチのリモート追跡ブランチとの差分をチェックすること（スレッド開始時のみ）
3. If カレントブランチがリモートより遅れている場合、then the Discord BotはGit pullを実行してローカルブランチを更新すること
4. When Git pullが実行された場合、the Discord Botは更新内容（コミット数、変更ファイル数等）をスレッド内に報告すること
5. If Git pullが失敗した場合（マージコンフリクト等）、then the Discord Botはエラー内容をスレッド内に報告し、メッセージ処理は続行すること
6. The Discord Botは環境変数で指定されたGitHubアクセストークンを使用してプライベートリポジトリにアクセスできること
7. The Discord Botは既存スレッド内での継続的なメッセージに対してはGit同期チェックを実行しないこと（スレッド内の会話継続中は不要）

### Requirement 3: Claude API統合
**目的:** 開発者として、Discord経由で受信したメッセージをClaude APIに適切に中継し、応答を取得したい。これにより、ユーザーに高品質なAI応答を提供できる。

#### 受入基準
1. The Discord BotはAnthropic Claude APIに対して認証を行い、メッセージを送信できること
2. When ユーザーメッセージをClaude APIに送信する場合、the Discord Botはスレッド内の会話履歴を含む会話コンテキストを構築すること
3. The Discord Botは会話履歴を交互の役割（user/assistant）として構造化し、Claude APIの要求仕様に準拠すること
4. When Claude APIから応答を受信する場合、the Discord Botはストリーミング応答に対応し、長文応答を適切に処理すること
5. If Claude APIがエラーを返す場合（レート制限、認証エラー等）、then the Discord Botはユーザーに分かりやすいエラーメッセージをスレッド内に投稿すること
6. The Discord Botは環境変数で指定されたAnthropic APIキーを使用してClaude APIに認証すること

### Requirement 4: ステータス情報表示コマンド
**目的:** システム管理者として、ボットの現在の状態を確認したい。これにより、問題の早期発見やリソース管理が可能になる。

#### 受入基準
1. When ユーザーがステータスコマンド（例：`/status`または`@botname status`）を送信した場合、the Discord Botは現在のステータス情報を返信すること
2. The Discord Botのステータス情報には、現在のGitブランチ名が含まれること
3. The Discord Botのステータス情報には、`git status`の出力（変更されたファイル、コミット状態等）が含まれること
4. The Discord Botのステータス情報には、Claude APIのトークン使用状況または残量が含まれること（APIが提供する場合）
5. The Discord Botのステータス情報には、ボットの稼働時間（アップタイム）が含まれること
6. The Discord Botのステータス情報は読みやすい形式（Markdown形式等）でフォーマットされること

### Requirement 5: 設定管理
**目的:** システム管理者として、環境に応じてボットの動作を柔軟に設定したい。これにより、複数の環境や用途に対応できる。

#### 受入基準
1. The Discord Botは環境変数`DISCORD_BOT_TOKEN`からDiscordボットトークンを読み込むこと
2. The Discord Botは環境変数`ANTHROPIC_API_KEY`からAnthropic APIキーを読み込むこと
3. The Discord Botは環境変数`GITHUB_TOKEN`からGitHubアクセストークンを読み込むこと（オプション）
4. The Discord Botは環境変数`GIT_REPOSITORY_URL`からGitリポジトリのURLを読み込むこと
5. The Discord Botは環境変数`BOT_NAME`からボット名を読み込み、メンション検知に使用すること（未設定の場合はDiscord上のボット名を使用）
6. If 必須の環境変数が設定されていない場合、then the Discord Botは起動時に明確なエラーメッセージを出力して終了すること

### Requirement 6: Docker環境でのデプロイメント
**目的:** 開発者として、ボットをローカルPC上のDockerコンテナとして簡単にデプロイおよび管理したい。これにより、環境の再現性と移植性を確保できる。

#### 受入基準
1. The Discord BotはDockerfileを使用してコンテナイメージとしてビルドできること
2. The Discord Botは必要な全ての依存関係（Node.js、discord.js、git、Anthropic SDK、その他ライブラリ）をコンテナイメージに含めること
3. The Discord Botはローカルマシン（macOS、Linux、Windows + WSL2）のDocker環境で動作すること
4. When コンテナが起動する場合、the Discord Botは環境変数から設定を読み込み、Gitリポジトリのセットアップを完了してからDiscord接続を開始すること
5. The Discord Botは標準出力にログを出力し、Dockerのログ機能（`docker-compose logs`）で確認できること
6. If コンテナが停止または再起動する場合、the Discord Botは会話履歴を永続化するか、再起動後に適切に処理を再開できること
7. The Discord BotはDocker Composeを使用して簡単に起動・停止できること（`docker-compose up -d`、`docker-compose down`）
8. The Discord Botはホストマシンのボリュームマウントを使用して、ログファイルとGitリポジトリを永続化すること

### Requirement 7: エラーハンドリングと堅牢性
**目的:** 開発者として、予期しないエラーが発生してもボットが安定して動作し続けることを保証したい。これにより、ユーザー体験の低下を防ぎ、システムの信頼性を高められる。

#### 受入基準
1. If Discord APIとの接続が切断された場合、then the Discord Botは自動的に再接続を試みること
2. If Claude APIへのリクエストがタイムアウトした場合、then the Discord Botはユーザーにタイムアウトを通知し、会話状態を保持すること
3. When 処理中に予期しないエラーが発生した場合、the Discord Botはエラーログを出力し、ユーザーにエラーが発生したことを通知すること
4. The Discord Botは個々のメッセージ処理でエラーが発生しても、他のメッセージ処理や全体の動作に影響を与えないこと
5. If メッセージの長さがDiscordまたはClaude APIの制限を超える場合、then the Discord Botは適切に分割または切り詰めて処理すること
6. The Discord Botは起動時の初期化エラー（環境変数不足、Git操作失敗等）を適切にハンドリングし、詳細なエラー情報をログに出力すること

### Requirement 8: スレッド管理と会話の永続化
**目的:** ユーザーとして、過去の会話を含む文脈を保持した対話を継続したい。これにより、より自然で効果的なAI支援を受けられる。

#### 受入基準
1. When 新しいメンションを受信した場合、the Discord Botは既存のスレッドが存在するか確認すること
2. If メッセージがスレッド内にない場合、then the Discord Botは新しいスレッドを作成して応答すること
3. If メッセージが既存のスレッド内にある場合、then the Discord Botはメンションの有無に関わらずメッセージを処理し、そのスレッド内の全ての会話履歴を読み込むこと
4. The Discord Botはスレッド内のメッセージを時系列順にソートし、Claude APIに送信するコンテキストとして整形すること
5. The Discord Botはスレッドごとの会話履歴を適切にキャッシュし、同一スレッドへの複数のメッセージに対して効率的に処理できること
6. While ボットが応答を生成している間、the Discord Botはスレッド内に「入力中」インジケーターまたは一時的な応答メッセージを表示すること
7. The Discord Botはスレッド内では全てのユーザーメッセージを処理対象とし、メンション（@botname）は不要とすること

### Requirement 9: セキュリティとアクセス制御
**目的:** セキュリティ管理者として、認証情報や機密情報が適切に保護されることを保証したい。これにより、不正アクセスや情報漏洩のリスクを低減できる。

#### 受入基準
1. The Discord Botは全ての認証情報（APIキー、トークン）を環境変数から読み込み、ソースコードやログにハードコードしないこと
2. The Discord Botはログ出力時に認証情報やトークンをマスクまたは除外すること
3. The Discord Botは環境変数として提供されたGitHub tokenを使用してGit操作を実行する際、tokenがコマンドライン引数やログに露出しないようにすること
4. The Discord BotはDocker環境においてシークレット管理のベストプラクティス（環境変数、Docker secrets等）に従うこと
5. If ボットが複数のDiscordサーバー（Guild）に参加する場合、the Discord Botは適切な権限スコープのみを要求すること
6. The Discord Botは受信したメッセージやClaude APIとの通信内容を、必要最小限のログレベルでのみ記録すること

### Requirement 10: ログファイル管理
**目的:** システム管理者として、ボットの動作状況を監視し、問題発生時の調査を効率的に行いたい。これにより、障害対応の迅速化とシステムの安定運用を実現できる。

#### 受入基準
1. The Discord Botは標準出力とファイルの両方にログを出力できること（Docker logsとの互換性を維持）
2. The Discord Botは環境変数`LOG_LEVEL`（debug/info/warn/error）でログレベルを制御できること
3. When ログファイルに出力する場合、the Discord Botは日次ローテーションを実行し、最大7日分のログを保持すること
4. The Discord Botは各ログファイルが10MBを超えた場合、新しいファイルにローテーションすること
5. The Discord Botは古いログファイルを自動的に圧縮（gzip）して、ディスク容量を節約すること
6. The Discord Botは構造化ログ（JSON形式）を採用し、timestamp、level、message、contextを含めること
7. The Discord Botは以下のパターンにマッチする機密情報を自動的にマスクすること：
   - APIキー: `ANTHROPIC_API_KEY=***`、`sk-ant-***`
   - Discordトークン: `DISCORD_BOT_TOKEN=***`
   - GitHubトークン: `GITHUB_TOKEN=***`、`ghp_***`
8. The Discord Botはログファイルを`/app/logs/`ディレクトリに保存し、Dockerボリュームでホストにマウント可能とすること
9. When エラーが発生した場合、the Discord Botはスタックトレースを含む詳細なエラー情報をログに記録すること
10. The Discord Botは各処理のトレーサビリティのため、メッセージID、スレッドID、ユーザーIDをコンテキストとしてログに含めること
