以下の仕様のDiscord-botを作成してください。技術的疑問点はネットで調査してアーキテクチャを検討してください。質問があればどうぞ。

- Docker環境で動作（ローカル/クラウド/VPS、どこでも動作）
- Discordで @{botname} でreplyするとbotを呼び出し
- 起動時にgitのリポジトリをcheckout済であること
- bot呼び出し時にカレントブランチが遅れていたら自動的にpullしてリポート
- ユーザーからのメッセージをすべてClaudeCodeに中継したい。
  - 例えばclaudeコマンドを呼び出して返答をそのまま返す（返答の整形等は必要かも）
- botからの返答は最初のメッセージのスレッドで返答する
  - スレッドの内容は常に会話履歴としてClaudeに渡されて欲しい
-

# コマンド

- 現在のステータス表示(git status, カレントブランチ, token残量)

# 設定可能な項目

- botname
- github repository url

# 設定可能な環境変数

- githubへのアクセストークン？

- ANTHROPICへの認証情報？

## 技術的疑問点（解決済み）

- ~~ClaudeCodeのcli版にチャット履歴を渡せる？あるいはインスタンスで起動しているところにAPIで送受信？~~
  - **解決**: Claude Code CLIを`--print`オプションで実行し、会話履歴はDiscord側で管理してプロンプトに含める方式を採用
- ~~Claude Pro契約のOAuthをどうやってサーバー上に渡すか？~~
  - **解決**: `claude setup-token`で生成したOAuthトークン(`CLAUDE_CODE_OAUTH_TOKEN`)を環境変数として設定する方式を採用。ローカル/クラウド/VPS、どの環境でも同じ方法で動作
