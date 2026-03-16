# 2つの変更指示

## 変更対象
`MoriNoKariudo/MoriNoKariudo/index.html`

---

## 変更1: レベルアップ時に矢の回復速度UP

### 現在の仕様
矢の自動回復間隔は固定1800ms：
```javascript
g.arrowRegenTimer += dt;
if (g.arrowRegenTimer > 1800 && g.arrows < g.maxArrows) { g.arrows++; g.arrowRegenTimer = 0; }
```

レベルアップ時の報酬は arrowSpeed と maxArrows のみ。

### 変更内容

1. ゲーム状態に `arrowRegenInterval` を追加（初期値: 1800）

`makeGame` 関数の返却オブジェクトに追加：
```javascript
arrowRegenInterval: 1800
```

2. レベルアップ時に回復間隔を短縮（-50ms、下限800ms）

レベルアップ処理（2箇所ある：通常レベルアップとボス撃破後のwhileループ）の両方で：
```javascript
g.arrowSpeed += 0.8;
g.maxArrows += 1;
g.arrowRegenInterval = Math.max(800, g.arrowRegenInterval - 50);  // ← 追加
```

3. 回復判定で固定値1800の代わりに `g.arrowRegenInterval` を使う：
```javascript
if (g.arrowRegenTimer > g.arrowRegenInterval && g.arrows < g.maxArrows)
```

4. レベルアップ演出テキストを更新：
```
"💨 スピード＆矢の上限UP！"
```
↓
```
"💨 スピード＆回復＆上限UP！"
```

5. ゲームオーバー画面のステータス表示にも回復速度を追加：
現在:
```javascript
"Lv." + g.level + "  💨×" + (g.arrowSpeed / 9).toFixed(1) + "  🏹" + g.maxArrows + "本"
```
↓
```javascript
"Lv." + g.level + "  💨×" + (g.arrowSpeed / 9).toFixed(1) + "  ♻" + (g.arrowRegenInterval / 1000).toFixed(1) + "s  🏹" + g.maxArrows + "本"
```

---

## 変更2: ラッキーボックスのデザイン変更

### 現在の仕様
オレンジの箱の中央に白い「?」マークが描画されている：
```javascript
ctx.fillStyle = "#fff";
ctx.font = "bold 15px " + FN;
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText("?", 0, 2);
```

### 変更内容
「?」を矢の絵文字「🏹」に変更し、フォントサイズを調整：
```javascript
ctx.font = "16px serif";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText("🏹", 0, 1);
```

白い色指定(fillStyle="#fff")の行は削除するか、絵文字なのでそのまま残しても問題ない。

---

## まとめ
- `makeGame` に `arrowRegenInterval: 1800` 追加
- 回復判定の `1800` を `g.arrowRegenInterval` に変更
- レベルアップ処理2箇所に `g.arrowRegenInterval = Math.max(800, g.arrowRegenInterval - 50)` 追加
- 演出テキスト・ゲームオーバー表示を更新
- ラッキーボックスの `"?"` → `"🏹"` に変更
