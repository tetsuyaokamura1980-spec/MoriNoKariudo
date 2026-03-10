# 2つの修正指示

## 変更対象
`index.html`（ゲーム本体のJavaScript部分）

---

## 修正1: 弓の向きと矢の飛ぶ方向を一致させる

### 現在の問題
プレイヤーの弓の描画角度と、実際に矢が飛ぶ方向がずれている。

### 原因
drawPlayer内で弓を描画する際に `ctx.rotate(angle - Math.PI / 2)` としているが、この回転オフセットと矢の発射角度(g.aimAngle)の基準がずれている可能性がある。

### 修正方針
- drawPlayer関数に渡される `angle` は `g.aimAngle`（Math.atan2で計算済み）
- 弓の描画回転を `ctx.rotate(angle)` にして、弓の形状（弧と弦と矢）の描画座標を回転後の基準に合わせる
- つまり弓を「右向き」を基準に描画し、angleでそのまま回転すれば発射方向と一致する

### 具体的な修正

drawPlayer関数内の弓描画部分（`ctx.save(); ctx.rotate(angle - Math.PI / 2)` から対応する `ctx.restore()` まで）を以下に置き換え：

```javascript
ctx.save();
ctx.rotate(angle);
// 弓の弧（右向き基準）
ctx.shadowColor = "rgba(100,255,180,0.3)";
ctx.shadowBlur = 6;
ctx.strokeStyle = "#8B5A2B";
ctx.lineWidth = 3.5;
ctx.lineCap = "round";
ctx.beginPath();
ctx.moveTo(-4, -22);
ctx.quadraticCurveTo(12, 0, -4, 22);
ctx.stroke();
ctx.shadowBlur = 0;
// 弦
ctx.strokeStyle = "#ccbbaa";
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(-4, -20);
ctx.lineTo(-4, 20);
ctx.stroke();
// 矢柄
ctx.strokeStyle = "#8B6914";
ctx.lineWidth = 2.5;
ctx.beginPath();
ctx.moveTo(-4, 0);
ctx.lineTo(22, 0);
ctx.stroke();
// 矢じり
ctx.fillStyle = "#ccc";
ctx.beginPath();
ctx.moveTo(20, -4);
ctx.lineTo(30, 0);
ctx.lineTo(20, 4);
ctx.closePath();
ctx.fill();
ctx.restore();
```

これで弓が常に矢の飛ぶ方向（g.aimAngle）を向く。

---

## 修正2: Wave 15から犬の仲間を追加

### 仕様

- Wave 15に到達した時点で犬が出現
- 犬はプレイヤーの足元付近（playerY + 5 あたり）を左右にゆっくり行ったり来たりする
- サイズはプレイヤーの約半分
- 犬に敵が接触したら、その敵は画面中央（x: W/2, y: H/2）に向けて押し戻される
- 犬はダメージを受けない（無敵）
- 犬は絵文字「🐕」で描画

### 実装

#### 1. ゲーム状態に犬の情報を追加

makeGame関数の返却オブジェクトに追加：
```javascript
dog: null
```

#### 2. Wave進行時に犬を出現させる

Wave更新処理（`g.wave++` の付近）で、Wave 15に到達した時に犬を生成：
```javascript
if (g.wave >= 15 && !g.dog) {
  g.dog = {
    x: g.playerX,
    y: g.playerY + 5,
    dir: 1,
    speed: 0.5,
    size: 28,
    bobPhase: 0
  };
}
```

#### 3. 犬の更新処理（playingブロック内、モンスター衝突判定の後あたりに追加）

```javascript
if (g.dog) {
  var dog = g.dog;
  dog.bobPhase += 0.06 * dtM;
  dog.y = g.playerY + 5;
  // 左右移動
  dog.x += dog.speed * dog.dir * dtM;
  if (dog.x > g.playerX + 80) dog.dir = -1;
  if (dog.x < g.playerX - 80) dog.dir = 1;
  // 画面端制限
  if (dog.x < 20) { dog.x = 20; dog.dir = 1; }
  if (dog.x > W - 20) { dog.x = W - 20; dog.dir = -1; }

  // 敵との衝突判定 → 画面中央に押し戻す
  g.monsters.forEach(function(m) {
    if (dist(dog.x, dog.y, m.x, m.y) < dog.size + m.size * 0.4) {
      // 敵を画面中央方向に押し戻す
      var pushAngle = Math.atan2(H / 2 - m.y, W / 2 - m.x);
      var pushDist = 80;
      m.x += Math.cos(pushAngle) * pushDist;
      m.y += Math.sin(pushAngle) * pushDist;
      // 画面内に収める
      m.x = Math.max(m.size / 2, Math.min(W - m.size / 2, m.x));
      m.y = Math.max(-m.size, Math.min(H / 2, m.y));
      // 押し戻しエフェクト
      g.effects.push({ x: dog.x, y: dog.y, frame: 0, type: "hit" });
      shake.t = 60;
    }
  });
}
```

#### 4. 犬の描画（drawPlayer呼び出しの付近、プレイヤー描画の前後どちらでもOK）

```javascript
if (g.dog) {
  var dog = g.dog;
  var dogBob = Math.sin(dog.bobPhase) * 2;
  ctx.save();
  ctx.translate(dog.x, dog.y + dogBob);
  // 影
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 14, 14, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // 犬の絵文字（向きに応じて反転）
  if (dog.dir < 0) {
    ctx.scale(-1, 1);
  }
  ctx.font = dog.size + "px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🐕", 0, 0);
  ctx.restore();
}
```

#### 5. 犬の登場演出

犬が出現した瞬間にエフェクトを表示：
```javascript
if (g.wave >= 15 && !g.dog) {
  g.dog = { x: g.playerX, y: g.playerY + 5, dir: 1, speed: 0.5, size: 28, bobPhase: 0 };
  g.effects.push({ x: g.playerX, y: g.playerY, frame: 0, type: "wave", text: "🐕 仲間が加わった！" });
  shake.t = 200;
}
```

---

## まとめ
1. drawPlayer内の弓描画を右向き基準に書き直して、angleでそのまま回転させる
2. makeGameにdog: null追加
3. Wave 15到達時にdog生成＋演出
4. 毎フレーム犬を左右移動＋敵との衝突で中央に押し戻し
5. 犬の描画（絵文字＋影＋向き反転）
