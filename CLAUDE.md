# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# もりのかりうど

原生林を舞台にしたモンスターハンティングゲーム。Canvas 2D で描画するバニラ JS のブラウザゲームを、iOS では WKWebView でラップしたネイティブアプリとして配布し、Web では GitHub Pages（PWA）として公開している。

## アーキテクチャの全体像

ゲーム本体は **HTML/CSS/JS がすべてインラインで詰め込まれた単一の `index.html`**（約390行）。ビルドステップ・依存パッケージ・モジュール分割は一切ない。Swift コードはこの HTML を表示するだけの薄いラッパーで、ゲームロジックは含まない。

### ⚠️ 同一ゲームの3つのコピーを同期させること

ゲーム本体の `index.html` は**バイト単位で同一の内容が3か所**に置かれている。ゲームロジックを変更したら、原則として3つすべてに同じ変更を反映する（過去のコミットでも「ルート index.html と docs/index.html にも反映」という追従が繰り返されている）。

| パス | 用途 | 備考 |
|------|------|------|
| `MoriNoKariudo/index.html` | iOS アプリが Bundle から読み込む本体 | `ViewController.swift` が `Bundle.main.path(forResource:"index")` でロード |
| `index.html`（リポジトリ直下） | ルート配置のコピー | `MoriNoKariudo/index.html` と完全一致 |
| `docs/index.html` | GitHub Pages / PWA 用 | 上記＋ PWA メタタグ（`manifest.json`・`apple-touch-icon`・`theme-color`・`description`）が**追加されている**点だけが差分。マージ時に PWA メタタグを消さないこと |

差分確認: `diff index.html MoriNoKariudo/index.html`（一致するはず）、`diff index.html docs/index.html`（PWA メタタグの行だけが出るはず）。

### 旧版・別実装ファイル（編集対象ではない）

- `もりのかりうど.html` — 古いスタンドアロン版（M PLUS Rounded フォント、別レイアウト）。現行ゲームではない。
- `monster-hunter.jsx` — 同じゲームの React コンポーネント版（`useState`/`useRef` ベース）。プロジェクトには組み込まれておらず、参考実装。

ゲームの修正依頼は基本的に上記2つではなく、3つの `index.html` を対象とする。

### ルート直下の `*.md` 指示書

`BOW_FIX_AND_DOG.md` / `FIX_CONTROLS.md` / `LEVELUP_REGEN_AND_BOX_DESIGN.md` は過去の機能追加の作業指示書（仕様メモ）。コードコメントの代わりに「何を・なぜ変えたか」を残す履歴として機能している。ファイル内では編集対象を `MoriNoKariudo/MoriNoKariudo/index.html` と記述しているが、これは旧パスで現存しない（現在は `MoriNoKariudo/index.html`）。

## ゲームコードの構造（`index.html` 内）

すべてグローバルスコープの関数とモジュールレベル変数で構成され、フレームワークはない。

- **論理解像度は固定** `GW=480, GH=640`。`resize()` がビューポートに合わせて CSS スケールし、`DPR`（最大3）でキャンバス実ピクセルを設定。描画座標は常に 480×640 基準で考える。
- **画面ステートマシン**: モジュール変数 `screen` が `"title"` / `"playing"` / `"gameover"` を遷移。`loop(time)` 内で `screen` ごとに分岐して更新・描画する。
- **ゲーム状態は `g`**: `makeGame(hs)` が返す単一オブジェクトに全状態（`projectiles`・`monsters`・`effects`・`luckyBoxes`・`boss`・`dog`・`arrows`・`wave`・`level`・`xp`・`arrowSpeed`・`maxArrows`・`arrowRegenInterval` など）を集約。リスタートは `g = makeGame(g.highScore)` で再生成。
- **`MONSTERS` 配列**: 10種のモンスター定義（`emoji`・`name`・`hp`・`score`・`speed`・`size`）。`spawnMonster(wave)` が wave に応じて出現種を選ぶ。
- **メインループ**: `requestAnimationFrame(loop)`。デルタタイムを正規化した `dtM` で移動量を計算し、`speedMul`（通常 1.0 / ターボ 1.5）を掛ける。ターボモードはタイトル画面のボタンで選択。
- **入力**: `handleClick(e)` がタップ処理の中心。`screen` ごとにボタン領域の矩形判定でモード選択・スタート・リスタートを分岐。`playing` 中はタップ位置から `g.aimAngle` を算出して**即発射**（`shoot()`）、300ms 以内のダブルタップ＋`specialReady` で5方向の必殺射撃（`shootSpecial()`）。`getPos(e)` は `touches` / `changedTouches` / マウスの全てに対応。`pointermove`・`touchmove` は照準線表示のためのエイム追従。
- **主要ゲーム要素**: 矢は上限あり＋時間で自動回復（`arrowRegenInterval`、レベルアップで短縮）、コンボ、ラッキーボックスのドロップ（必殺チャージ）、一定 wave ごとのボス、Wave 15 で犬の仲間（`g.dog`、敵を画面中央へ押し戻す）、`shake` による画面シェイク演出。
- **`highScore` はメモリ上のみ**（`makeGame` に引き継がれるだけで `localStorage` 等への永続化はない）。リロードでリセットされる。

ゲームオーバー条件: モンスターが画面下に逃げる、またはボスが画面下に到達。

## 開発ワークフロー

ビルドツール・テスト・リンタは存在しない。

### Web / PWA で動かす（推奨の素早い確認方法）
ローカルで HTML を直接ブラウザで開くか、静的サーバで配信する:
```bash
python3 -m http.server 8000        # http://localhost:8000/index.html
```
PWA としての挙動を確認する場合は `docs/` を配信する。

### GitHub Pages
リポジトリの Settings > Pages で Source を `main` ブランチの `/docs` フォルダに設定して公開。Safari の「ホーム画面に追加」で全画面 PWA として動作。

### iOS アプリ
Xcode で `MoriNoKariudo.xcodeproj` を開き、Signing & Capabilities で Team を設定してビルド & 実行。`ViewController` が WKWebView でバンドル内 `index.html` をロードするだけの構成（縦向き固定・ステータスバー非表示・インラインメディア許可・スクロール無効）。Bundle ID やバージョンは `MoriNoKariudo/Info.plist`。

## 規約

- バニラ JS のみ。`"use strict"`、`var` ベース、グローバル関数スタイルを踏襲する（既存コードに合わせる）。
- 新規ライブラリ・ビルドステップ・モジュールシステムを導入しない。1ファイル完結を維持する。
- 描画は Canvas 2D。`roundRect` は未対応ブラウザ向けに自前 polyfill 済み。
- ゲーム本体を変更したら、3つの `index.html` の同期を必ず確認する（`docs/` は PWA メタタグだけ追加で残す）。
- UI 文言・コメントは日本語。
