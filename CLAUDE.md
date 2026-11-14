# 引き継ぎメモ（mano0526/games）

このリポジトリが「本物」。公開URL: https://mano0526.github.io/games/ （GitHub Pages、main ブランチの直下を公開）。
昔のチャットで作った claude.ai 上の版（コロコロ島パーティ／ターボカートGP／てんやわんやキッチン／Dockside Drive）は古いコピー。そちらを直してもここには入らないし、丸ごと上書きするとオンライン機能が消えるので使わない。

## ファイル
| ファイル | 中身 |
|---|---|
| index.html | ゲーム一覧（入口） |
| party.html | コロコロ島パーティ（マリオパーティ風、最大4人） |
| kart.html | ターボカートGP（マリオカート風、画面分割、WebGL `#gl` + 2D `#hud`） |
| kitchen.html | てんやわんやキッチン（オーバークック風）。元は js/*.js 分割だったのを1ファイルに統合済み |
| fight.html | Dockside Drive（スト6風 2D格ゲー、ロールバック netcode 内蔵） |
| netplay.js | パーティ・カート・キッチン用のオンライン部品（リモートプレイ方式） |
| fakeroom.js | 格ゲー用。claude.ai の `room` 機能と同じ形の API を Firebase + WebRTC で作り直したもの |

## オンラインの仕組み
- 中継サーバーは Firebase Realtime Database（プロジェクト claude-4d377、asia-southeast1、無料の Spark プラン）。設定値は netplay.js / fakeroom.js の中に直書き（Web用の apiKey は公開前提なので問題なし）。データは `np/{game}/...` の下だけ使う。
- **netplay.js（リモートプレイ方式）**: ホストだけがゲームを動かし、キャンバスを captureStream → WebRTC で映像＋音を参加者へ配信。参加者の入力は DataChannel で送り、ホスト側で `navigator.getGamepads` を横取りして「仮想コントローラー」(2P〜4P) として注入。ゲーム本体のコードは書き換えない。
  - script タグの data 属性で設定: `data-game` / `data-fps` / `data-canvas="#gl,#hud"`（複数なら合成。WebGL は preserveDrawingBuffer を強制）/ `data-mirror="#ui"`（HTMLのメニューを DataChannel で参加者に写す。差分更新）/ `data-pos`（オンラインボタン位置）。
  - 音: AudioNode.connect を横取りして MediaStreamDestination に分岐。参加者側は iPhone 対策で「タップで音を出す」ボタン。
  - 画質: 部屋カードで 軽量540p/標準720p/高画質1080p を選択（localStorage `np-quality`）。届く解像度はホストのキャンバスの大きさで上限が決まる → ホストはPCで全画面推奨。
  - 参加者側はゲームの requestAnimationFrame を止め（freezeGame）、音も止める。
  - キー配置（参加者側）: 移動=矢印/WASD、A=Space/Z/J、B=X/K、X=C/U、Y=V/I、L=Q、R=E、START=Enter/Esc/P、SELECT=Backspace/Tab
- **fakeroom.js（格ゲー）**: ゲーム内の NET モジュール（ロールバック、presence ベース）はそのまま。`window.claude.use('room')` を差し替え、ロビーは Firebase、試合中は WebRTC DataChannel（unordered）で直接通信。直接つながらないときは Firebase 経由（最大12回/秒）にフォールバック。
- ICE は Google の STUN のみ。TURN なし → 回線の組み合わせによってはリモートプレイ方式がつながらない（未対策）。

## テスト方法（この作業環境から外部には通信できない）
- `python3 -m http.server` で配信し、Playwright の同じブラウザコンテキストで2ページ開く。
- URL に `?np=local` を付けると Firebase の代わりに同じブラウザ内の仕組み（netplay は BroadcastChannel、fakeroom は localStorage）でつながる。
- Chromium 起動オプション: `--autoplay-policy=no-user-gesture-required --disable-features=WebRtcHideLocalIpsWithMdns`

## 決定事項・ユーザーの好み
- 作業時間の目安を伝える。嘘・曖昧な情報はNG。案を出したら自分で反論して良い案にする。完成品を出す。
- 調整は Claude が直接 main に push して反映（ユーザーの手動アップロードは不要になった）。
- 1つのゲームを複数チャットで同時に編集しない。

## 残っている課題・案
- 参加側のキー配置をホスト側と揃える（今は参加側だけ B=X、START=Enter で画面の案内とずれる）。
- 集まり方がわかりにくい → 一覧ページに「今ひらいている部屋」を出して［参加］1タップで入れる案（ニックネーム、招待リンクで自動参加、LINE共有）。未着手。
- Firebase のルールはテストモード（2026年12月中旬に期限切れ）。`{"rules":{".read":false,".write":false,"np":{"$game":{".read":true,".write":true}}}}` に変更してもらう必要あり（ユーザー作業）。
- TURN サーバー未導入。
- iPhone 実機での確認はまだ少ない。
- push-test という不要ブランチが残っている（削除は環境から通らなかった）。
