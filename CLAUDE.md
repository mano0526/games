# 引き継ぎメモ（mano0526/games）

このリポジトリが「本物」。公開URL: https://mano0526.github.io/games/ （GitHub Pages、main ブランチの直下を公開）。
昔のチャットで作った claude.ai 上の版（コロコロ島パーティ／ターボカートGP／てんやわんやキッチン／Dockside Drive）は古いコピー。そちらを直してもここには入らないし、丸ごと上書きするとオンライン機能が消えるので使わない。

## ファイル
| ファイル | 中身 |
|---|---|
| index.html | ゲーム一覧（入口） |
| party.html | コロコロ島パーティ（マリオパーティ風、最大4人）。ミニゲーム35個（MG_ORDER）。被り防止は localStorage `kk_mghist_v1` |
| kart.html | ターボカートGP（マリオカート風、画面分割、WebGL `#gl` + 2D `#hud`） |
| kitchen.html | てんやわんやキッチン（オーバークック風）。元は js/*.js 分割だったのを1ファイルに統合済み |
| netplay.js | パーティ・カート・キッチン用のオンライン部品（リモートプレイ方式） |

## オンラインの仕組み
- 中継サーバーは Firebase Realtime Database（プロジェクト claude-4d377、asia-southeast1、無料の Spark プラン）。設定値は netplay.js / fakeroom.js の中に直書き（Web用の apiKey は公開前提なので問題なし）。データは `np/{game}/...` の下だけ使う。
- **netplay.js（リモートプレイ方式）**: ホストだけがゲームを動かし、キャンバスを captureStream → WebRTC で映像＋音を参加者へ配信。参加者の入力は DataChannel で送り、ホスト側で `navigator.getGamepads` を横取りして「仮想コントローラー」(2P〜4P) として注入。ゲーム本体のコードは書き換えない。
  - script タグの data 属性で設定: `data-game` / `data-fps` / `data-canvas="#gl,#hud"`（複数なら合成。WebGL は preserveDrawingBuffer を強制）/ `data-mirror="#ui"`（HTMLのメニューを DataChannel で参加者に写す。差分更新）/ `data-pos`（オンラインボタン位置）。
  - 音: AudioNode.connect を横取りして MediaStreamDestination に分岐。参加者側は iPhone 対策で「タップで音を出す」ボタン。
  - 画質: 部屋カードで 軽量540p/標準720p/高画質1080p を選択（localStorage `np-quality`）。届く解像度はホストのキャンバスの大きさで上限が決まる → ホストはPCで全画面推奨。
  - 参加者側はゲームの requestAnimationFrame を止め（freezeGame）、音も止める。
  - キー配置（参加者側）: 移動=矢印/WASD、A=Space/Z/J、B=X/K、X=C/U、Y=V/I、L=Q、R=E、START=Enter/Esc/P、SELECT=Backspace/Tab
- 格ゲー（Dockside Drive）はユーザーの判断で外した（絵が気に入らない）。以前の fakeroom.js（claude の room API を Firebase+WebRTC で再現）は git 履歴に残っている。
- 参加者側の自分用メニュー（Esc / P / START）：音量（video.volume、iPhoneは WebAudio に切替）、画質（参加者ごとに送信設定 `qq` メッセージ）、表示、画面ボタン、退出。参加者の START/SELECT はゲームに送らない。
- 参加者のキー配置は `data-keys`（キーコード→ボタン番号の配列）と `data-keyhelp` でゲームごとに指定。カートは仮想パッドの ↑↓ をアクセル/ブレーキにも使う改造あり（id が Remote Player のとき）。
- ICE は Google の STUN のみ。TURN なし → 回線の組み合わせによってはリモートプレイ方式がつながらない（未対策）。

## テスト方法（この作業環境から外部には通信できない）
- `python3 -m http.server` で配信し、Playwright の同じブラウザコンテキストで2ページ開く。
- URL に `?np=local` を付けると Firebase の代わりに同じブラウザ内の仕組み（netplay は BroadcastChannel、fakeroom は localStorage）でつながる。
- Chromium 起動オプション: `--autoplay-policy=no-user-gesture-required --disable-features=WebRtcHideLocalIpsWithMdns`

## 決定事項・ユーザーの好み
- 作業時間の目安を伝える。嘘・曖昧な情報はNG。案を出したら自分で反論して良い案にする。完成品を出す。
- 調整は Claude が直接 main に push して反映（ユーザーの手動アップロードは不要になった）。
- 1つのゲームを複数チャットで同時に編集しない。

## パーティのミニゲーム追加の書き方
- `MGS.key={name,modes:['ffa','2v2','1v1','1v3'],desc,ctl,create(mode,teams)}` → g に update(dt)/draw(c)/scores()/winners()/done。
- 便利関数: mkActor/moveActor/separate/drawActor/drawFloor/dodgeDir/seek/mgIn/mgPickWin/aliveWin/drawMGTop（vals に null を入れると表示しない）。
- テスト: `SETUP.fo.g=MG_ORDER.indexOf(key);SETUP.fo.m=modeIndex;startFree()` を全員COMで最後まで回し、scene.phase が result になるか・pageerror がないか確認。

## 残っている課題・案（ユーザーの要望順）
- カートの作り直し：CPUが離れすぎ（強さ選択よわい/ふつう/つよい＋追いつき補正）、アイテムで順位が動かない（下位ほど強く）、コースが長く単調（短く、近道・ジャンプ台などの個性）。オンラインは各自の端末で動かす方式（各自全画面）にしたい。
- アルチキ（Ultimate Chicken Horse）風の新作：置いてから走るパーティ足場ゲーム。オリジナルの見た目。各自の端末で動かす方式のオンライン。
- キッチンはユーザー未確認。
- 集まり方がわかりにくい → 一覧ページに「今ひらいている部屋」を出して［参加］1タップで入れる案（ニックネーム、招待リンクで自動参加、LINE共有）。未着手。
- Firebase のルールはテストモード（2026年12月中旬に期限切れ）。`{"rules":{".read":false,".write":false,"np":{"$game":{".read":true,".write":true}}}}` に変更してもらう必要あり（ユーザー作業）。
- TURN サーバー未導入。
- iPhone 実機での確認はまだ少ない。
- push-test という不要ブランチが残っている（削除は環境から通らなかった）。
