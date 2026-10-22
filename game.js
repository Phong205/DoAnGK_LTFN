document.addEventListener("DOMContentLoaded", () => {
    const ui = {
        mainHeader: document.getElementById("mainHeader"),
        homeActions: document.getElementById("homeActions"),
        levelSelectArea: document.getElementById("levelSelectArea"),
        gameHud: document.getElementById("gameHud"),
        screenWrapper: document.getElementById("screenWrapper"),
        homeOverlay: document.getElementById("homeOverlay"),
        launchHintOverlay: document.getElementById("launchHintOverlay"),
        tutorialOverlay: document.getElementById("tutorialOverlay"),
        pauseOverlay: document.getElementById("pauseOverlay"),
        victoryOverlay: document.getElementById("victoryOverlay"),
        leftSidebar: document.getElementById("leftSidebar"),
        rightSidebar: document.getElementById("rightSidebar"),
        buffList: document.getElementById("buffList"),
        score: document.getElementById("hudScore"),
        lives: document.getElementById("hudLives"),
        level: document.getElementById("hudLevel"),
        playArea: document.getElementById("playArea")
    };

    const observer = new ResizeObserver(() => {
        const w = ui.screenWrapper.clientWidth;
        ui.playArea.style.transform = `scale(${w / 600})`;
    });
    observer.observe(ui.screenWrapper);

    const btn = {
        newGame: document.getElementById("btnNewGame"),
        continueGame: document.getElementById("btnContinue"),
        backHome: document.getElementById("btnBackToHome"),
        startGame: document.getElementById("btnStartGameplay"),
        menu: document.getElementById("btnGameMenu"),
        resume: document.getElementById("btnResumeGame"),
        selectLevel: document.getElementById("btnSelectLevelFromPause"),
        homePause: document.getElementById("btnHomeFromPause"),
        exitPause: document.getElementById("btnExitFromPause"),
        confirmExit: document.getElementById("btnConfirmExit"),
        confirmReset: document.getElementById("btnConfirmReset"),
        vicContinue: document.getElementById("btnVictoryContinue"),
        vicSelectLevel: document.getElementById("btnVictorySelectLevel"),
        vicHome: document.getElementById("btnVictoryHome")
    };

    const state = {
        running: false,
        launched: false,
        animId: null,
        score: 0,
        lives: 3,
        level: 1,
        bricksLeft: 0,
        ballSpeed: 4.2,
        balls: [],
        items: [],
        bricks: [],
        bullets: [],
        bossTimer: 0,
        paddle: {
            el: null,
            w: 120,
            h: 16,
            x: 240,
            y: 705,
            speed: 7.5,
            fireball: false
        },
        shield: {
            el: null,
            active: false,
            time: 0
        },
        keys: {
            left: false,
            right: false
        },
        audioCtx: null,
        sfxVol: 0.7,
        bgmVol: 0.5,
        cooldown: 0
    };

    const cfg = {
        rows: 12,
        cols: 15,
        bW: 30,
        bH: 10,
        pad: 5,
        top: 70,
        colors: ["#00a8ff", "#1e90ff", "#00f2fe", "#48dbfb", "#0abde3", "#70a1ff"]
    };
    cfg.left = (600 - (cfg.cols * (cfg.bW + cfg.pad) - cfg.pad)) / 2;

    function initAudio() {
        if (!state.audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) state.audioCtx = new AC();
        }
    }

    function playSound() {
        if (!state.audioCtx || state.sfxVol <= 0) return;
        try {
            const osc = state.audioCtx.createOscillator();
            const gain = state.audioCtx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(440, state.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, state.audioCtx.currentTime + 0.05);
            gain.gain.setValueAtTime(state.sfxVol, state.audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.05);
            osc.connect(gain);
            gain.connect(state.audioCtx.destination);
            osc.start();
            osc.stop(state.audioCtx.currentTime + 0.05);
        } catch (e) {}
    }

    function createEl(tag, css) {
        const el = document.createElement(tag);
        Object.assign(el.style, css);
        el.style.position = "absolute";
        return el;
    }

    function newBall(x, y) {
        return {
            el: null,
            r: 9,
            x: x,
            y: y,
            vx: 0,
            vy: 0,
            speed: state.ballSpeed,
            fireball: false
        };
    }

    function clearArea() {
        if (ui.playArea) ui.playArea.innerHTML = "";
    }

    function initPaddle() {
        state.paddle.el = createEl("div", {
            width: state.paddle.w + "px",
            height: state.paddle.h + "px",
            borderRadius: "6px",
            backgroundColor: "#00f2fe",
            transition: "width 0.2s"
        });
        ui.playArea.appendChild(state.paddle.el);
    }

    function initShield() {
        state.shield.el = createEl("div", {
            width: "600px",
            height: "10px",
            bottom: "10px",
            left: "0px",
            backgroundColor: "rgba(0, 210, 211, 0.7)",
            display: "none"
        });
        ui.playArea.appendChild(state.shield.el);
    }

    function initBall(b) {
        b.el = createEl("div", {
            width: (b.r * 2) + "px",
            height: (b.r * 2) + "px",
            borderRadius: "50%",
            backgroundColor: "#ffffff"
        });
        ui.playArea.appendChild(b.el);
    }

    function createBrick(c, r, hp, isU, isH, isHideable, isT, isTOn, isHealer, isBoss, col) {
        const x = c * (cfg.bW + cfg.pad) + cfg.left;
        const y = r * (cfg.bH + cfg.pad) + cfg.top;
        const w = isBoss ? cfg.bW * 3 : cfg.bW;
        const h = isBoss ? cfg.bH * 2.5 : cfg.bH;

        let color = isBoss ? "#1a1a2e" : col;

        const el = createEl("div", {
            width: w + "px",
            height: h + "px",
            backgroundColor: color,
            border: isBoss ? "2px solid #ff4757" : (isU ? (isT ? "2px solid #fff" : "2px solid #2c3e50") : "1px solid rgba(0,0,0,0.3)"),
            borderRadius: isBoss ? "6px" : "2px",
            left: x + "px",
            top: y + "px",
            boxSizing: "border-box",
            opacity: isH ? "0" : "1",
            transition: "opacity 0.4s, box-shadow 0.3s, background-color 0.3s"
        });

        if (isT) {
            el.style.boxShadow = "0 0 12px #ff9f43";
        } else if (isBoss) {
            el.style.boxShadow = "0 0 20px #ff4757, inset 0 0 10px #ff4757";

            const eyeL = createEl("div", { width: "6px", height: "6px", backgroundColor: "#ff4757", borderRadius: "50%", left: "15px", top: "8px", boxShadow: "0 0 8px #ff4757" });
            const eyeR = createEl("div", { width: "6px", height: "6px", backgroundColor: "#ff4757", borderRadius: "50%", right: "15px", top: "8px", boxShadow: "0 0 8px #ff4757" });

            const hpBar = createEl("div", {
                width: "100%",
                height: "4px",
                backgroundColor: "rgba(255,255,255,0.2)",
                top: "-8px",
                left: "0px",
                borderRadius: "2px",
                overflow: "hidden"
            });

            const pct = Math.max(0, Math.min(100, (hp / 30) * 100));
            const hpFill = createEl("div", {
                id: `bossHp_${c}_${r}`,
                width: pct + "%",
                height: "100%",
                backgroundColor: "#2ed573",
                top: "0px",
                left: "0px"
            });
            hpBar.appendChild(hpFill);

            el.appendChild(eyeL);
            el.appendChild(eyeR);
            el.appendChild(hpBar);
        }

        ui.playArea.appendChild(el);

        return {
            el: el,
            x: x,
            y: y,
            w: w,
            h: h,
            active: true,
            hp: hp,
            cooldown: 0,
            isU: isU,
            isH: isH,
            isHideable: isHideable,
            isT: isT,
            isTOn: isTOn,
            isHealer: isHealer,
            isBoss: isBoss,
            healTimer: 0
        };
    }

    function initLevel() {
        clearArea();
        initPaddle();
        initShield();

        state.bricks = [];
        state.items = [];
        state.balls = [];
        state.bullets = [];
        state.bossTimer = 0;
        state.bricksLeft = 0;
        state.paddle.w = 120;
        state.paddle.fireball = false;
        state.shield.active = false;
        state.cooldown = 0;

        for (let c = 0; c < cfg.cols; c++) {
            state.bricks[c] = [];
            for (let r = 0; r < cfg.rows; r++) {
                let hp = 1;
                let color = cfg.colors[r % cfg.colors.length];
                let isU = false;
                let isH = false;
                let isHideable = false;
                let isT = false;
                let isHealer = false;
                let isBoss = false;
                let active = true;

                if (state.level === 1) {
                    color = "#00f2fe";
                } else if (state.level === 2) {
                    const l2Cols = { 5: "#ff4757", 4: "#ffa502", 3: "#eccc68", 2: "#2ed573", 1: "#1e90ff" };
                    if (r < 2) hp = 5;
                    else if (r < 4) hp = 4;
                    else if (r < 7) hp = 3;
                    else if (r < 9) hp = 2;
                    else hp = 1;
                    color = l2Cols[hp];
                } else if (state.level === 3) {
                    if ((r === 4 || r === 8) && (c !== 2 && c !== 7 && c !== 12)) {
                        isU = true;
                        hp = -1;
                        color = "#7f8c8d";
                    }
                } else if (state.level === 4) {
                    if ((r === 3 && c === 7) || (r === 6 && c === 3) || (r === 6 && c === 11)) {
                        isT = true;
                        isU = true;
                        hp = -1;
                        color = "#ff9f43";
                    } else if (r >= 2 && r <= 8 && c >= 2 && c <= 12) {
                        isH = true;
                        isHideable = true;
                        color = "#1dd1a1";
                    } else {
                        active = false;
                    }
                } else if (state.level === 5) {
                    active = false;
                    hp = 1;
                    color = "#1e90ff";

                    if (r === 0 || r === 1 || r === 10 || r === 11 || c === 0 || c === 14) {
                        active = true;
                    }

                    const centers = [[3, 3], [3, 11], [8, 7]];
                    for (let i = 0; i < centers.length; i++) {
                        const cr = centers[i][0];
                        const cc = centers[i][1];
                        const dr = Math.abs(r - cr);
                        const dc = Math.abs(c - cc);

                        if (dr === 0 && dc === 0) {
                            isHealer = true;
                            hp = 2;
                            color = "#e84393";
                            active = true;
                        } else if (dr <= 2 && dc <= 2) {
                            hp = 2;
                            color = "#2ed573";
                            active = true;
                        }
                    }
                } else if (state.level === 6) {
                    active = false;
                    hp = 1;
                    color = "#1e90ff";

                    if (r === 11 && (c === 4 || c === 5 || c === 6 || c === 8 || c === 9 || c === 10)) {
                        isU = true;
                        hp = -1;
                        color = "#a4a4a4";
                        active = true;
                    } else if (r === 3 && c === 6) {
                        isBoss = true;
                        isU = false;
                        hp = 30;
                        color = "#1a1a2e";
                        active = true;
                    } else if (r === 0 || r === 1 || c === 0 || c === 1 || c === 2 || c === 12 || c === 13 || c === 14) {
                        active = true;
                        hp = 1;
                        color = "#1e90ff";
                    }
                }

                if (!active) {
                    state.bricks[c][r] = { active: false };
                    continue;
                }

                state.bricks[c][r] = createBrick(c, r, hp, isU, isH, isHideable, isT, false, isHealer, isBoss, color);

                if (!isU && !isBoss) {
                    state.bricksLeft++;
                }
            }
        }
    }

    function resetBall() {
        state.launched = false;
        state.paddle.fireball = false;

        state.balls.forEach(b => { if (b.el) b.el.remove(); });

        const b = newBall(state.paddle.x + state.paddle.w / 2, state.paddle.y - 9);
        initBall(b);
        state.balls = [b];

        if (state.running) {
            ui.launchHintOverlay.classList.remove("d-none");
            ui.launchHintOverlay.classList.add("d-flex");
        }
    }

    function launchBall() {
        if (!state.running || state.launched) return;

        state.launched = true;
        ui.launchHintOverlay.classList.add("d-none");
        ui.launchHintOverlay.classList.remove("d-flex");

        state.balls.forEach(b => {
            const angle = (Math.PI / 4) + (Math.random() * (Math.PI / 2));
            const dirX = Math.random() < 0.5 ? -1 : 1;
            b.vx = b.speed * Math.cos(angle) * dirX;
            b.vy = -Math.abs(b.speed * Math.sin(angle));
        });
    }

    function updateSidebar() {
        const statBricks = document.getElementById("statBricks");
        const statFireball = document.getElementById("statFireball");
        const statShield = document.getElementById("statShield");
        const statHighScore = document.getElementById("statHighScore");

        if (statBricks) statBricks.textContent = state.bricksLeft;
        if (statFireball) statFireball.textContent = state.paddle.fireball ? "Bật (⚡)" : "Tắt";
        if (statShield) statShield.textContent = state.shield.active ? `${Math.ceil(state.shield.time / 60)}s` : "Không";

        let hiScore = localStorage.getItem("BRICK_BREAKER_HIGH_SCORE") || 0;
        if (state.score > hiScore) {
            hiScore = state.score;
            localStorage.setItem("BRICK_BREAKER_HIGH_SCORE", hiScore);
        }
        if (statHighScore) statHighScore.textContent = hiScore;

        if (ui.buffList) {
            let buffsHtml = "";
            if (state.paddle.w > 120) buffsHtml += `<div class="text-warning">↔ Mở rộng thanh</div>`;
            if (state.paddle.fireball) buffsHtml += `<div class="text-danger">🔥 Bóng lửa</div>`;
            if (state.shield.active) buffsHtml += `<div class="text-info">🛡️ Khiên bảo vệ</div>`;
            if (state.balls.length > 1) buffsHtml += `<div class="text-success">🍒 Đa bóng (${state.balls.length})</div>`;

            ui.buffList.innerHTML = buffsHtml || `<span class="text-secondary fst-italic">Chưa có buff</span>`;
        }
    }

    function draw() {
        state.paddle.el.style.transform = `translate(${state.paddle.x}px, ${state.paddle.y}px)`;
        state.paddle.el.style.width = state.paddle.w + "px";
        state.paddle.el.style.backgroundColor = state.paddle.fireball ? "#ff4757" : "#00f2fe";

        if (state.shield.active && state.shield.time > 0) {
            state.shield.el.style.display = "block";
            const blink = state.shield.time < 180 && Math.floor(state.shield.time / 15) % 2 === 0;
            state.shield.el.style.opacity = blink ? "0.2" : "1";
        } else {
            state.shield.el.style.display = "none";
        }

        state.balls.forEach(b => {
            b.el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px)`;
            if (b.fireball) {
                b.el.style.backgroundColor = "#ff4757";
                b.el.style.boxShadow = "0 0 15px #ff4757";
            } else {
                b.el.style.backgroundColor = "#ffffff";
                b.el.style.boxShadow = "none";
            }
        });

        state.items.forEach(it => {
            it.el.style.transform = `translate(${it.x - it.w / 2}px, ${it.y - it.h / 2}px)`;
        });

        updateSidebar();
    }

    document.addEventListener("keydown", (e) => {
        if (["Right", "ArrowRight", "d", "D"].includes(e.key)) state.keys.right = true;
        if (["Left", "ArrowLeft", "a", "A"].includes(e.key)) state.keys.left = true;
    });

    document.addEventListener("keyup", (e) => {
        if (["Right", "ArrowRight", "d", "D"].includes(e.key)) state.keys.right = false;
        if (["Left", "ArrowLeft", "a", "A"].includes(e.key)) state.keys.left = false;
    });

    ui.playArea.addEventListener("mousemove", (e) => {
        if (!state.running) return;
        const rect = ui.playArea.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (600 / rect.width);

        if (mouseX > 0 && mouseX < 600) {
            state.paddle.x = Math.max(0, Math.min(600 - state.paddle.w, mouseX - state.paddle.w / 2));
            if (!state.launched && state.balls.length > 0) {
                state.balls[0].x = state.paddle.x + state.paddle.w / 2;
            }
        }
    });

    ui.playArea.addEventListener("click", launchBall);

    function dropItem(x, y) {
        if (Math.random() >= 0.25) return;

        const list = [
            { type: "expand", icon: "expand.png" },
            { type: "life", icon: "life.png" },
            { type: "slow", icon: "slow.png" },
            { type: "fireball", icon: "fireball.png" },
            { type: "shield", icon: "shield.png" }
        ];

        if (state.balls.length <= 2) {
            list.push({ type: "split", icon: "split.png" });
            list.push({ type: "shoot", icon: "shoot.png" });
        }

        const pick = list[Math.floor(Math.random() * list.length)];

        const el = createEl("div", {
            width: "24px",
            height: "24px",
            backgroundColor: "#ffffff",
            borderRadius: "4px",
            backgroundImage: `url('assets/icon_Item/${pick.icon}')`,
            backgroundSize: "cover",
            backgroundPosition: "center"
        });
        ui.playArea.appendChild(el);

        state.items.push({
            x: x,
            y: y,
            w: 24,
            h: 24,
            type: pick.type,
            el: el
        });
    }

    function hitBrick(b, col, row) {
        if (b.isT) {
            playSound();
            if (state.cooldown > 0) return;
            state.cooldown = 60;
            const nextState = !b.isTOn;

            for (let c = 0; c < cfg.cols; c++) {
                for (let r = 0; r < cfg.rows; r++) {
                    const target = state.bricks[c][r];
                    if (target && target.active) {
                        if (target.isT) {
                            target.cooldown = 15;
                            target.isTOn = nextState;
                            target.el.style.backgroundColor = target.isTOn ? "#ff9f43" : "#d35400";
                            target.el.style.boxShadow = target.isTOn ? "0 0 12px #ff9f43" : "none";
                        } else if (target.isHideable) {
                            target.isH = nextState;
                            target.el.style.opacity = target.isH ? "0" : "1";
                        }
                    }
                }
            }
            return;
        }

        if (b.isU) {
            playSound();
            b.cooldown = 15;
            return;
        }

        b.hp--;
        b.cooldown = 15;

        if (b.isBoss) {
            const fill = document.getElementById(`bossHp_${col}_${row}`);
            if (fill) fill.style.width = Math.max(0, Math.min(100, (b.hp / 30) * 100)) + "%";
        }

        if (b.hp > 0) {
            if (state.level === 2 || (state.level === 5 && !b.isHealer)) {
                const l2Cols = { 5: "#ff4757", 4: "#ffa502", 3: "#eccc68", 2: "#2ed573", 1: "#1e90ff" };
                b.el.style.backgroundColor = l2Cols[b.hp] || "#1e90ff";
            } else if (state.level === 5 && b.isHealer) {
                b.el.style.backgroundColor = "#fd79a8";
            } else if (state.level === 6 && b.isBoss) {
                b.el.style.backgroundColor = "#1a1a2e";
            }
            state.score += 5;
            ui.score.textContent = state.score;
            playSound();
        } else {
            b.active = false;
            b.el.remove();

            state.score += 10;
            ui.score.textContent = state.score;

            if (!b.isBoss) state.bricksLeft--;

            playSound();
            dropItem(b.x + (b.w || cfg.bW) / 2, b.y + (b.h || cfg.bH) / 2);

            let win = state.level === 6 ? b.isBoss : state.bricksLeft <= 0;

            if (win) {
                state.running = false;
                cancelAnimationFrame(state.animId);
                localStorage.removeItem("BRICK_BREAKER_SAVE");
                checkContinueBtn();

                ui.launchHintOverlay.classList.add("d-none");
                ui.launchHintOverlay.classList.remove("d-flex");
                ui.victoryOverlay.classList.remove("d-none");
                ui.victoryOverlay.classList.add("d-flex");
            }
        }
    }

    function checkCollisions() {
        for (let c = 0; c < cfg.cols; c++) {
            for (let r = 0; r < cfg.rows; r++) {
                const b = state.bricks[c][r];
                if (b && b.active && b.cooldown > 0) b.cooldown--;
            }
        }

        state.balls.forEach(b => {
            let bounced = false;

            for (let c = 0; c < cfg.cols; c++) {
                for (let r = 0; r < cfg.rows; r++) {
                    const brick = state.bricks[c][r];

                    if (brick && brick.active && brick.cooldown <= 0 && !brick.isH) {
                        const bw = brick.w || cfg.bW;
                        const bh = brick.h || cfg.bH;

                        const hitX = b.x + b.r > brick.x && b.x - b.r < brick.x + bw;
                        const hitY = b.y + b.r > brick.y && b.y - b.r < brick.y + bh;

                        if (hitX && hitY) {
                            if ((!b.fireball || brick.isU) && !bounced) {
                                const overlapL = (b.x + b.r) - brick.x;
                                const overlapR = (brick.x + bw) - (b.x - b.r);
                                const overlapT = (b.y + b.r) - brick.y;
                                const overlapB = (brick.y + bh) - (b.y - b.r);

                                if (Math.min(overlapL, overlapR) < Math.min(overlapT, overlapB)) {
                                    b.vx = -b.vx;
                                } else {
                                    b.vy = -b.vy;
                                }
                                bounced = true;
                            }
                            hitBrick(brick, c, r);
                        }
                    }
                }
            }
        });
    }

    function updateItems() {
        for (let i = 0; i < state.items.length; i++) {
            const it = state.items[i];
            it.y += 1.5;

            const hitY = it.y + it.h / 2 > state.paddle.y && it.y - it.h / 2 < state.paddle.y + state.paddle.h;
            const hitX = it.x + it.w / 2 > state.paddle.x && it.x - it.w / 2 < state.paddle.x + state.paddle.w;

            if (hitY && hitX) {
                if (it.type === "expand") {
                    state.paddle.w = Math.min(240, state.paddle.w + 30);
                } else if (it.type === "life") {
                    if (state.lives < 5) {
                        state.lives++;
                        ui.lives.textContent = state.lives;
                    } else {
                        state.score += 50;
                        ui.score.textContent = state.score;
                    }
                } else if (it.type === "slow") {
                    state.balls.forEach(b => {
                        if (Math.hypot(b.vx, b.vy) > 2.5) {
                            b.vx *= 0.8;
                            b.vy *= 0.8;
                        }
                    });
                } else if (it.type === "split") {
                    const newBalls = [];
                    state.balls.forEach(b => {
                        const a = Math.atan2(b.vy, b.vx);
                        const a1 = a + Math.PI / 6;
                        const a2 = a - Math.PI / 6;

                        const b1 = newBall(b.x, b.y);
                        b1.vx = b.speed * Math.cos(a1);
                        b1.vy = b.speed * Math.sin(a1);
                        b1.fireball = b.fireball;
                        initBall(b1);
                        newBalls.push(b1);

                        const b2 = newBall(b.x, b.y);
                        b2.vx = b.speed * Math.cos(a2);
                        b2.vy = b.speed * Math.sin(a2);
                        b2.fireball = b.fireball;
                        initBall(b2);
                        newBalls.push(b2);
                    });
                    state.balls = state.balls.concat(newBalls);
                } else if (it.type === "shoot") {
                    [-Math.PI / 2, -Math.PI / 2 - Math.PI / 6, -Math.PI / 2 + Math.PI / 6].forEach(a => {
                        const bullet = newBall(state.paddle.x + state.paddle.w / 2, state.paddle.y - 10);
                        bullet.vx = bullet.speed * Math.cos(a);
                        bullet.vy = bullet.speed * Math.sin(a);
                        initBall(bullet);
                        state.balls.push(bullet);
                    });
                } else if (it.type === "fireball") {
                    state.paddle.fireball = true;
                } else if (it.type === "shield") {
                    state.shield.active = true;
                    state.shield.time = 600;
                }

                playSound();
                it.el.remove();
                state.items.splice(i, 1);
                i--;
            } else if (it.y - it.h / 2 > 750) {
                it.el.remove();
                state.items.splice(i, 1);
                i--;
            }
        }
    }

    function update() {
        if (!state.running) return;

        if (state.shield.active) {
            state.shield.time--;
            if (state.shield.time <= 0) state.shield.active = false;
        }

        if (state.cooldown > 0) state.cooldown--;

        if (!state.launched) {
            if (state.balls.length > 0) {
                state.balls[0].x = state.paddle.x + state.paddle.w / 2;
                state.balls[0].y = state.paddle.y - state.balls[0].r;
            }
        } else {
            for (let i = state.balls.length - 1; i >= 0; i--) {
                const b = state.balls[i];

                function resetFireball() {
                    if (b.fireball) {
                        b.fireball = false;
                        b.speed = state.ballSpeed;
                        const a = Math.atan2(b.vy, b.vx);
                        b.vx = b.speed * Math.cos(a);
                        b.vy = b.speed * Math.sin(a);
                    }
                }

                if (b.x - b.r <= 0) {
                    b.x = b.r;
                    b.vx = -b.vx;
                    playSound();
                } else if (b.x + b.r >= 600) {
                    b.x = 600 - b.r;
                    b.vx = -b.vx;
                    playSound();
                }

                if (b.y + b.vy < b.r) {
                    b.vy = -b.vy;
                    playSound();
                    resetFireball();
                } else if (b.y + b.vy > state.paddle.y - b.r) {
                    const hitPaddle = b.x > state.paddle.x && b.x < state.paddle.x + state.paddle.w;

                    if (hitPaddle) {
                        const rel = (b.x - (state.paddle.x + state.paddle.w / 2)) / (state.paddle.w / 2);
                        const angle = rel * (Math.PI / 3);

                        if (state.paddle.fireball && !b.fireball) {
                            b.fireball = true;
                            b.speed = state.ballSpeed * 3;
                            state.paddle.fireball = false;
                        }

                        b.vx = b.speed * Math.sin(angle);
                        b.vy = -b.speed * Math.cos(angle);
                        playSound();
                    } else if (b.y + b.vy > 750 - b.r) {
                        if (state.shield.active) {
                            b.vy = -b.vy;
                            b.y = 750 - b.r - 15;
                            state.shield.active = false;
                            playSound();
                        } else {
                            b.el.remove();
                            state.balls.splice(i, 1);
                        }
                    }
                }

                b.x += b.vx;
                b.y += b.vy;
            }

            if (state.balls.length === 0) {
                state.lives--;
                ui.lives.textContent = state.lives;

                if (state.lives <= 0) {
                    localStorage.removeItem("BRICK_BREAKER_SAVE");
                    checkContinueBtn();
                    goHome();
                    return;
                } else {
                    resetBall();
                }
            }

            checkCollisions();
            updateItems();

            if (state.level === 5) {
                const badge = document.getElementById("healerHudBadge");
                const timer = document.getElementById("healerTimerDisplay");
                if (badge) badge.classList.remove("d-none");

                for (let c = 0; c < cfg.cols; c++) {
                    for (let r = 0; r < cfg.rows; r++) {
                        const core = state.bricks[c][r];
                        if (core && core.active && core.isHealer) {
                            core.healTimer++;
                            if (timer) timer.textContent = Math.max(0, Math.ceil((3600 - core.healTimer) / 60));

                            if (core.healTimer >= 3600) {
                                core.healTimer = 0;
                                if (core.hp < 2) {
                                    core.hp++;
                                    core.el.style.backgroundColor = "#e84393";
                                }

                                for (let dc = -2; dc <= 2; dc++) {
                                    for (let dr = -2; dr <= 2; dr++) {
                                        if (dc === 0 && dr === 0) continue;
                                        const nc = c + dc;
                                        const nr = r + dr;

                                        if (nc >= 0 && nc < cfg.cols && nr >= 0 && nr < cfg.rows) {
                                            const target = state.bricks[nc][nr];
                                            if (target && target.active && !target.isHealer) {
                                                if (target.hp < 3) {
                                                    target.hp++;
                                                    const l2Cols = { 5: "#ff4757", 4: "#ffa502", 3: "#eccc68", 2: "#2ed573", 1: "#1e90ff" };
                                                    target.el.style.backgroundColor = l2Cols[target.hp] || "#1e90ff";
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                const badge = document.getElementById("healerHudBadge");
                if (badge) badge.classList.add("d-none");
            }

            if (state.level === 6) {
                const badge = document.getElementById("bossHudBadge");
                const bossHp = document.getElementById("bossHpDisplay");
                if (badge) badge.classList.remove("d-none");

                let bX = 300, bY = 100, bAlive = false;

                for (let c = 0; c < cfg.cols; c++) {
                    for (let r = 0; r < cfg.rows; r++) {
                        const b = state.bricks[c][r];
                        if (b && b.active && b.isBoss) {
                            bAlive = true;
                            bX = b.x + (b.w || cfg.bW) / 2;
                            bY = b.y + (b.h || cfg.bH);
                            if (bossHp) bossHp.textContent = b.hp;
                        }
                    }
                }

                if (bAlive) {
                    state.bossTimer++;
                    if (state.bossTimer >= 300) {
                        state.bossTimer = 0;

                        const bullet = createEl("div", {
                            width: "8px",
                            height: "16px",
                            backgroundColor: "#ff4757",
                            borderRadius: "4px",
                            boxShadow: "0 0 8px #ff4757"
                        });
                        ui.playArea.appendChild(bullet);

                        state.bullets.push({ x: bX, y: bY, vy: 2.0, el: bullet });
                    }
                }

                for (let i = state.bullets.length - 1; i >= 0; i--) {
                    const p = state.bullets[i];
                    p.y += p.vy;
                    p.el.style.transform = `translate(${p.x - 4}px, ${p.y}px)`;

                    const hitY = p.y + 16 >= state.paddle.y && p.y <= state.paddle.y + state.paddle.h;
                    const hitX = p.x + 8 >= state.paddle.x && p.x <= state.paddle.x + state.paddle.w;

                    if (hitY && hitX) {
                        p.el.remove();
                        state.bullets.splice(i, 1);

                        if (!state.shield.active) {
                            state.lives--;
                            ui.lives.textContent = state.lives;
                            playSound();

                            if (state.lives <= 0) {
                                localStorage.removeItem("BRICK_BREAKER_SAVE");
                                checkContinueBtn();
                                goHome();
                                return;
                            }
                        } else {
                            state.shield.active = false;
                        }
                    } else if (p.y > 750) {
                        p.el.remove();
                        state.bullets.splice(i, 1);
                    }
                }
            } else {
                const badge = document.getElementById("bossHudBadge");
                if (badge) badge.classList.add("d-none");

                state.bullets.forEach(p => p.el.remove());
                state.bullets = [];
            }
        }

        if (state.keys.right && state.paddle.x < 600 - state.paddle.w) {
            state.paddle.x += state.paddle.speed;
            if (!state.launched && state.balls.length > 0) {
                state.balls[0].x = state.paddle.x + state.paddle.w / 2;
            }
        } else if (state.keys.left && state.paddle.x > 0) {
            state.paddle.x -= state.paddle.speed;
            if (!state.launched && state.balls.length > 0) {
                state.balls[0].x = state.paddle.x + state.paddle.w / 2;
            }
        }

        draw();

        if (state.running) {
            state.animId = requestAnimationFrame(update);
        }
    }

    function expandGameUI() {
        ui.mainHeader.classList.add("d-none");
        ui.homeActions.classList.add("d-none");
        ui.homeActions.classList.remove("d-flex");
        ui.levelSelectArea.classList.add("d-none");
        ui.levelSelectArea.classList.remove("d-flex");
        ui.homeOverlay.classList.add("d-none");
        ui.homeOverlay.classList.remove("d-flex");
        ui.screenWrapper.classList.add("playing-size");
        ui.gameHud.classList.remove("d-none");
        ui.gameHud.classList.add("d-flex");

        if (ui.leftSidebar) {
            ui.leftSidebar.classList.remove("d-none");
            ui.leftSidebar.classList.add("d-flex");
        }
        if (ui.rightSidebar) {
            ui.rightSidebar.classList.remove("d-none");
            ui.rightSidebar.classList.add("d-flex");
        }
    }

    function goHome() {
        state.running = false;
        cancelAnimationFrame(state.animId);

        ui.screenWrapper.classList.remove("playing-size");
        ui.gameHud.classList.add("d-none");
        ui.gameHud.classList.remove("d-flex");
        ui.launchHintOverlay.classList.add("d-none");
        ui.launchHintOverlay.classList.remove("d-flex");
        ui.tutorialOverlay.classList.add("d-none");
        ui.tutorialOverlay.classList.remove("d-flex");
        ui.pauseOverlay.classList.add("d-none");
        ui.pauseOverlay.classList.remove("d-flex");
        ui.victoryOverlay.classList.add("d-none");
        ui.victoryOverlay.classList.remove("d-flex");
        ui.mainHeader.classList.remove("d-none");
        ui.homeActions.classList.remove("d-none");
        ui.homeActions.classList.add("d-flex");
        ui.levelSelectArea.classList.add("d-none");
        ui.homeOverlay.classList.remove("d-none");
        ui.homeOverlay.classList.add("d-flex");

        if (ui.leftSidebar) {
            ui.leftSidebar.classList.add("d-none");
            ui.leftSidebar.classList.remove("d-flex");
        }
        if (ui.rightSidebar) {
            ui.rightSidebar.classList.add("d-none");
            ui.rightSidebar.classList.remove("d-flex");
        }
        if (ui.leftSidebar) ui.leftSidebar.classList.remove("d-none");
        if (ui.rightSidebar) ui.rightSidebar.classList.remove("d-none");

        initLevel();
        resetBall();
        draw();
        checkContinueBtn();
    }

    function loadLevel(lvl, keepScore = false) {
        state.level = lvl;
        if (!keepScore) state.score = 0;
        state.lives = 3;
        ui.score.textContent = state.score;
        ui.lives.textContent = state.lives;

        if (ui.level) ui.level.textContent = `MÀN ${state.level}`;

        const tutorials = {
            1: { title: "MÀN 1: GẠCH CƠ BẢN", desc: "👉 Khối gạch vỡ sau 1 chạm.<br>🕹️ Điều khiển: Chuột hoặc phím mũi tên.<br>🖱️ Khởi động: Nhấn chuột trái." },
            2: { title: "MÀN 2: GẠCH NHIỀU MÁU", desc: "👉 Có những khối gạch cứng cần đập nhiều lần mới vỡ.<br>⚠️ Hãy chú ý màu sắc để biết độ bền của gạch." },
            3: { title: "MÀN 3: GẠCH THANH CHẮN", desc: "👉 Xuất hiện các thanh chắn kim loại vĩnh cửu không thể bị phá vỡ.<br>⚠️ Bạn phải khéo léo lách bóng qua các khe hở." },
            4: { title: "MÀN 4: GẠCH BỊ ẨN", desc: "👉 Một số khối gạch tàng hình và chỉ lộ diện khi bóng chạm vào khối nút chỉ định.<br>⚠ Nếu chạm nút lần nữa, gạch sẽ tàng hình lại." },
            5: { title: "MÀN 5: GẠCH HỒI PHỤC", desc: "👉 Có 3 quả cầu đặc biệt. Lõi ở giữa sẽ bơm máu cho gạch xung quanh mỗi 60s.<br>⚠️ Gạch đã vỡ sẽ không thể mọc lại, hãy ưu tiên tiêu diệt lõi." },
            6: { title: "MÀN 6: GẠCH BOSS", desc: "👉 Đối đầu với trùm cuối. Khối gạch khổng lồ có lượng máu lớn và tự động bắn đạn tấn công.<br>⚠ Hãy né tránh và tiêu diệt trùm!" }
        };

        const currentTut = tutorials[lvl] || tutorials[1];
        const titleEl = document.getElementById("tutorialTitle");
        const descEl = document.getElementById("tutorialDesc");

        if (titleEl) titleEl.textContent = currentTut.title;
        if (descEl) descEl.innerHTML = currentTut.desc;

        state.paddle.x = 240;
        initLevel();
        resetBall();
        draw();
        expandGameUI();

        ui.victoryOverlay.classList.add("d-none");
        ui.victoryOverlay.classList.remove("d-flex");
        ui.tutorialOverlay.classList.remove("d-none");
        ui.tutorialOverlay.classList.add("d-flex");
    }

    function saveGame() {
        if (!state.bricks || state.bricksLeft <= 0) return;

        const matrix = [];
        for (let c = 0; c < cfg.cols; c++) {
            matrix[c] = [];
            for (let r = 0; r < cfg.rows; r++) {
                let val = 0;
                const b = state.bricks[c][r];
                if (b && b.active) {
                    if (b.isT) {
                        val = b.isTOn ? -2 : -3;
                    } else if (b.isU) {
                        val = -1;
                    } else if (b.isBoss) {
                        val = b.hp;
                    } else {
                        val = b.hp;
                        if (b.isH) val += 100;
                    }
                }
                matrix[c][r] = val;
            }
        }

        const data = {
            level: state.level,
            score: state.score,
            lives: state.lives,
            paddleX: state.paddle.x,
            paddleY: 705,
            isLaunched: state.launched,
            savedBalls: state.balls.map(b => ({
                posX: b.x > 0 ? b.x : state.paddle.x + 60,
                posY: b.y > 0 ? b.y : 690,
                velX: b.vx,
                velY: b.vy,
                speed: b.speed,
                isRed: b.fireball
            })),
            brickMatrix: matrix
        };
        localStorage.setItem("BRICK_BREAKER_SAVE", JSON.stringify(data));
        checkContinueBtn();
    }

    function checkContinueBtn() {
        if (!btn.continueGame) return;
        const saved = localStorage.getItem("BRICK_BREAKER_SAVE");
        if (saved && saved !== "undefined" && saved !== "null") {
            btn.continueGame.removeAttribute("disabled");
            btn.continueGame.classList.remove("disabled");
            btn.continueGame.style.opacity = "1";
            btn.continueGame.style.pointerEvents = "auto";
        } else {
            btn.continueGame.setAttribute("disabled", "true");
            btn.continueGame.classList.add("disabled");
            btn.continueGame.style.opacity = "0.5";
            btn.continueGame.style.pointerEvents = "none";
        }
    }

    checkContinueBtn();

    let resetCallback = null;
    let modalInstance = null;
    const confirmNode = document.getElementById("confirmResetModal");
    if (confirmNode && typeof bootstrap !== "undefined") {
        modalInstance = new bootstrap.Modal(confirmNode);
    }

    function confirmAction(action) {
        if (localStorage.getItem("BRICK_BREAKER_SAVE")) {
            resetCallback = action;
            if (modalInstance) {
                modalInstance.show();
            } else if (confirm("Tiến trình sẽ bị xóa. Bạn có muốn tiếp tục?")) {
                action();
            }
        } else {
            action();
        }
    }

    btn.newGame.addEventListener("click", () => {
        initAudio();
        confirmAction(() => {
            localStorage.removeItem("BRICK_BREAKER_SAVE");
            checkContinueBtn();
            ui.homeActions.classList.add("d-none");
            ui.homeActions.classList.remove("d-flex");
            ui.levelSelectArea.classList.remove("d-none");
            ui.levelSelectArea.classList.add("d-flex");
        });
    });

    btn.backHome.addEventListener("click", () => {
        ui.levelSelectArea.classList.add("d-none");
        ui.levelSelectArea.classList.remove("d-flex");
        ui.homeActions.classList.remove("d-none");
        ui.homeActions.classList.add("d-flex");
    });

    document.querySelectorAll('.btn-level').forEach(node => {
        node.addEventListener("click", (e) => {
            loadLevel(parseInt(e.currentTarget.getAttribute("data-level")));
        });
    });

    btn.startGame.addEventListener("click", () => {
        ui.tutorialOverlay.classList.add("d-none");
        ui.tutorialOverlay.classList.remove("d-flex");
        state.running = true;
        resetBall();
        update();
    });

    btn.continueGame.addEventListener("click", () => {
        initAudio();
        const raw = localStorage.getItem("BRICK_BREAKER_SAVE");
        if (!raw) return;

        const data = JSON.parse(raw);
        state.level = data.level || 1;
        if (ui.level) ui.level.textContent = `MÀN ${state.level}`;

        expandGameUI();
        state.score = data.score;
        state.lives = data.lives;
        state.paddle.x = data.paddleX;
        state.paddle.y = 705;
        state.launched = data.isLaunched;

        clearArea();
        initPaddle();
        initShield();
        state.balls = [];
        state.items = [];
        state.bullets = [];
        state.bossTimer = 0;
        state.shield.active = false;
        state.paddle.fireball = false;
        state.paddle.w = 120;

        data.savedBalls.forEach(sb => {
            const b = newBall(sb.posX > 0 ? sb.posX : state.paddle.x + 60, sb.posY > 0 ? sb.posY : 690);
            b.vx = sb.velX;
            b.vy = sb.velY;
            b.speed = sb.speed;
            b.fireball = sb.isRed;
            initBall(b);
            state.balls.push(b);
        });

        let hasValid = false;
        if (data.brickMatrix) {
            for (let c = 0; c < cfg.cols; c++) {
                for (let r = 0; r < cfg.rows; r++) {
                    if (data.brickMatrix[c] && data.brickMatrix[c][r] !== 0) {
                        hasValid = true;
                        break;
                    }
                }
                if (hasValid) break;
            }
        }

        if (!hasValid) {
            initLevel();
            resetBall();
        } else {
            state.bricks = [];
            state.bricksLeft = 0;

            for (let c = 0; c < cfg.cols; c++) {
                state.bricks[c] = [];
                for (let r = 0; r < cfg.rows; r++) {
                    const val = data.brickMatrix[c][r];
                    let hp = val;
                    let isU = false;
                    let isH = false;
                    let isHideable = false;
                    let isT = false;
                    let isTOn = false;
                    let isHealer = false;
                    let isBoss = false;
                    let active = val !== 0;
                    let col = cfg.colors[r % cfg.colors.length];

                    if (state.level === 1) {
                        col = "#00f2fe";
                    } else if (state.level === 2 || state.level === 5) {
                        const l2Cols = { 5: "#ff4757", 4: "#ffa502", 3: "#eccc68", 2: "#2ed573", 1: "#1e90ff" };
                        col = l2Cols[hp] || "#1e90ff";
                    } else if (state.level === 4) {
                        isHideable = true;
                        col = "#1dd1a1";
                    } else if (state.level === 6) {
                        if (r === 3 && c === 6) {
                            isBoss = true;
                            col = "#1a1a2e";
                        }
                    }

                    if (state.level === 5) {
                        const centers = [[3, 3], [3, 11], [8, 7]];
                        for (let i = 0; i < centers.length; i++) {
                            const cr = centers[i][0];
                            const cc = centers[i][1];
                            if (Math.abs(r - cr) === 0 && Math.abs(c - cc) === 0) {
                                isHealer = true;
                                col = (hp === 2) ? "#e84393" : "#fd79a8";
                            }
                        }
                    }

                    if (val !== 0) {
                        if (hp === -1) {
                            isU = true;
                            col = "#7f8c8d";
                        } else if (hp === -2 || hp === -3) {
                            isU = true;
                            isT = true;
                            isTOn = (hp === -2);
                            hp = -1;
                            col = isTOn ? "#ff9f43" : "#d35400";
                        } else {
                            if (hp >= 100) {
                                isH = true;
                                hp -= 100;
                            }
                        }

                        state.bricks[c][r] = createBrick(c, r, hp, isU, isH, isHideable, isT, isTOn, isHealer, isBoss, col);

                        if (active && !isU && !isBoss) {
                            state.bricksLeft++;
                        }
                    } else {
                        state.bricks[c][r] = { active: false };
                    }
                }
            }
        }

        ui.score.textContent = state.score;
        ui.lives.textContent = state.lives;

        if (!state.launched) {
            ui.launchHintOverlay.classList.remove("d-none");
            ui.launchHintOverlay.classList.add("d-flex");
        }

        draw();
        state.running = true;
        update();
    });

    btn.menu.addEventListener("click", () => {
        state.running = false;
        cancelAnimationFrame(state.animId);
        ui.launchHintOverlay.classList.add("d-none");
        ui.launchHintOverlay.classList.remove("d-flex");
        ui.pauseOverlay.classList.remove("d-none");
        ui.pauseOverlay.classList.add("d-flex");
    });

    btn.resume.addEventListener("click", () => {
        ui.pauseOverlay.classList.add("d-none");
        ui.pauseOverlay.classList.remove("d-flex");
        state.running = true;
        if (!state.launched) {
            ui.launchHintOverlay.classList.remove("d-none");
            ui.launchHintOverlay.classList.add("d-flex");
        }
        update();
    });

    btn.homePause.addEventListener("click", () => {
        saveGame();
        goHome();
    });

    btn.selectLevel.addEventListener("click", () => {
        confirmAction(() => {
            localStorage.removeItem("BRICK_BREAKER_SAVE");
            checkContinueBtn();
            goHome();
            ui.homeActions.classList.add("d-none");
            ui.homeActions.classList.remove("d-flex");
            ui.levelSelectArea.classList.remove("d-none");
            ui.levelSelectArea.classList.add("d-flex");
        });
    });

    btn.exitPause.addEventListener("click", () => {
        saveGame();
        goHome();
    });

    btn.vicContinue.addEventListener("click", () => {
        ui.victoryOverlay.classList.add("d-none");
        ui.victoryOverlay.classList.remove("d-flex");

        if (state.level >= 6) {
            alert("Chúc mừng bạn đã xuất sắc phá đảo toàn bộ 6 màn chơi!");
            goHome();
            return;
        }

        const nextLevel = Math.min(6, state.level + 1);
        loadLevel(nextLevel, true);
    });

    btn.vicSelectLevel.addEventListener("click", () => {
        goHome();
        ui.homeActions.classList.add("d-none");
        ui.homeActions.classList.remove("d-flex");
        ui.levelSelectArea.classList.remove("d-none");
        ui.levelSelectArea.classList.add("d-flex");
    });

    btn.vicHome.addEventListener("click", goHome);

    btn.confirmReset.addEventListener("click", () => {
        if (modalInstance) modalInstance.hide();
        if (resetCallback) {
            resetCallback();
            resetCallback = null;
        }
    });

    btn.confirmExit.addEventListener("click", () => {
        saveGame();
        document.body.innerHTML = `<div class="text-center text-white p-5"><h2 class="text-warning">Cảm ơn bạn đã chơi!</h2><p>Tiến trình đã được lưu an toàn.</p></div>`;
    });

    const bgmSlider = document.getElementById("bgmSlider");
    if (bgmSlider) {
        bgmSlider.addEventListener("input", (e) => {
            state.bgmVol = e.target.value / 100;
        });
    }

    const sfxSlider = document.getElementById("sfxSlider");
    if (sfxSlider) {
        sfxSlider.addEventListener("input", (e) => {
            state.sfxVol = e.target.value / 100;
        });
    }
});