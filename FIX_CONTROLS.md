# 操作方式の変更: タップ即発射

## 変更対象
`MoriNoKariudo/MoriNoKariudo/index.html` のJavaScript部分

## 現在の問題
- pointermove/touchmove でエイム方向を更新し、click/touchend で発射する2段階方式
- スマホではタッチした瞬間にエイム方向が変わるだけで、指を離した時に射つので「狙った方向に飛ばない」「レスポンスが悪い」と感じる

## 変更内容

### 1. handleClick（とtouchend）でタップ位置を取得し、その方向に即発射

```javascript
function handleClick(e) {
  var pos = getPos(e);

  if (screen === "title" || screen === "gameover") {
    var hs = g.highScore;
    g = makeGame(hs);
    screen = "playing";
    lastClick = 0;
    return;
  }

  if (screen === "playing") {
    // タップ位置への角度を計算して即座にエイム更新
    var angle = Math.atan2(pos[1] - (g.playerY - 20), pos[0] - g.playerX);
    if (angle > 0.2) angle = 0.2;
    g.aimAngle = angle;

    var now = Date.now();
    if (g.specialReady && now - lastClick < 300) {
      shootSpecial();
      lastClick = 0;
    } else {
      shoot();
      lastClick = now;
    }
  }
}
```

### 2. touchend イベントも同様にタップ位置を取得

touchendのハンドラで `getPos(e)` が正しく動くように、`getPos` 関数が `changedTouches` にも対応していることを確認：

```javascript
function getPos(e) {
  var r = canvas.getBoundingClientRect();
  var t = (e.touches && e.touches[0]) ? e.touches[0] : (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : e;
  return [(t.clientX - r.left) * (W / r.width), (t.clientY - r.top) * (H / r.height)];
}
```

### 3. touchmove のエイム追従は残してOK（照準線の表示用）

touchmove でのエイム更新はそのまま残す。これにより指をドラッグ中は照準線が動き、指を離した瞬間にその方向へ発射される。

### 4. pointermove も残してOK

マウス操作（シミュレータ等）のためにpointermoveのエイム更新も残す。

## まとめ
変更するのは主に2箇所:
1. `getPos` 関数: changedTouches 対応の追加
2. `handleClick` 関数: タップ位置から角度を計算してaimAngleを更新してから射つ

これだけで「タップした場所に向けて即座に矢が飛ぶ」動作になる。
