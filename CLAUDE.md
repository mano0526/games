# 引き継ぎメモ（mano0526/games）

このリポジトリが「本物」。公開URL: https://mano0526.github.io/games/ （GitHub Pages、main ブランチの直下を公開）。
昔のチャットで作った claude.ai 上の版（コロコロ島パーティ／ターボカートGP／てんやわんやキッチン／Dockside Drive）は古いコピー。そちらを直してもここには入らないし、丸ごと上書きするとオンライン機能が消えるので使わない。

## ファイル
| ファイル | 中身 |
|---|---|
| index.html | ゲーム一覧（入口） |
| party.html | コロコロ島パーティ（マリオパーティ風、最大4人）。ミニゲーム43個（MG_ORDER）。被り防止は localStorage `kk_mghist_v1` |
| kart.html | ターボカートGP（マリオカート風、画面分割、WebGL `#gl` + 2D `#hud`）。オンラインは netplay.js を使わず自前（各自の端末で動かす方式） |
| kitchen.html | てんやわんやキッチン（オーバークック風）。元は js/*.js 分割だったのを1ファイルに統合済み |
| trap.html | ワナワナ・ラン（アルチキ風パーティ足場ゲーム、2D canvas、最大4人＋CPU）。オンラインは自前（各自の端末で動かす方式） |
| netplay.js | パーティ・キッチン用のオンライン部品（リモートプレイ方式）。カートとワナワナは使っていない |
| netdb.js | 共通部品：各自の端末で動かす方式のDB（`NetDB.open(game)`／`NetDB.mem()`）、全ゲーム共通の部屋一覧 `NetDB.lobby`（np/lobby/）、共通の名前 `NetDB.name` と音量 `NetDB.vol`。カート・ワナワナ・一覧ページ・netplay.js が使う |

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

## 共通部品（2026-11-15）
- 部屋一覧：各ゲームのホストが `NetDB.lobby.publish(game, code, {host,n,max,st})` で np/lobby/{game}-{code} に書く（45秒ごとに更新、2分古いものは非表示、切断で消える）。一覧ページ index.html が全ゲーム分を表示し、[参加] で `?room=`（カート・ワナワナ）か `?join=`（パーティ・キッチン）付きで開く。
- 名前は localStorage `gm_name`、音量は `gm_vol`（0〜1、各ゲームの主音量に掛け算）。一覧ページの「共通の設定」で変える。
- 一覧ページの「コントローラー確認」：押しているボタンが光る。同じ名前のコントローラーが2台見えると警告（二重認識＝ボタンが2回分反応する原因）。
- netplay.js：参加側は25秒つながらないと理由を表示。ホスト側もつながらない参加者を理由つきで外す。
- メニューを開いたボタンが、同じ瞬間に「もどる」として効いて閉じてしまう不具合をカート・ワナワナで修正（開いた直後に入力を消す）。新しいメニューを作るときも同じ対策が必要。

## カート（2026-11 作り直し）
- コースは元データの6割（`c.sc=.6`、高さ `c.ysc=.75`）。1周30〜35秒。`COURSE_EXTRA` に各コースの近道 `cut`（a,b=本線の位置0〜1、mid=縮小後の座標、kind=dirt/jump/pad、open=柵なし）とジャンプ台 `springs`。
- 近道は別のリボン（`buildBranch`）。カートが近道にいる間は `k.br/k.bi`、`k.idx` は本線に換算した位置（順位・アイテム用）。分岐付近は本線の壁を片側だけ外す（`S[i].nw`、`fw`）。現在位置のサンプルは `kS(k)`、路面高さは `kSurf(k)`。
- CPU の強さ `CPU_LV`（よわい/ふつう/つよい、localStorage `tkgp_cpulv`）。追いつき補正 `rubber()` は人間の先頭/最後尾との距離で決まる。
- アイテムは1位との距離（m）で `ITEM_TABLE` から抽選。新アイテム「ロケット」（`rocketT`、自動運転＋無敵）。
- オンライン（各自の端末で動かす方式）：Firebase `np/kart2/` の下（部屋一覧は共通の np/lobby/）。`r/{code}/m`（ホスト設定・レース開始 `race`・累計 `pts`）、`p/{pid}`（参加者）、`s/{pid}`（12回/秒の位置）、`e/{raceId}/...`（アイテムの出来事）。ホストが CPU を動かす。当たり判定は「当たった側の端末」が決める。相手は150ms遅れで補間表示。招待リンク `?room=XXXX`。テストは `?np=local`（BroadcastChannel）。
- ホストが途中で抜けると部屋は消える（引き継ぎなし）。オンラインは VS レースとグランプリ（`m.mode` 0=VS、1〜=CUPS の番号+1）。GP の合計は `m.gpts/gpn`（ホストが保存、`gptsRace` で同期）、CPU は GP 中ずっと同じ顔ぶれ、2戦目からポイントの多い順に後ろからスタート。バトル・タイムアタックは1台用。

## ワナワナ・ラン（trap.html、2026-11 新規）
- 流れ：アイテム箱からえらぶ（pick 12秒）→ 置く（place 25秒）→ 走る（run 50秒）→ 結果（5秒）。点数：ゴール3・一番乗り+1・自分のワナで倒す+1（だれかゴールした時だけ）。全員ゴール／だれもゴールせず は0点。目標点（10/15/20）で勝ち。
- 1台で遊ぶときもオンラインと同じ仕組み（メモリ上のDB `dbTree(null)`、ホスト＝自分）。オンラインは Firebase `np/trap/`（部屋一覧は共通の np/lobby/、`r/{code}/m`＝進行、`p/{pid}`＝参加者、`pk/{round}/{pid}`＝えらんだ物、`pl/{round}/{pid}`＝置いた物、`s/{pid}`＝走っている位置）。
- 進行はホストだけが書く（`hostStep`）。CPU（pid が c で始まる）はホストの端末が動かす。各端末は自分のキャラだけ物理計算し、死亡・ゴールも自分で決める。ワナ（矢・ファイアバー）は時刻から計算するので全端末でほぼ同じ動き。
- 1台に複数人OK（左キーボード／右キーボード／コントローラー／タッチ）。pid は `端末ID-番号`。
- ステージは `STAGES`（8つ、48×27マス、矩形で地面・トゲ・溶岩/水）。現在のステージは `G.def`（`STAGES[G.stage]` は使わない）。アイテムは `ITEMS`（12種）。キャラは `CHARS`（6種、canvas で描画）。
- ステージづくり：localStorage `wn_custom`（12個まで）。マス目は `rleEnc/rleDec`（種類＋個数36進＋;）。部屋では `m.stage=-1` と `m.custom` で全員に届く。`m.rand` でランダム。ためし走りは `S.testRun`（ラウンド1を走るだけ→エディタに戻る）。
- CPU：ファイアバーが通り過ぎるのを待つ、矢が来たらジャンプ、着地点が危ないと空中でずらす。

## パーティのボリュームアップ（2026-11-15）
- 新ミニゲーム6個：snow（雪玉がっせん ffa/2v2、雪だるまで防げる）、fall（おちるダンスフロア、点めつ→落下、A ジャンプで1マス越え、残り4マス以下で5マス復活）、rhythm（リズムたいこ、ぴったり3/おしい1/空振り-1）、sushi（回転ずし早取り、左右に動いて取る・注文が変わるとレーン逆回転）、firefly（ほたるがり、暗闇＋ちょうちんの明かり、金3点）、race（ぐるぐるレース 3周、芝生で減速・金パネル加速）。
- ぬりぬり陣取り（paint）を作り直し：しぶき型の塗り、ペンキ玉、ダッシュでぶつかるとスタン、残り10秒でブラシ拡大、上に割合バー。
- `drawFloor` に遊び場ごとのテーマ（`FLOOR_TH`：beach/quarry/volcano/park/ice/farm/ruins/castle）。同じ緑の床ばかりにしないため。
- ミニゲームの絵：`THUMB`（本物のゲームを COM で2.5秒動かして縮小、1フレーム1個ずつ作る。SETUP 画面のときだけ `THUMB.tick()`）。`drawThumb(c,key,x,y,w,h)`。
- ミニゲームあそびの設定画面：右に絵、「ミニゲーム」の行で A → 一覧画面 `MGPICK`（4列の絵、右に説明・操作・遊べる形）。ミニゲーム開始前の説明画面にも絵を表示。
- 全ミニゲーム共通：残り10秒で「ラストスパート！」、残り5秒は毎秒カチ音＋画面のふちが赤く点めつ（g.time が減っていくゲームだけ）。
- テスト時の注意：`__kk.startCPU` で盤面を動かしたまま `runMG` すると盤面側も勝手にミニゲームを始めて衝突する。ミニゲームだけ試すときは `setBoard(0);G.players=[0,1,2,3].map(i=>({i,ci:i,human:false,dev:null,coins:10,dc:10,stars:0,items:[],node:0,color:'blue',mgCoins:0,maxCoins:10,haps:0,alpha:1,face:1}))` のように直接作ってから `__kk.runMG(key,mode)` を `__kk.step` で進める。

## パーティ 夜の自動改善（2026-11-15 13:40〜19:40、40分ごと）
- キャラ10人：fox コンタ／mouse チュチュ／panda パンパン（体は白、CHARS.col は UI 用の濃い灰色）／seal ゴマリ（足の代わりに尾びれ）を追加。COM のキャラは空きからランダム（slotPlayers）。キャラえらびに顔の列。
- 盤面：上に「★まで あと○マス」（`STK` にキャッシュ）、スターが画面外なら画面のはしに★矢印（cam.z>.8 のときだけ）。
- ミニゲーム結果：バトルロイヤルで負けた人にも順位（`mgRanks`。scores の向きが勝敗と矛盾するときは出さない）。
- 新ミニゲーム：crush（ドッスンよけ 1v3）、hockey（エアホッケー 1v1/2v2、止まって2.5秒で中央から再開）。
- アイテムのマークを絵に（`drawItemIcon`／`miniDie`）。床テーマ：quarry=石だたみ、ice=雪だまり＋キラキラ、castle=石板＋青いじゅうたん（たいほうよけの赤いねらい線と重ならないよう赤は使わない）。
- 確認：全43ミニゲーム全形式（71通り）と盤面3つを COM で通し、pageerror なし。人の操作・実機は未確認。

## パーティ（2026-11-15 夜・ユーザー要望）
- 自分の番：左下に「サイコロ／アイテム／マップ」メニュー（`turnPick`／`G.tmenu`／`drawTurnMenu`。左下のプレイヤー欄の上）。アイテムは右に一覧（説明つき）、1ターン1回。サイコロ中は B でメニューへ戻れる（使ったアイテムの効果は残る）。サイコロは出てから0.35秒は止められない。COM は従来どおり。
- かぞえてカウント（count）：見ながら A で +1／B で −1、数は発表まで画面に出さない（1画面で他人の数を見て合わせられないように）。
- ミニゲーム結果：全員のカード（順位・スコア・+10コイン）。スコアは drawMGTop の vals（`MG_LASTVALS`）→ なければ `scoreFallback`（0〜999の整数で勝敗と矛盾しないときだけ）。`g.resultVals()` を作ればそれを優先。結果は2.2秒たつまで進まない（連打で飛ばない）、COMだけなら5秒で自動。

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
- カートの作り直しは実施済み（2026-11-15）。ユーザーの実機確認待ち。特にオンライン（Firebase 本番）は作業環境から外に通信できないため未確認。
- アルチキ風「ワナワナ・ラン」は作成済み（2026-11-15）。ユーザー未確認。オンラインは Firebase 本番で未確認。
- キッチンはユーザー未確認（2026-11-15：全22ステージ自動通しプレイOK、スマホの横画面でタイトルが大きすぎるのと、ステージ名とヒントの重なりを修正。オンラインボタンは右上）。
- 一覧ページの「いま開いている部屋」は実施済み（2026-11-15）。
- Firebase のルールはテストモード（2026年12月中旬に期限切れ）。`{"rules":{".read":false,".write":false,"np":{"$game":{".read":true,".write":true}}}}` に変更してもらう必要あり（ユーザー作業）。
- TURN サーバー未導入。
- iPhone 実機での確認はまだ少ない。
- push-test という不要ブランチが残っている（削除は環境から通らなかった）。
