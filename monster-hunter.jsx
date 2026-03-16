import { useState, useEffect, useRef, useCallback } from "react";

const W = 480;
const H = 640;
const DPR = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

// Polyfill roundRect for older browsers
if (typeof window !== "undefined" && CanvasRenderingContext2D.prototype.roundRect === undefined) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    const rad = typeof r === "number" ? r : (Array.isArray(r) ? r[0] : 0);
    this.moveTo(x + rad, y);
    this.arcTo(x + w, y, x + w, y + h, rad);
    this.arcTo(x + w, y + h, x, y + h, rad);
    this.arcTo(x, y + h, x, y, rad);
    this.arcTo(x, y, x + w, y, rad);
    this.closePath();
  };
}

const MONSTERS = [
  { emoji: "👾", name: "スライミー", hp: 1, score: 100, speed: 0.6, size: 36 },
  { emoji: "🍄", name: "キノコン", hp: 1, score: 120, speed: 0.8, size: 34 },
  { emoji: "👻", name: "もりゴースト", hp: 2, score: 200, speed: 0.5, size: 40 },
  { emoji: "🐸", name: "デカガエル", hp: 2, score: 250, speed: 0.4, size: 44 },
  { emoji: "🦇", name: "やみコウモリ", hp: 1, score: 150, speed: 1.2, size: 30 },
  { emoji: "🐗", name: "イノシシキング", hp: 3, score: 400, speed: 0.35, size: 48 },
  { emoji: "🐻", name: "モリグマ", hp: 4, score: 600, speed: 0.3, size: 52 },
  { emoji: "🐉", name: "コダチドラゴン", hp: 5, score: 900, speed: 0.25, size: 56 },
  { emoji: "👹", name: "もりのオーガ", hp: 7, score: 1200, speed: 0.2, size: 58 },
  { emoji: "🌳", name: "エンシェントツリー", hp: 10, score: 2000, speed: 0.15, size: 64 },
];

function dist(x1, y1, x2, y2) { return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2); }

function spawnMonster(wave) {
  const available = MONSTERS.slice(0, Math.min(MONSTERS.length, 2 + Math.floor(wave / 2)));
  const t = available[Math.floor(Math.random() * available.length)];
  const x = 30 + Math.random() * (W - 60);
  const y = -30 - Math.random() * 40;
  const vx = (Math.random() - 0.5) * t.speed * 0.6;
  const vy = t.speed * (0.5 + Math.random() * 0.5);
  return { ...t, id: Math.random(), x, y, vx, vy, currentHp: t.hp, hitTimer: 0, bobPhase: Math.random() * Math.PI * 2 };
}

function createEmojiCache() {
  const cache = {};
  MONSTERS.forEach(m => {
    const c = document.createElement("canvas");
    const s = Math.ceil(m.size * 1.6);
    c.width = s * 2; c.height = s * 2;
    const ctx = c.getContext("2d");
    ctx.scale(2, 2);
    ctx.font = `${m.size}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(m.emoji, s / 2, s / 2);
    cache[m.emoji] = { canvas: c, drawSize: s };
  });
  return cache;
}

function drawTree(ctx, x, y, scale, dark) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#5c3a1e";
  ctx.beginPath(); ctx.roundRect(-5, -12, 10, 24, 3); ctx.fill();
  ctx.fillStyle = dark ? "#1a5c2a" : "#2d8a4e";
  ctx.beginPath(); ctx.ellipse(0, -40, 28, 36, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = dark ? "#175024" : "#258b40";
  ctx.beginPath(); ctx.ellipse(-15, -28, 22, 28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = dark ? "#1e6b32" : "#34a058";
  ctx.beginPath(); ctx.ellipse(14, -30, 20, 26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

let bgCache = null;
function drawForestCached(ctx, time) {
  if (!bgCache) {
    bgCache = document.createElement("canvas");
    bgCache.width = W * DPR; bgCache.height = H * DPR;
    const bc = bgCache.getContext("2d");
    bc.scale(DPR, DPR);
    const grad = bc.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0d2b0d"); grad.addColorStop(0.5, "#0d2b0d"); grad.addColorStop(1, "#15321a");
    bc.fillStyle = grad; bc.fillRect(0, 0, W, H);
    const rg = bc.createRadialGradient(W / 2, 0, 0, W / 2, 0, 350);
    rg.addColorStop(0, "rgba(170,255,136,0.08)"); rg.addColorStop(1, "rgba(170,255,136,0)");
    bc.fillStyle = rg; bc.fillRect(0, 0, W, H);
    [[30,120,0.7],[110,90,0.9],[200,100,0.8],[300,80,1.0],[390,110,0.75],[450,95,0.85]].forEach(([x,y,s]) => drawTree(bc,x,y,s,true));
    [[-10,200,1.2],[80,220,1.0],[180,190,1.3],[280,210,1.1],[370,195,1.25],[460,215,1.0]].forEach(([x,y,s]) => drawTree(bc,x,y,s,false));
    bc.fillStyle = "#1a3d1a";
    bc.beginPath(); bc.ellipse(W / 2, H + 40, W, 300, 0, 0, Math.PI * 2); bc.fill();
    bc.fillStyle = "#15321a";
    bc.beginPath(); bc.ellipse(W / 2, H + 80, W, 280, 0, 0, Math.PI * 2); bc.fill();
    [40,100,160,230,310,370,430].forEach((gx, i) => {
      const gy = H - 60 + (i % 3) * 15;
      bc.strokeStyle = "#3aaa4a"; bc.lineWidth = 2;
      bc.beginPath(); bc.moveTo(gx - 4, gy); bc.lineTo(gx - 7, gy - 12); bc.stroke();
      bc.strokeStyle = "#2d9940";
      bc.beginPath(); bc.moveTo(gx, gy); bc.lineTo(gx, gy - 14); bc.stroke();
      bc.strokeStyle = "#3aaa4a";
      bc.beginPath(); bc.moveTo(gx + 4, gy); bc.lineTo(gx + 6, gy - 11); bc.stroke();
    });
  }
  ctx.drawImage(bgCache, 0, 0, W, H);
  // Animated fireflies
  [[60,160],[140,280],[320,150],[400,300],[240,200],[80,350],[360,380]].forEach(([fx, fy], i) => {
    const op = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(time / (800 + i * 120)));
    ctx.globalAlpha = op;
    ctx.fillStyle = "#ccff66";
    ctx.shadowColor = "#ccff66"; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  });
}

function drawPlayer(ctx, x, y, aimAngle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#336699";
  ctx.beginPath(); ctx.roundRect(-8, 14, 7, 10, 3); ctx.fill();
  ctx.beginPath(); ctx.roundRect(1, 14, 7, 10, 3); ctx.fill();
  ctx.fillStyle = "#553322";
  ctx.beginPath(); ctx.roundRect(-9, 22, 9, 5, 2); ctx.fill();
  ctx.beginPath(); ctx.roundRect(0, 22, 9, 5, 2); ctx.fill();
  ctx.fillStyle = "#4488cc";
  ctx.beginPath(); ctx.roundRect(-10, -8, 20, 22, 6); ctx.fill();
  ctx.fillStyle = "#ffddaa";
  ctx.beginPath(); ctx.arc(0, -18, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3a2a1a";
  ctx.beginPath(); ctx.ellipse(0, -28, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-10, -22, 6, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10, -22, 6, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.arc(-5, -18, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(5, -18, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(-4, -19, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6, -19, 1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#cc6644"; ctx.lineWidth = 1.5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-3, -12); ctx.quadraticCurveTo(0, -9, 3, -12); ctx.stroke();
  // Bow
  ctx.save();
  ctx.rotate(aimAngle - Math.PI / 2);
  ctx.strokeStyle = "#aa6633"; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(-12, 0, 0, 22); ctx.stroke();
  ctx.strokeStyle = "#ddccaa"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, 20); ctx.stroke();
  ctx.strokeStyle = "#8B6914"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(18, 0); ctx.stroke();
  ctx.fillStyle = "#aaa";
  ctx.beginPath(); ctx.moveTo(20, -3); ctx.lineTo(26, 0); ctx.lineTo(20, 3); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawArrow(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = "#8B6914"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(10, 0); ctx.stroke();
  ctx.fillStyle = "#bbb";
  ctx.beginPath(); ctx.moveTo(10, -3.5); ctx.lineTo(18, 0); ctx.lineTo(10, 3.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#cc4444"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-10, -4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-10, 4); ctx.stroke();
  ctx.restore();
}

export default function MonsterHunter() {
  const [screen, setScreen] = useState("title");
  const canvasRef = useRef(null);
  const gRef = useRef(null);
  const screenRef = useRef("title");

  useEffect(() => { screenRef.current = screen; }, [screen]);

  const initGame = useCallback(() => {
    const oldCache = gRef.current?.emojiCache;
    const oldHigh = gRef.current?.highScore || 0;
    gRef.current = {
      playerX: W / 2, playerY: H - 70,
      aimAngle: -Math.PI / 2,
      projectiles: [], monsters: [], effects: [],
      spawnTimer: 0, waveKills: 0, waveTarget: 5,
      mouseX: W / 2, mouseY: H / 2,
      score: 0, highScore: oldHigh,
      combo: 0, comboTimer: 0,
      arrows: 10, wave: 1,
      arrowRegenTimer: 0,
      specialReady: false, luckyBoxes: [], boss: null,
      level: 1, xp: 0, xpToNext: 300, arrowSpeed: 9,
      emojiCache: oldCache || createEmojiCache(),
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.scale(DPR, DPR);
    bgCache = null; // reset background cache on mount

    if (!gRef.current) {
      gRef.current = {
        playerX: W / 2, playerY: H - 70, aimAngle: -Math.PI / 2,
        projectiles: [], monsters: [], effects: [],
        spawnTimer: 0, waveKills: 0, waveTarget: 5,
        mouseX: W / 2, mouseY: H / 2,
        score: 0, highScore: 0, combo: 0, comboTimer: 0,
        arrows: 10, wave: 1, arrowRegenTimer: 0,
        specialReady: false, luckyBoxes: [], boss: null,
        level: 1, xp: 0, xpToNext: 300, arrowSpeed: 9,
        emojiCache: createEmojiCache(),
      };
    }

    let raf;
    let lastTime = 0;

    function loop(time) {
      const dt = Math.min(33, time - (lastTime || time));
      lastTime = time;
      const dtM = dt / 16;
      const g = gRef.current;
      const sc = screenRef.current;

      ctx.save();
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      drawForestCached(ctx, time);

      if (sc === "playing") {
        const dx = g.mouseX - g.playerX;
        const dy = g.mouseY - (g.playerY - 20);
        g.aimAngle = Math.atan2(dy, dx);
        if (g.aimAngle > 0.2) g.aimAngle = 0.2;

        g.arrowRegenTimer += dt;
        if (g.arrowRegenTimer > 1800 && g.arrows < 15) { g.arrows++; g.arrowRegenTimer = 0; }

        if (g.comboTimer > 0) { g.comboTimer -= dt; if (g.comboTimer <= 0) g.combo = 0; }

        // Move lucky boxes
        g.luckyBoxes = (g.luckyBoxes || []).filter(b => {
          b.y += 0.5 * dtM;
          b.bobPhase += 0.05 * dtM;
          b.life -= dt;
          return b.life > 0 && b.y < H + 20;
        });

        // Check player pick up lucky box (click near it or arrow hits it)
        g.luckyBoxes = g.luckyBoxes.filter(b => {
          if (dist(g.playerX, g.playerY - 20, b.x, b.y) < 50) {
            g.specialReady = true;
            g.effects.push({ x: b.x, y: b.y, frame: 0, type: "lucky", text: "⚡必殺GET！" });
            return false;
          }
          // Arrow can pick up box too
          for (let pi = 0; pi < g.projectiles.length; pi++) {
            const p = g.projectiles[pi];
            if (!p.special && dist(p.x, p.y, b.x, b.y) < 28) {
              g.specialReady = true;
              g.effects.push({ x: b.x, y: b.y, frame: 0, type: "lucky", text: "⚡必殺GET！" });
              return false;
            }
          }
          return true;
        });

        g.spawnTimer += dt;
        const rate = Math.max(800, 2500 - g.wave * 150);
        const spawnOk = !g.boss || g.boss.attackTimer >= 2900; // boss controls spawning
        if (!g.boss && g.spawnTimer > rate) { g.spawnTimer = 0; g.monsters.push(spawnMonster(g.wave)); }

        g.projectiles = g.projectiles.filter(p => { p.x += p.vx * dtM; p.y += p.vy * dtM; return p.x > -20 && p.x < W + 20 && p.y > -20 && p.y < H + 20; });

        let escaped = false;
        g.monsters = g.monsters.filter(m => {
          m.x += m.vx * dtM; m.y += m.vy * dtM; m.bobPhase += 0.04 * dtM;
          if (m.hitTimer > 0) m.hitTimer -= dt;
          // Bounce off side walls
          if (m.x < m.size / 2) { m.x = m.size / 2; m.vx = Math.abs(m.vx); }
          if (m.x > W - m.size / 2) { m.x = W - m.size / 2; m.vx = -Math.abs(m.vx); }
          if (m.y > H + 30) { escaped = true; return false; }
          return true;
        });

        if (escaped) {
          g.highScore = Math.max(g.highScore, g.score);
          screenRef.current = "gameover";
          setScreen("gameover");
        }

        g.projectiles = g.projectiles.filter(p => {
          let hit = false;
          for (let i = g.monsters.length - 1; i >= 0; i--) {
            const m = g.monsters[i];
            if (dist(p.x, p.y, m.x, m.y + Math.sin(m.bobPhase) * 5) < m.size * 0.7) {
              hit = true;
              if (p.special) {
                m.currentHp = 0;
              } else {
                m.currentHp--;
              }
              m.hitTimer = 200;
              g.effects.push({ x: p.x, y: p.y, frame: 0, type: p.special ? "special_hit" : "hit" });
              if (m.currentHp <= 0) {
                g.combo++; g.comboTimer = 3000;
                const mul = Math.min(4, 1 + g.combo * 0.25);
                const pts = Math.floor(m.score * mul * (p.special ? 2 : 1));
                g.score += pts;
                g.waveKills++;
                g.effects.push({ x: m.x, y: m.y, frame: 0, type: "score", text: `+${pts}` });
                if (Math.random() < 0.4) g.arrows = Math.min(15, g.arrows + 1);
                // XP gain
                g.xp += m.hp * 30 + m.score / 10;
                if (g.xp >= g.xpToNext) {
                  g.xp -= g.xpToNext;
                  g.level++;
                  g.xpToNext = Math.floor(g.xpToNext * 1.4);
                  // Level up bonus: arrow speed
                  g.arrowSpeed += 0.8;
                  g.effects.push({ x: W / 2, y: H / 2, frame: 0, type: "levelup", text: `Lv.${g.level}` });
                }
                // Lucky box drop
                if (!g.specialReady && Math.random() < 0.15) {
                  g.luckyBoxes = g.luckyBoxes || [];
                  g.luckyBoxes.push({ id: Math.random(), x: m.x, y: m.y, bobPhase: 0, life: 6000 });
                }
                g.monsters.splice(i, 1);
                if (g.waveKills >= g.waveTarget) {
                  g.wave++; g.waveKills = 0; g.waveTarget = 5 + g.wave * 2;
                  g.arrows = Math.min(15, g.arrows + 3);
                  g.effects.push({ x: W / 2, y: H / 2 - 50, frame: 0, type: "wave", text: `WAVE ${g.wave}` });
                  // Boss every 5 waves
                  if (g.wave % 5 === 0) {
                    const bossLv = Math.floor(g.wave / 5);
                    const bossHp = 15 + bossLv * 10;
                    g.boss = {
                      x: W / 2, y: -80, targetY: 100,
                      hp: bossHp, maxHp: bossHp,
                      size: 80, speed: 0.3,
                      phase: 0, hitTimer: 0,
                      score: 3000 + bossLv * 2000,
                      name: ["ダークトレント", "フォレストドラゴン", "エルダービースト", "カオスガーディアン"][Math.min(bossLv - 1, 3)],
                      emoji: ["🌲", "🐲", "👿", "💀"][Math.min(bossLv - 1, 3)],
                      level: bossLv,
                      attackTimer: 0,
                    };
                    g.effects.push({ x: W / 2, y: H / 2 - 80, frame: 0, type: "boss_warn", text: "⚠ BOSS ⚠" });
                  }
                }
              }
              if (!p.special) return false;
            }
          }
          return !hit || p.special;
        });

        g.effects = g.effects.filter(e => { e.frame += dtM; return e.frame < 20; });

        // Boss update
        if (g.boss) {
          const b = g.boss;
          // Move to target position
          if (b.y < b.targetY) { b.y += 0.8 * dtM; }
          else {
            // Sway left and right
            b.phase += 0.015 * dtM;
            b.x = W / 2 + Math.sin(b.phase) * (W / 2 - b.size);
            // Slowly push down
            b.y += 0.05 * dtM * b.level;
          }
          if (b.hitTimer > 0) b.hitTimer -= dt;
          // Boss attack: spawn minions
          b.attackTimer += dt;
          if (b.attackTimer > 3000 && b.y >= b.targetY) {
            b.attackTimer = 0;
            g.monsters.push(spawnMonster(g.wave));
          }
          // Boss collision with arrows
          g.projectiles = g.projectiles.filter(p => {
            if (dist(p.x, p.y, b.x, b.y) < b.size * 0.6) {
              if (p.special) {
                b.hp -= 5;
              } else {
                b.hp -= 1;
              }
              b.hitTimer = 150;
              g.effects.push({ x: p.x, y: p.y, frame: 0, type: p.special ? "special_hit" : "hit" });
              if (!p.special) return false;
            }
            return true;
          });
          // Boss escape
          if (b.y > H + 50) {
            g.highScore = Math.max(g.highScore, g.score);
            screenRef.current = "gameover";
            setScreen("gameover");
            g.boss = null;
          }
          // Boss defeated
          if (b.hp <= 0) {
            g.score += b.score;
            g.xp += b.maxHp * 20;
            // Check level up
            while (g.xp >= g.xpToNext) {
              g.xp -= g.xpToNext;
              g.level++;
              g.xpToNext = Math.floor(g.xpToNext * 1.4);
              g.arrowSpeed += 0.8;
              g.effects.push({ x: W / 2, y: H / 2 + 40, frame: 0, type: "levelup", text: `Lv.${g.level}` });
            }
            g.effects.push({ x: b.x, y: b.y, frame: 0, type: "score", text: `+${b.score}` });
            g.effects.push({ x: W / 2, y: H / 2, frame: 0, type: "boss_defeat", text: `${b.name} 撃破！` });
            // Drop lucky box + refill arrows
            g.specialReady = true;
            g.arrows = 15;
            g.effects.push({ x: b.x, y: b.y + 30, frame: 0, type: "lucky", text: "⚡必殺GET！" });
            g.boss = null;
          }
        }

        // Draw monsters
        g.monsters.forEach(m => {
          const by = Math.sin(m.bobPhase) * 5;
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.beginPath(); ctx.ellipse(m.x, m.y + m.size * 0.5 + 4, m.size * 0.5, 4, 0, 0, Math.PI * 2); ctx.fill();
          const ec = g.emojiCache[m.emoji];
          if (ec) {
            ctx.save();
            if (m.hitTimer > 0) ctx.globalAlpha = 0.5 + 0.5 * Math.sin(m.hitTimer / 30);
            ctx.drawImage(ec.canvas, m.x - ec.drawSize / 2, m.y + by - ec.drawSize / 2, ec.drawSize, ec.drawSize);
            ctx.restore();
          }
          if (m.hp > 1) {
            const bw = Math.max(32, m.size * 0.9);
            const ratio = m.currentHp / m.hp;
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.beginPath(); ctx.roundRect(m.x - bw / 2, m.y - m.size * 0.6, bw, 5, 2); ctx.fill();
            ctx.fillStyle = ratio > 0.5 ? "#44ff88" : ratio > 0.25 ? "#ffaa22" : "#ff4444";
            ctx.beginPath(); ctx.roundRect(m.x - bw / 2, m.y - m.size * 0.6, bw * ratio, 5, 2); ctx.fill();
            if (m.hp >= 5) {
              ctx.fillStyle = "#fff"; ctx.font = "bold 9px 'M PLUS Rounded 1c',sans-serif";
              ctx.textAlign = "center";
              ctx.fillText(`${m.currentHp}/${m.hp}`, m.x, m.y - m.size * 0.6 - 3);
            }
          }
        });

        // Draw lucky boxes

        // Draw boss
        if (g.boss) {
          const b = g.boss;
          ctx.save();
          ctx.translate(b.x, b.y);
          // Shadow
          ctx.fillStyle = "rgba(0,0,0,0.4)";
          ctx.beginPath(); ctx.ellipse(0, b.size * 0.5, b.size * 0.6, 8, 0, 0, Math.PI * 2); ctx.fill();
          // Aura
          const auraPulse = 0.3 + 0.2 * Math.sin(Date.now() / 300);
          ctx.shadowColor = "#ff2244"; ctx.shadowBlur = 20;
          ctx.fillStyle = `rgba(255,34,68,${auraPulse})`;
          ctx.beginPath(); ctx.arc(0, 0, b.size * 0.7, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          // Emoji (big)
          if (b.hitTimer > 0) ctx.globalAlpha = 0.5 + 0.5 * Math.sin(b.hitTimer / 20);
          ctx.font = `${b.size}px serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(b.emoji, 0, 0);
          ctx.globalAlpha = 1;
          // Crown
          ctx.fillStyle = "#ffcc00";
          ctx.beginPath();
          ctx.moveTo(-18, -b.size * 0.5 - 5);
          ctx.lineTo(-14, -b.size * 0.5 - 18);
          ctx.lineTo(-6, -b.size * 0.5 - 8);
          ctx.lineTo(0, -b.size * 0.5 - 22);
          ctx.lineTo(6, -b.size * 0.5 - 8);
          ctx.lineTo(14, -b.size * 0.5 - 18);
          ctx.lineTo(18, -b.size * 0.5 - 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // Boss HP bar (top of screen)
          const bhpW = W - 40, bhpH = 12, bhpX = 20, bhpY = 60;
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.beginPath(); ctx.roundRect(bhpX - 2, bhpY - 2, bhpW + 4, bhpH + 4, 6); ctx.fill();
          ctx.fillStyle = "#333";
          ctx.beginPath(); ctx.roundRect(bhpX, bhpY, bhpW, bhpH, 4); ctx.fill();
          const bhpRatio = Math.max(0, b.hp / b.maxHp);
          const bhpGrad = ctx.createLinearGradient(bhpX, 0, bhpX + bhpW * bhpRatio, 0);
          bhpGrad.addColorStop(0, "#ff2244"); bhpGrad.addColorStop(1, "#ff6644");
          ctx.fillStyle = bhpGrad;
          ctx.beginPath(); ctx.roundRect(bhpX, bhpY, bhpW * bhpRatio, bhpH, 4); ctx.fill();
          // Boss name + HP text
          ctx.fillStyle = "#ff6666"; ctx.font = "bold 13px 'M PLUS Rounded 1c',sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`👑 ${b.name}  ${b.hp}/${b.maxHp}`, W / 2, bhpY - 5);
        }
        (g.luckyBoxes || []).forEach(b => {
          const by = Math.sin(b.bobPhase) * 6;
          const fadeOp = b.life < 1500 ? b.life / 1500 : 1;
          ctx.save();
          ctx.globalAlpha = fadeOp;
          ctx.translate(b.x, b.y + by);
          // Glow
          ctx.shadowColor = "#ffcc00"; ctx.shadowBlur = 14;
          // Box body
          ctx.fillStyle = "#ffaa00";
          ctx.beginPath(); ctx.roundRect(-14, -14, 28, 28, 5); ctx.fill();
          ctx.shadowBlur = 0;
          // Ribbon
          ctx.fillStyle = "#ff4466";
          ctx.fillRect(-2, -14, 4, 28);
          ctx.fillRect(-14, -2, 28, 4);
          // Bow on top
          ctx.fillStyle = "#ff4466";
          ctx.beginPath(); ctx.ellipse(-6, -16, 6, 4, -0.3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(6, -16, 6, 4, 0.3, 0, Math.PI * 2); ctx.fill();
          // Question mark
          ctx.fillStyle = "#fff"; ctx.font = "bold 16px 'M PLUS Rounded 1c',sans-serif";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("?", 0, 2);
          // Sparkle particles
          const t = Date.now() / 400;
          ctx.fillStyle = "#ffee88";
          for (let s = 0; s < 4; s++) {
            const a = t + s * Math.PI / 2;
            const d = 20 + Math.sin(t * 2 + s) * 4;
            ctx.globalAlpha = fadeOp * (0.4 + 0.4 * Math.sin(t * 3 + s * 2));
            ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 2, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        });

        g.projectiles.forEach(p => {
          if (p.special) {
            // Golden glowing special arrow
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            // Glow trail
            const trailGrad = ctx.createLinearGradient(-30, 0, 10, 0);
            trailGrad.addColorStop(0, "rgba(255,220,50,0)");
            trailGrad.addColorStop(1, "rgba(255,220,50,0.5)");
            ctx.fillStyle = trailGrad;
            ctx.beginPath(); ctx.moveTo(-30, -6); ctx.lineTo(10, -2); ctx.lineTo(10, 2); ctx.lineTo(-30, 6); ctx.closePath(); ctx.fill();
            // Arrow shaft
            ctx.shadowColor = "#ffdd33"; ctx.shadowBlur = 10;
            ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(12, 0); ctx.stroke();
            // Arrowhead
            ctx.fillStyle = "#fff";
            ctx.beginPath(); ctx.moveTo(12, -5); ctx.lineTo(22, 0); ctx.lineTo(12, 5); ctx.closePath(); ctx.fill();
            // Fletching
            ctx.strokeStyle = "#ff6600"; ctx.lineWidth = 2; ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-12, -5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-12, 5); ctx.stroke();
            // Sparkles
            const sp = (Date.now() % 500) / 500;
            ctx.fillStyle = "#fff";
            ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.arc(-8 + sp * 20, -4 + Math.sin(sp * Math.PI * 4) * 3, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(sp * 15, 3 + Math.cos(sp * Math.PI * 3) * 3, 1.2, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
          } else {
            drawArrow(ctx, p.x, p.y, p.angle);
          }
        });

        g.effects.forEach(e => {
          const op = Math.max(0, 1 - e.frame / 18);
          ctx.globalAlpha = op;
          if (e.type === "score") {
            ctx.fillStyle = "#ffee44"; ctx.font = "bold 16px 'M PLUS Rounded 1c',sans-serif"; ctx.textAlign = "center";
            ctx.fillText(e.text, e.x, e.y - e.frame * 2);
          } else if (e.type === "wave") {
            ctx.fillStyle = "#66ff88"; ctx.font = "bold 28px 'M PLUS Rounded 1c',sans-serif"; ctx.textAlign = "center";
            ctx.fillText(e.text, e.x, e.y - e.frame * 1.5);
          } else if (e.type === "lucky") {
            ctx.fillStyle = "#ffcc00"; ctx.font = "bold 18px 'M PLUS Rounded 1c',sans-serif"; ctx.textAlign = "center";
            ctx.shadowColor = "#ffcc00"; ctx.shadowBlur = 8;
            ctx.fillText(e.text, e.x, e.y - e.frame * 2.5);
            ctx.shadowBlur = 0;
          } else if (e.type === "levelup") {
            ctx.fillStyle = "#44ffee"; ctx.font = "900 32px 'M PLUS Rounded 1c',sans-serif"; ctx.textAlign = "center";
            ctx.shadowColor = "#44ffee"; ctx.shadowBlur = 14;
            ctx.fillText("LEVEL UP!", e.x, e.y - e.frame * 2);
            ctx.font = "bold 22px 'M PLUS Rounded 1c',sans-serif";
            ctx.fillStyle = "#fff";
            ctx.fillText(e.text, e.x, e.y + 30 - e.frame * 2);
            ctx.font = "bold 14px 'M PLUS Rounded 1c',sans-serif";
            ctx.fillStyle = "#66bbff";
            ctx.fillText("💨 矢のスピードUP！", e.x, e.y + 55 - e.frame * 2);
            ctx.shadowBlur = 0;
            const lr = 30 + e.frame * 6;
            ctx.strokeStyle = "#44ffee"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(e.x, e.y, lr, 0, Math.PI * 2); ctx.stroke();
          } else if (e.type === "special_hit") {
            // Big golden explosion
            const r = 12 + e.frame * 5;
            ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 3;
            ctx.shadowColor = "#ffcc00"; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.6, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            // Star particles
            for (let s = 0; s < 6; s++) {
              const a = (s / 6) * Math.PI * 2 + e.frame * 0.1;
              const d = r * 1.2;
              ctx.fillStyle = "#ffee44";
              ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 2, 0, Math.PI * 2); ctx.fill();
            }
          } else if (e.type === "boss_warn") {
            ctx.fillStyle = "#ff2244"; ctx.font = "900 40px 'M PLUS Rounded 1c',sans-serif"; ctx.textAlign = "center";
            ctx.shadowColor = "#ff2244"; ctx.shadowBlur = 20;
            const shake = Math.sin(e.frame * 2) * 3;
            ctx.fillText(e.text, e.x + shake, e.y - e.frame * 1);
            ctx.shadowBlur = 0;
          } else if (e.type === "boss_defeat") {
            ctx.fillStyle = "#ffcc00"; ctx.font = "900 30px 'M PLUS Rounded 1c',sans-serif"; ctx.textAlign = "center";
            ctx.shadowColor = "#ffcc00"; ctx.shadowBlur = 16;
            ctx.fillText(e.text, e.x, e.y - e.frame * 2);
            ctx.shadowBlur = 0;
            for (let fw = 0; fw < 8; fw++) {
              const fa = (fw / 8) * Math.PI * 2 + e.frame * 0.2;
              const fd = 20 + e.frame * 8;
              ctx.fillStyle = ["#ff4466","#ffcc00","#44ffee","#66ff88","#ff88ff"][fw % 5];
              ctx.beginPath(); ctx.arc(e.x + Math.cos(fa) * fd, e.y + Math.sin(fa) * fd, 3, 0, Math.PI * 2); ctx.fill();
            }
          } else {
            ctx.strokeStyle = "#ffee44"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(e.x, e.y, 8 + e.frame * 3, 0, Math.PI * 2); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        });

        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "rgba(255,255,200,0.2)"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(g.playerX, g.playerY - 20);
        ctx.lineTo(g.playerX + Math.cos(g.aimAngle) * 60, g.playerY - 20 + Math.sin(g.aimAngle) * 60);
        ctx.stroke();
        ctx.setLineDash([]);

        drawPlayer(ctx, g.playerX, g.playerY, g.aimAngle);

        // HUD
        ctx.font = "bold 15px 'M PLUS Rounded 1c',sans-serif";
        ctx.textAlign = "left"; ctx.fillStyle = "#ccffaa";
        ctx.fillText(`🏹 ×${g.arrows}`, 12, 28);
        ctx.textAlign = "center"; ctx.fillText(`⭐ ${g.score}`, W / 2, 28);
        ctx.textAlign = "right";
        ctx.fillStyle = g.combo > 2 ? "#ffee44" : "#ccffaa";
        if (g.combo > 0) ctx.fillText(`🔥${g.combo}コンボ`, W - 12, 28);
        ctx.fillStyle = "#88bb88"; ctx.font = "bold 13px 'M PLUS Rounded 1c',sans-serif";
        ctx.fillText(`WAVE ${g.wave}`, W - 12, 48);

        // Level + XP bar
        const xpBarW = 120, xpBarH = 10, xpBarX = 12, xpBarY = 42;
        ctx.fillStyle = "#44ffee"; ctx.font = "bold 13px 'M PLUS Rounded 1c',sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`Lv.${g.level}`, xpBarX, xpBarY + 1);
        const labelW = ctx.measureText(`Lv.${g.level}`).width + 6;
        const bx = xpBarX + labelW, by = xpBarY - 8;
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.beginPath(); ctx.roundRect(bx, by, xpBarW, xpBarH, 4); ctx.fill();
        const xpRatio = Math.min(1, g.xp / g.xpToNext);
        const xpGrad = ctx.createLinearGradient(bx, 0, bx + xpBarW * xpRatio, 0);
        xpGrad.addColorStop(0, "#22ccaa"); xpGrad.addColorStop(1, "#44ffee");
        ctx.fillStyle = xpGrad;
        ctx.beginPath(); ctx.roundRect(bx, by, xpBarW * xpRatio, xpBarH, 4); ctx.fill();
        ctx.fillStyle = "#aaffdd"; ctx.font = "bold 8px 'M PLUS Rounded 1c',sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${Math.floor(g.xp)}/${g.xpToNext}`, bx + xpBarW / 2, by + 8);
        // Arrow speed indicator
        if (g.arrowSpeed > 9) {
          ctx.fillStyle = "#66bbff"; ctx.font = "bold 11px 'M PLUS Rounded 1c',sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(`💨速度×${(g.arrowSpeed / 9).toFixed(1)}`, xpBarX, xpBarY + 16);
        }

        // Special arrow indicator
        if (g.specialReady) {
          const barW = 140, barH = 16, barX = W / 2 - barW / 2, barY = H - 34;
          const pulse = 0.7 + 0.3 * Math.sin(time / 200);
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.beginPath(); ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 8); ctx.fill();
          ctx.fillStyle = `rgba(255,204,0,${pulse})`;
          ctx.shadowColor = "#ffcc00"; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 6); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#fff"; ctx.font = "bold 11px 'M PLUS Rounded 1c',sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("⚡ ダブルタップで5方向必殺！", W / 2, barY + 12);
        }
      }

      if (sc === "title") {
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, H);
        ctx.textAlign = "center";
        ctx.shadowColor = "#66ff88"; ctx.shadowBlur = 12;
        ctx.fillStyle = "#66ff88"; ctx.font = "900 36px 'M PLUS Rounded 1c',sans-serif";
        ctx.fillText("🏹 もりのかりうど 🌲", W / 2, 200);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#aaddaa"; ctx.font = "400 16px 'M PLUS Rounded 1c',sans-serif";
        ctx.fillText("原生林のモンスターハンティング", W / 2, 250);
        ["👾","🍄","🐗","🐻","🐉","👹","🌳"].forEach((e, i) => { ctx.font = `${i >= 4 ? 38 : 30}px serif`; ctx.fillText(e, 38 + i * 60, 320); });
        ctx.fillStyle = "#2d8a4e"; ctx.beginPath(); ctx.roundRect(W / 2 - 100, 390, 200, 50, 25); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "700 20px 'M PLUS Rounded 1c',sans-serif";
        ctx.fillText("クリックでスタート！", W / 2, 422);
        ctx.fillStyle = "#88bb88"; ctx.font = "400 13px 'M PLUS Rounded 1c',sans-serif";
        ctx.fillText("🖱 マウスで狙う・クリックで射つ", W / 2, 478);
        ctx.fillText("🏹 矢は自動で回復するよ", W / 2, 498);
        ctx.fillStyle = "#44ffee"; ctx.font = "700 13px 'M PLUS Rounded 1c',sans-serif";
        ctx.fillText("📈 レベルUPで矢のスピードUP！", W / 2, 518);
        ctx.fillStyle = "#ffcc66"; ctx.font = "700 13px 'M PLUS Rounded 1c',sans-serif";
        ctx.fillText("🎁 ラッキーボックスで5方向必殺の矢！", W / 2, 538);
        ctx.fillStyle = "#ffaa44"; ctx.font = "400 12px 'M PLUS Rounded 1c',sans-serif";
        ctx.fillText("素早くダブルタップで発射 ⚡", W / 2, 554);
        ctx.fillStyle = "#88bb88"; ctx.font = "400 13px 'M PLUS Rounded 1c',sans-serif";
        ctx.fillText("⚠ モンスターを逃がすとゲームオーバー！", W / 2, 574);
      }

      if (sc === "gameover") {
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, W, H);
        ctx.textAlign = "center";
        ctx.fillStyle = "#ff6666"; ctx.font = "900 32px 'M PLUS Rounded 1c',sans-serif";
        ctx.fillText("ゲームオーバー", W / 2, 200);
        ctx.fillStyle = "#ffaaaa"; ctx.font = "400 14px 'M PLUS Rounded 1c',sans-serif";
        ctx.fillText("モンスターに逃げられた…！", W / 2, 245);
        ctx.fillStyle = "#ffee44"; ctx.font = "700 22px 'M PLUS Rounded 1c',sans-serif";
        ctx.fillText(`⭐ スコア: ${g.score}`, W / 2, 300);
        ctx.fillStyle = "#aaddaa"; ctx.font = "400 16px 'M PLUS Rounded 1c',sans-serif";
        ctx.fillText(`🏆 ハイスコア: ${g.highScore}`, W / 2, 335);
        ctx.fillText(`WAVE ${g.wave} まで到達！`, W / 2, 370);
        ctx.fillStyle = "#44ffee";
        ctx.fillText(`💨 Lv.${g.level}  矢の速度×${(g.arrowSpeed / 9).toFixed(1)}`, W / 2, 395);
        ctx.fillStyle = "#2d8a4e"; ctx.beginPath(); ctx.roundRect(W / 2 - 100, 420, 200, 50, 25); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "700 20px 'M PLUS Rounded 1c',sans-serif";
        ctx.fillText("もう一回！", W / 2, 452);
      }

      ctx.restore();
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function getPos(e) {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)];
    }
    function onMove(e) {
      if (!gRef.current) return;
      const [mx, my] = getPos(e);
      gRef.current.mouseX = mx;
      gRef.current.mouseY = my;
    }
    function shoot() {
      const g = gRef.current;
      if (!g || g.arrows <= 0) return;
      g.arrows--;
      g.projectiles.push({
        id: Math.random(), x: g.playerX, y: g.playerY - 20,
        vx: Math.cos(g.aimAngle) * g.arrowSpeed, vy: Math.sin(g.aimAngle) * g.arrowSpeed, angle: g.aimAngle, special: false,
      });
    }
    function shootSpecial() {
      const g = gRef.current;
      if (!g || !g.specialReady) return;
      g.specialReady = false;
      g.effects.push({ x: g.playerX, y: g.playerY - 30, frame: 0, type: "special_hit" });
      const spread = Math.PI / 6; // 30度の扇
      for (let i = -2; i <= 2; i++) {
        const a = g.aimAngle + i * (spread / 2);
        g.projectiles.push({
          id: Math.random(), x: g.playerX, y: g.playerY - 20,
          vx: Math.cos(a) * (g.arrowSpeed + 2), vy: Math.sin(a) * (g.arrowSpeed + 2), angle: a, special: true,
        });
      }
    }
    let lastClickTime = 0;
    const DOUBLE_TAP_MS = 300;
    function onClick(e) {
      const sc = screenRef.current;
      if (sc === "title" || sc === "gameover") {
        initGame();
        screenRef.current = "playing";
        setScreen("playing");
        lastClickTime = 0;
        return;
      }
      if (sc === "playing") {
        const now = Date.now();
        if (gRef.current?.specialReady && now - lastClickTime < DOUBLE_TAP_MS) {
          shootSpecial();
          lastClickTime = 0;
        } else {
          shoot();
          lastClickTime = now;
        }
      }
    }
    function onContext(e) { e.preventDefault(); }
    function onTouch(e) { e.preventDefault(); if (e.touches[0]) { const r = canvas.getBoundingClientRect(); gRef.current.mouseX = (e.touches[0].clientX - r.left) * (W / r.width); gRef.current.mouseY = (e.touches[0].clientY - r.top) * (H / r.height); } }
    function onTouchEnd(e) { e.preventDefault(); onClick(e); }

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("contextmenu", onContext);
    canvas.addEventListener("touchmove", onTouch, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("contextmenu", onContext);
      canvas.removeEventListener("touchmove", onTouch);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [initGame]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh",
      background: "linear-gradient(180deg, #0a1a0a 0%, #0d2b0d 50%, #15321a 100%)",
      fontFamily: "'M PLUS Rounded 1c', sans-serif",
      userSelect: "none", overflow: "hidden", padding: 8,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;700;900&display=swap" rel="stylesheet" />
      <canvas
        ref={canvasRef}
        style={{
          width: W, height: H, maxWidth: "100%", maxHeight: "85vh",
          borderRadius: 12, border: "2px solid #2a5a2a",
          cursor: screen === "playing" ? "crosshair" : "pointer",
          touchAction: "none",
          boxShadow: "0 0 40px rgba(34,120,34,0.3)",
        }}
      />
      <div style={{ color: "#557755", fontSize: 11, marginTop: 8 }}>
        🌲 もりのかりうど — 原生林モンスターハンティング 🌲
      </div>
    </div>
  );
}
