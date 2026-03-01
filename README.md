# もりのかりうど

原生林のモンスターハンティングゲーム。Canvas 2D で描画するブラウザゲームを WKWebView でラップした iOS アプリです。

## 遊び方

- タップした方向に矢を発射してモンスターを倒す
- 矢は時間で自動回復
- モンスターが画面下に逃げるとゲームオーバー
- ダブルタップで 5 方向必殺の矢（ラッキーボックスで取得）
- レベルアップでスピード・回復速度・矢の上限が UP

## プロジェクト構成

```
MoriNoKariudo/
├── MoriNoKariudo.xcodeproj/   # iOS ネイティブアプリ
├── MoriNoKariudo/
│   ├── AppDelegate.swift
│   ├── SceneDelegate.swift
│   ├── ViewController.swift
│   ├── index.html              # ゲーム本体
│   ├── Info.plist
│   └── Assets.xcassets/
├── docs/                       # GitHub Pages 用
│   ├── index.html
│   ├── manifest.json
│   ├── apple-touch-icon.png
│   ├── icon-192.png
│   └── icon-512.png
└── README.md
```

## GitHub Pages で遊ぶ

1. リポジトリの Settings > Pages で Source を `main` ブランチの `/docs` フォルダに設定
2. 公開された URL にアクセス
3. Safari で「ホーム画面に追加」するとアプリのように全画面で遊べる

## iOS アプリとしてビルド

1. Xcode で `MoriNoKariudo.xcodeproj` を開く
2. Signing & Capabilities で Team を設定
3. iPhone を接続してビルド & 実行
