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
        vicHome: document.getElementById("btnVictoryHome"),
        prevPage: document.getElementById("btnPrevPage"),
        nextPage: document.getElementById("btnNextPage")
    };

    let tutCurrentPage = 1;

    const activeGameState = {
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

    const brickLayoutConfiguration = {
        rows: 12,
        cols: 15,
        bW: 30,
        bH: 10,
        pad: 5,
        top: 70,
        colors: ["#00a8ff", "#1e90ff", "#00f2fe", "#48dbfb", "#0abde3", "#70a1ff"]
    };
    brickLayoutConfiguration.left = (600 - (brickLayoutConfiguration.cols * (brickLayoutConfiguration.bW + brickLayoutConfiguration.pad) - brickLayoutConfiguration.pad)) / 2;

    function initAudio() {
        if (!activeGameState.audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) activeGameState.audioCtx = new AC();
        }
    }

    function playSound() {
        if (!activeGameState.audioCtx || activeGameState.sfxVol <= 0) return;
        try {
            const osc = activeGameState.audioCtx.createOscillator();
            const gain = activeGameState.audioCtx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(440, activeGameState.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, activeGameState.audioCtx.currentTime + 0.05);
            gain.gain.setValueAtTime(activeGameState.sfxVol, activeGameState.audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, activeGameState.audioCtx.currentTime + 0.05);
            osc.connect(gain);
            gain.connect(activeGameState.audioCtx.destination);
            osc.start();
            osc.stop(activeGameState.audioCtx.currentTime + 0.05);
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
            speed: activeGameState.ballSpeed,
            fireball: false
        };
    }

    function clearArea() {
        if (ui.playArea) ui.playArea.innerHTML = "";
    }

    function initPaddle() {
        activeGameState.paddle.el = createEl("div", {
            width: activeGameState.paddle.w + "px",
            height: activeGameState.paddle.h + "px",
            borderRadius: "6px",
            backgroundColor: "#00f2fe",
            transition: "width 0.2s"
        });
        ui.playArea.appendChild(activeGameState.paddle.el);
    }

    function initShield() {
        activeGameState.shield.el = createEl("div", {
            width: "600px",
            height: "10px",
            bottom: "10px",
            left: "0px",
            backgroundColor: "rgba(0, 210, 211, 0.7)",
            display: "none"
        });
        ui.playArea.appendChild(activeGameState.shield.el);
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
        const x = c * (brickLayoutConfiguration.bW + brickLayoutConfiguration.pad) + brickLayoutConfiguration.left;
        const y = r * (brickLayoutConfiguration.bH + brickLayoutConfiguration.pad) + brickLayoutConfiguration.top;
        const w = isBoss ? brickLayoutConfiguration.bW * 3 : brickLayoutConfiguration.bW;
        const h = isBoss ? brickLayoutConfiguration.bH * 2.5 : brickLayoutConfiguration.bH;

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

        activeGameState.bricks = [];
        activeGameState.items = [];
        activeGameState.balls = [];
        activeGameState.bullets = [];
        activeGameState.bossTimer = 0;
        activeGameState.bricksLeft = 0;
        activeGameState.paddle.w = 120;
        activeGameState.paddle.fireball = false;
        activeGameState.shield.active = false;
        activeGameState.cooldown = 0;

        for (let c = 0; c < brickLayoutConfiguration.cols; c++) {
            activeGameState.bricks[c] = [];
            for (let r = 0; r < brickLayoutConfiguration.rows; r++) {
                let hp = 1;
                let color = brickLayoutConfiguration.colors[r % brickLayoutConfiguration.colors.length];
                let isU = false;
                let isH = false;
                let isHideable = false;
                let isT = false;
                let isHealer = false;
                let isBoss = false;
                let active = true;

                if (activeGameState.level === 1) {
                    color = "#00f2fe";
                } else if (activeGameState.level === 2) {
                    const l2Cols = { 5: "#ff4757", 4: "#ffa502", 3: "#eccc68", 2: "#2ed573", 1: "#1e90ff" };
                    if (r < 2) hp = 5;
                    else if (r < 4) hp = 4;
                    else if (r < 7) hp = 3;
                    else if (r < 9) hp = 2;
                    else hp = 1;
                    color = l2Cols[hp];
                } else if (activeGameState.level === 3) {
                    if ((r === 4 || r === 8) && (c !== 2 && c !== 7 && c !== 12)) {
                        isU = true;
                        hp = -1;
                        color = "#7f8c8d";
                    }
                } else if (activeGameState.level === 4) {
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
                } else if (activeGameState.level === 5) {
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
                } else if (activeGameState.level === 6) {
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
                    activeGameState.bricks[c][r] = { active: false };
                    continue;
                }

                activeGameState.bricks[c][r] = createBrick(c, r, hp, isU, isH, isHideable, isT, false, isHealer, isBoss, color);

                if (!isU && !isBoss) {
                    activeGameState.bricksLeft++;
                }
            }
        }
    }

    function resetBall() {
        activeGameState.launched = false;
        activeGameState.paddle.fireball = false;

        activeGameState.balls.forEach(b => { if (b.el) b.el.remove(); });

        const b = newBall(activeGameState.paddle.x + activeGameState.paddle.w / 2, activeGameState.paddle.y - 9);
        initBall(b);
        activeGameState.balls = [b];

        if (activeGameState.running) {
            ui.launchHintOverlay.classList.remove("d-none");
            ui.launchHintOverlay.classList.add("d-flex");
        }
    }

    function launchBall() {
        if (!activeGameState.running || activeGameState.launched) return;

        activeGameState.launched = true;
        ui.launchHintOverlay.classList.add("d-none");
        ui.launchHintOverlay.classList.remove("d-flex");

        activeGameState.balls.forEach(b => {
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

        if (statBricks) statBricks.textContent = activeGameState.bricksLeft;
        if (statFireball) statFireball.textContent = activeGameState.paddle.fireball ? "Bật (⚡)" : "Tắt";
        if (statShield) statShield.textContent = activeGameState.shield.active ? `${Math.ceil(activeGameState.shield.time / 60)}s` : "Không";

        let hiScore = localStorage.getItem("BRICK_BREAKER_HIGH_SCORE") || 0;
        if (activeGameState.score > hiScore) {
            hiScore = activeGameState.score;
            localStorage.setItem("BRICK_BREAKER_HIGH_SCORE", hiScore);
        }
        if (statHighScore) statHighScore.textContent = hiScore;

        if (ui.buffList) {
            let buffsHtml = "";
            if (activeGameState.paddle.w > 120) buffsHtml += `<div class="text-warning">↔ Mở rộng thanh</div>`;
            if (activeGameState.paddle.fireball) buffsHtml += `<div class="text-danger">🔥 Bóng lửa</div>`;
            if (activeGameState.shield.active) buffsHtml += `<div class="text-info">🛡️ Khiên bảo vệ</div>`;
            if (activeGameState.balls.length > 1) buffsHtml += `<div class="text-success">🍒 Đa bóng (${activeGameState.balls.length})</div>`;

            ui.buffList.innerHTML = buffsHtml || `<span class="text-secondary fst-italic">Chưa có buff</span>`;
        }
    }

    function draw() {
        activeGameState.paddle.el.style.transform = `translate(${activeGameState.paddle.x}px, ${activeGameState.paddle.y}px)`;
        activeGameState.paddle.el.style.width = activeGameState.paddle.w + "px";
        activeGameState.paddle.el.style.backgroundColor = activeGameState.paddle.fireball ? "#ff4757" : "#00f2fe";

        if (activeGameState.shield.active && activeGameState.shield.time > 0) {
            activeGameState.shield.el.style.display = "block";
            const blink = activeGameState.shield.time < 180 && Math.floor(activeGameState.shield.time / 15) % 2 === 0;
            activeGameState.shield.el.style.opacity = blink ? "0.2" : "1";
        } else {
            activeGameState.shield.el.style.display = "none";
        }

        activeGameState.balls.forEach(b => {
            b.el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px)`;
            if (b.fireball) {
                b.el.style.backgroundColor = "#ff4757";
                b.el.style.boxShadow = "0 0 15px #ff4757";
            } else {
                b.el.style.backgroundColor = "#ffffff";
                b.el.style.boxShadow = "none";
            }
        });

        activeGameState.items.forEach(it => {
            it.el.style.transform = `translate(${it.x - it.w / 2}px, ${it.y - it.h / 2}px)`;
        });

        updateSidebar();
    }

    document.addEventListener("keydown", (e) => {
        if (["Right", "ArrowRight", "d", "D"].includes(e.key)) activeGameState.keys.right = true;
        if (["Left", "ArrowLeft", "a", "A"].includes(e.key)) activeGameState.keys.left = true;
    });

    document.addEventListener("keyup", (e) => {
        if (["Right", "ArrowRight", "d", "D"].includes(e.key)) activeGameState.keys.right = false;
        if (["Left", "ArrowLeft", "a", "A"].includes(e.key)) activeGameState.keys.left = false;
    });

    ui.playArea.addEventListener("mousemove", (e) => {
        if (!activeGameState.running) return;
        const rect = ui.playArea.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (600 / rect.width);

        if (mouseX > 0 && mouseX < 600) {
            activeGameState.paddle.x = Math.max(0, Math.min(600 - activeGameState.paddle.w, mouseX - activeGameState.paddle.w / 2));
            if (!activeGameState.launched && activeGameState.balls.length > 0) {
                activeGameState.balls[0].x = activeGameState.paddle.x + activeGameState.paddle.w / 2;
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

        if (activeGameState.balls.length <= 2) {
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

        activeGameState.items.push({
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
            if (activeGameState.cooldown > 0) return;
            activeGameState.cooldown = 60;
            const nextState = !b.isTOn;

            for (let c = 0; c < brickLayoutConfiguration.cols; c++) {
                for (let r = 0; r < brickLayoutConfiguration.rows; r++) {
                    const target = activeGameState.bricks[c][r];
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
            if (activeGameState.level === 2 || (activeGameState.level === 5 && !b.isHealer)) {
                const l2Cols = { 5: "#ff4757", 4: "#ffa502", 3: "#eccc68", 2: "#2ed573", 1: "#1e90ff" };
                b.el.style.backgroundColor = l2Cols[b.hp] || "#1e90ff";
            } else if (activeGameState.level === 5 && b.isHealer) {
                b.el.style.backgroundColor = "#fd79a8";
            } else if (activeGameState.level === 6 && b.isBoss) {
                b.el.style.backgroundColor = "#1a1a2e";
            }
            activeGameState.score += 5;
            ui.score.textContent = activeGameState.score;
            playSound();
        } else {
            b.active = false;
            b.el.remove();

            activeGameState.score += 10;
            ui.score.textContent = activeGameState.score;

            if (!b.isBoss) activeGameState.bricksLeft--;

            playSound();
            dropItem(b.x + (b.w || brickLayoutConfiguration.bW) / 2, b.y + (b.h || brickLayoutConfiguration.bH) / 2);

            let win = activeGameState.level === 6 ? b.isBoss : activeGameState.bricksLeft <= 0;

            if (win) {
                activeGameState.running = false;
                cancelAnimationFrame(activeGameState.animId);
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
        for (let c = 0; c < brickLayoutConfiguration.cols; c++) {
            for (let r = 0; r < brickLayoutConfiguration.rows; r++) {
                const b = activeGameState.bricks[c][r];
                if (b && b.active && b.cooldown > 0) b.cooldown--;
            }
        }

        activeGameState.balls.forEach(b => {
            let bounced = false;

            for (let c = 0; c < brickLayoutConfiguration.cols; c++) {
                for (let r = 0; r < brickLayoutConfiguration.rows; r++) {
                    const brick = activeGameState.bricks[c][r];

                    if (brick && brick.active && brick.cooldown <= 0 && !brick.isH) {
                        const bw = brick.w || brickLayoutConfiguration.bW;
                        const bh = brick.h || brickLayoutConfiguration.bH;

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
        for (let i = 0; i < activeGameState.items.length; i++) {
            const it = activeGameState.items[i];
            it.y += 1.5;

            const hitY = it.y + it.h / 2 > activeGameState.paddle.y && it.y - it.h / 2 < activeGameState.paddle.y + activeGameState.paddle.h;
            const hitX = it.x + it.w / 2 > activeGameState.paddle.x && it.x - it.w / 2 < activeGameState.paddle.x + activeGameState.paddle.w;

            if (hitY && hitX) {
                if (it.type === "expand") {
                    activeGameState.paddle.w = Math.min(240, activeGameState.paddle.w + 30);
                } else if (it.type === "life") {
                    if (activeGameState.lives < 5) {
                        activeGameState.lives++;
                        ui.lives.textContent = activeGameState.lives;
                    } else {
                        activeGameState.score += 50;
                        ui.score.textContent = activeGameState.score;
                    }
                } else if (it.type === "slow") {
                    activeGameState.balls.forEach(b => {
                        if (Math.hypot(b.vx, b.vy) > 2.5) {
                            b.vx *= 0.8;
                            b.vy *= 0.8;
                        }
                    });
                } else if (it.type === "split") {
                    const newBalls = [];
                    activeGameState.balls.forEach(b => {
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
                    activeGameState.balls = activeGameState.balls.concat(newBalls);
                } else if (it.type === "shoot") {
                    [-Math.PI / 2, -Math.PI / 2 - Math.PI / 6, -Math.PI / 2 + Math.PI / 6].forEach(a => {
                        const bullet = newBall(activeGameState.paddle.x + activeGameState.paddle.w / 2, activeGameState.paddle.y - 10);
                        bullet.vx = bullet.speed * Math.cos(a);
                        bullet.vy = bullet.speed * Math.sin(a);
                        initBall(bullet);
                        activeGameState.balls.push(bullet);
                    });
                } else if (it.type === "fireball") {
                    activeGameState.paddle.fireball = true;
                } else if (it.type === "shield") {
                    activeGameState.shield.active = true;
                    activeGameState.shield.time = 600;
                }

                playSound();
                it.el.remove();
                activeGameState.items.splice(i, 1);
                i--;
            } else if (it.y - it.h / 2 > 750) {
                it.el.remove();
                activeGameState.items.splice(i, 1);
                i--;
            }
        }
    }

    function update() {
        if (!activeGameState.running) return;

        if (activeGameState.shield.active) {
            activeGameState.shield.time--;
            if (activeGameState.shield.time <= 0) activeGameState.shield.active = false;
        }

        if (activeGameState.cooldown > 0) activeGameState.cooldown--;

        if (!activeGameState.launched) {
            if (activeGameState.balls.length > 0) {
                activeGameState.balls[0].x = activeGameState.paddle.x + activeGameState.paddle.w / 2;
                activeGameState.balls[0].y = activeGameState.paddle.y - activeGameState.balls[0].r;
            }
        } else {
            for (let i = activeGameState.balls.length - 1; i >= 0; i--) {
                const b = activeGameState.balls[i];

                function resetFireball() {
                    if (b.fireball) {
                        b.fireball = false;
                        b.speed = activeGameState.ballSpeed;
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
                } else if (b.y + b.vy > activeGameState.paddle.y - b.r) {
                    const hitPaddle = b.x > activeGameState.paddle.x && b.x < activeGameState.paddle.x + activeGameState.paddle.w;

                    if (hitPaddle) {
                        const rel = (b.x - (activeGameState.paddle.x + activeGameState.paddle.w / 2)) / (activeGameState.paddle.w / 2);
                        const angle = rel * (Math.PI / 3);

                        if (activeGameState.paddle.fireball && !b.fireball) {
                            b.fireball = true;
                            b.speed = activeGameState.ballSpeed * 3;
                            activeGameState.paddle.fireball = false;
                        }

                        b.vx = b.speed * Math.sin(angle);
                        b.vy = -b.speed * Math.cos(angle);
                        playSound();
                    } else if (b.y + b.vy > 750 - b.r) {
                        if (activeGameState.shield.active) {
                            b.vy = -b.vy;
                            b.y = 750 - b.r - 15;
                            activeGameState.shield.active = false;
                            playSound();
                        } else {
                            b.el.remove();
                            activeGameState.balls.splice(i, 1);
                        }
                    }
                }

                b.x += b.vx;
                b.y += b.vy;
            }

            if (activeGameState.balls.length === 0) {
                activeGameState.lives--;
                ui.lives.textContent = activeGameState.lives;

                if (activeGameState.lives <= 0) {
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

            if (activeGameState.level === 5) {
                const badge = document.getElementById("healerHudBadge");
                const timer = document.getElementById("healerTimerDisplay");
                if (badge) badge.classList.remove("d-none");

                for (let c = 0; c < brickLayoutConfiguration.cols; c++) {
                    for (let r = 0; r < brickLayoutConfiguration.rows; r++) {
                        const core = activeGameState.bricks[c][r];
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

                                        if (nc >= 0 && nc < brickLayoutConfiguration.cols && nr >= 0 && nr < brickLayoutConfiguration.rows) {
                                            const target = activeGameState.bricks[nc][nr];
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

            if (activeGameState.level === 6) {
                const badge = document.getElementById("bossHudBadge");
                const bossHp = document.getElementById("bossHpDisplay");
                if (badge) badge.classList.remove("d-none");

                let bX = 300, bY = 100, bAlive = false;

                for (let c = 0; c < brickLayoutConfiguration.cols; c++) {
                    for (let r = 0; r < brickLayoutConfiguration.rows; r++) {
                        const b = activeGameState.bricks[c][r];
                        if (b && b.active && b.isBoss) {
                            bAlive = true;
                            bX = b.x + (b.w || brickLayoutConfiguration.bW) / 2;
                            bY = b.y + (b.h || brickLayoutConfiguration.bH);
                            if (bossHp) bossHp.textContent = b.hp;
                        }
                    }
                }

                if (bAlive) {
                    activeGameState.bossTimer++;
                    if (activeGameState.bossTimer >= 300) {
                        activeGameState.bossTimer = 0;

                        const bullet = createEl("div", {
                            width: "8px",
                            height: "16px",
                            backgroundColor: "#ff4757",
                            borderRadius: "4px",
                            boxShadow: "0 0 8px #ff4757"
                        });
                        ui.playArea.appendChild(bullet);

                        activeGameState.bullets.push({ x: bX, y: bY, vy: 2.0, el: bullet });
                    }
                }

                for (let i = activeGameState.bullets.length - 1; i >= 0; i--) {
                    const p = activeGameState.bullets[i];
                    p.y += p.vy;
                    p.el.style.transform = `translate(${p.x - 4}px, ${p.y}px)`;

                    const hitY = p.y + 16 >= activeGameState.paddle.y && p.y <= activeGameState.paddle.y + activeGameState.paddle.h;
                    const hitX = p.x + 8 >= activeGameState.paddle.x && p.x <= activeGameState.paddle.x + activeGameState.paddle.w;

                    if (hitY && hitX) {
                        p.el.remove();
                        activeGameState.bullets.splice(i, 1);

                        if (!activeGameState.shield.active) {
                            activeGameState.lives--;
                            ui.lives.textContent = activeGameState.lives;
                            playSound();

                            if (activeGameState.lives <= 0) {
                                localStorage.removeItem("BRICK_BREAKER_SAVE");
                                checkContinueBtn();
                                goHome();
                                return;
                            }
                        } else {
                            activeGameState.shield.active = false;
                        }
                    } else if (p.y > 750) {
                        p.el.remove();
                        activeGameState.bullets.splice(i, 1);
                    }
                }
            } else {
                const badge = document.getElementById("bossHudBadge");
                if (badge) badge.classList.add("d-none");

                activeGameState.bullets.forEach(p => p.el.remove());
                activeGameState.bullets = [];
            }
        }

        if (activeGameState.keys.right && activeGameState.paddle.x < 600 - activeGameState.paddle.w) {
            activeGameState.paddle.x += activeGameState.paddle.speed;
            if (!activeGameState.launched && activeGameState.balls.length > 0) {
                activeGameState.balls[0].x = activeGameState.paddle.x + activeGameState.paddle.w / 2;
            }
        } else if (activeGameState.keys.left && activeGameState.paddle.x > 0) {
            activeGameState.paddle.x -= activeGameState.paddle.speed;
            if (!activeGameState.launched && activeGameState.balls.length > 0) {
                activeGameState.balls[0].x = activeGameState.paddle.x + activeGameState.paddle.w / 2;
            }
        }

        draw();

        if (activeGameState.running) {
            activeGameState.animId = requestAnimationFrame(update);
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
        activeGameState.running = false;
        cancelAnimationFrame(activeGameState.animId);

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
            ui.leftSidebar.classList.remove("d-none");
        }
        if (ui.rightSidebar) {
            ui.rightSidebar.classList.remove("d-none");
        }

        initLevel();
        resetBall();
        draw();
        checkContinueBtn();
    }

    function updateTutorialPages() {
        const pageIndicator = document.getElementById("pageIndicator");
        const tutPage1 = document.getElementById("tutPage1");
        const tutPage2 = document.getElementById("tutPage2");

        if (tutCurrentPage === 1) {
            if (tutPage1) tutPage1.classList.remove("d-none");
            if (tutPage2) tutPage2.classList.add("d-none");
            if (btn.prevPage) { btn.prevPage.classList.add("disabled"); btn.prevPage.setAttribute("disabled", "true"); }
            if (btn.nextPage) btn.nextPage.classList.remove("d-none");
            if (btn.startGame) btn.startGame.classList.add("d-none");
            if (pageIndicator) pageIndicator.textContent = "Trang 1/2";
        } else {
            if (tutPage1) tutPage1.classList.add("d-none");
            if (tutPage2) tutPage2.classList.remove("d-none");
            if (btn.prevPage) { btn.prevPage.classList.remove("disabled"); btn.prevPage.removeAttribute("disabled"); }
            if (btn.nextPage) btn.nextPage.classList.add("d-none");
            if (btn.startGame) btn.startGame.classList.remove("d-none");
            if (pageIndicator) pageIndicator.textContent = "Trang 2/2";
        }
    }

    if (btn.nextPage) {
        btn.nextPage.addEventListener("click", () => {
            tutCurrentPage = 2;
            updateTutorialPages();
        });
    }

    if (btn.prevPage) {
        btn.prevPage.addEventListener("click", () => {
            tutCurrentPage = 1;
            updateTutorialPages();
        });
    }

    function loadLevel(lvl, keepScore = false) {
        activeGameState.level = lvl;
        if (!keepScore) activeGameState.score = 0;
        activeGameState.lives = 3;
        ui.score.textContent = activeGameState.score;
        ui.lives.textContent = activeGameState.lives;

        if (ui.level) ui.level.textContent = `MÀN ${activeGameState.level}`;

        const tutorials = {
            1: {
                title: "MÀN 1: GẠCH CƠ BẢN",
                p1: "👉 <strong>Cơ chế:</strong> Toàn bộ các khối gạch vỡ ngay sau 1 lần va chạm.<br>🕹️ <strong>Điều khiển:</strong> Dùng chuột hoặc phím mũi tên Trái/Phải để di chuyển thanh đỡ.",
                p2: "💡 <strong>Mẹo nhỏ:</strong> Hãy cố gắng đón bóng ở các góc nghiêng của thanh đỡ, sử dụng các vật phẩm rơi ra khi phá gạch và dành chiến thắng!"
            },
            2: {
                title: "MÀN 2: GẠCH NHIỀU MÁU",
                p1: "👉 <strong>Cơ chế:</strong> Gạch có nhiều lớp máu cứng hơn.<br>🎨 <strong>Màu sắc:</strong> Đỏ (5 HP) ➔ Cam (4 HP) ➔ Vàng (3 HP) ➔ Xanh Lá (2 HP) ➔ Xanh Dương (1 HP).",
                p2: "💡 <strong>Mẹo nhỏ:</strong> Điều khiển thang chắn ưu tiên tiêu diệt các khối ít máu nhất. Tận dụng các vật phẩm tăng sức mạnh rớt ra để dọn dẹp các hàng gạch dày nhanh chóng!"
            },
            3: {
                title: "MÀN 3: GẠCH THANH CHẮN",
                p1: "👉 <strong>Cơ chế:</strong> Xuất hiện các khối thanh chắn kim loại xám vĩnh cửu không thể bị phá hủy bật lại những quả bóng chạm vào." +
                    "<br><br>" +
                    " <span class='text-danger'><strong>Lưu ý:</strong> Khi sử dụng vật phẩm bóng lửa (fire ball), bóng sẽ bị bật lại khá nhanh khi bóng tiếp xúc với thanh chắn kim loại. Hãy tính toán thật kỹ trước khi sử dụng!",
                p2: "💡 <strong>Mẹo nhỏ:</strong> Phải căn góc bắn thật khéo léo để đưa bóng lách qua các khoảng hở giữa thanh chắn. Tận dụng hợp lý các vật phẩm rơi ra và giành lấy chiến thắng!"
            },
            4: {
                title: "MÀN 4: GẠCH BỊ ẨN",
                p1: "👉 <strong>Cơ chế:</strong> Các khối gạch xanh bị tàng hình. Bạn cần va chạm vào Nút Công Tắc màu cam để bật/tắt hiển thị gạch."+
                    "<br><br>" +
                    "<span class='text-danger'><strong>Lưu ý:</strong> Lần đầu tiên bạn cần để bóng chạm vào nút kích hoạt 2 lần để hiện khối( đây không phải lỗi, đây là tính năng).Các khối gạch sẽ biến mất lần nữa nếu bạn tái kích hoạt nút",
                p2: "💡 <strong>Mẹo nhỏ:</strong> Đừng lo lắng, các khối gạch sẽ hiện lại lần nữa nếu bạn kích hoạt nút mà không reset lại từ đầu. Hãy sử dụng các vật phẩm hợp lý để dành chiến thắng!" +
                    "<br><br>" +
                    "<span class='text-danger'><strong>Lưu ý:</strong> Bạn có thể sử dụng vật phẩm nhân 3 bóng hoặc bắn ra 3 bóng, nó có thể giúp bạn thắng nhanh hơn nhưng cũng có thể làm các khối ẩn bật tắt liên tục gây khá ức chế. Nó sẽ là 1 canh bạc nếu bạn không tính toán đầy đủ. Hãy né nếu bạn không muốn bị loạn còn không thì (bạn hiểu ý tôi mà 😏). </span>",
            },
            5: {
                title: "MÀN 5: GẠCH HỒI PHỤC",
                p1: "👉 <strong>Cơ chế:</strong> Có 3 khối Lõi Hồi Phục màu hồng. Lõi sẽ bơm thêm HP cho gạch xung quanh theo chu kỳ đếm ngược (khoảng 60s). Các khối xung quanh lõi sẽ có máu lần lượt 3 máu(vàng), 2 máu(xanh lá) và cuối cùng là 1 máu(xanh dương) nếu không phá hết các khối quanh lõi sẽ hồi phục dần dần qua thời gian tối đa là 3 máu.",
                p2: "💡 <strong>Mẹo nhỏ:</strong> Hãy ưu tiên đưa bóng tiêu diệt các khối 1 máu xung quanh, sử dụng vật phẩm và phá hủy lõi 1 cách nhanh nhất!"
            },
            6: {
                title: "MÀN 6: GẠCH BOSS",
                p1: "👉 <strong>Cơ chế:</strong> Đối đầu với Trùm Khổng Lồ (30 HP) được bảo vệ bởi các khối con xung quanh và khối thanh chắn ở bên dưới. Trùm sẽ tự động bắn đạn đe dọa thanh đỡ của bạn, bạn sẽ mất hp nếu thanh chắn của bạn bị trúng đòn!"+
                    "<br><br>" +
                    "<span class='text-danger'><strong>Lưu ý:</strong> Hãy hạn chế sử dụng vật phẩm mở rộng thanh đỡ nếu bạn không muốn bị hạn chế khả năng di chuyển!",
                p2: "💡 <strong>Mẹo nhỏ:</strong> Đầu game hãy ưu tiên hạ gục các khối con xung quanh, nhặt vật phẩm. Di chuyển liên tục để né đạn. Tiêu diệt Trùm là bạn sẽ lập tức Chiến Thắng!"
            }
        };

        const currentTut = tutorials[lvl] || tutorials[1];
        const titleEl = document.getElementById("tutorialTitle");
        const desc1 = document.getElementById("tutorialDesc1");
        const desc2 = document.getElementById("tutorialDesc2");

        if (titleEl) titleEl.textContent = currentTut.title;
        if (desc1) desc1.innerHTML = currentTut.p1;
        if (desc2) desc2.innerHTML = currentTut.p2;

        tutCurrentPage = 1;
        updateTutorialPages();

        activeGameState.paddle.x = 240;
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
        if (!activeGameState.bricks || activeGameState.bricksLeft <= 0) return;

        const matrix = [];
        for (let c = 0; c < brickLayoutConfiguration.cols; c++) {
            matrix[c] = [];
            for (let r = 0; r < brickLayoutConfiguration.rows; r++) {
                let val = 0;
                const b = activeGameState.bricks[c][r];
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
            level: activeGameState.level,
            score: activeGameState.score,
            lives: activeGameState.lives,
            paddleX: activeGameState.paddle.x,
            paddleY: 705,
            isLaunched: activeGameState.launched,
            savedBalls: activeGameState.balls.map(b => ({
                posX: b.x > 0 ? b.x : activeGameState.paddle.x + 60,
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
        activeGameState.running = true;
        resetBall();
        update();
    });

    btn.continueGame.addEventListener("click", () => {
        initAudio();
        const raw = localStorage.getItem("BRICK_BREAKER_SAVE");
        if (!raw) return;

        const data = JSON.parse(raw);
        activeGameState.level = data.level || 1;
        if (ui.level) ui.level.textContent = `MÀN ${activeGameState.level}`;

        expandGameUI();
        activeGameState.score = data.score;
        activeGameState.lives = data.lives;
        activeGameState.paddle.x = data.paddleX;
        activeGameState.paddle.y = 705;
        activeGameState.launched = data.isLaunched;

        clearArea();
        initPaddle();
        initShield();
        activeGameState.balls = [];
        activeGameState.items = [];
        activeGameState.bullets = [];
        activeGameState.bossTimer = 0;
        activeGameState.shield.active = false;
        activeGameState.paddle.fireball = false;
        activeGameState.paddle.w = 120;

        data.savedBalls.forEach(sb => {
            const b = newBall(sb.posX > 0 ? sb.posX : activeGameState.paddle.x + 60, sb.posY > 0 ? sb.posY : 690);
            b.vx = sb.velX;
            b.vy = sb.velY;
            b.speed = sb.speed;
            b.fireball = sb.isRed;
            initBall(b);
            activeGameState.balls.push(b);
        });

        let hasValid = false;
        if (data.brickMatrix) {
            for (let c = 0; c < brickLayoutConfiguration.cols; c++) {
                for (let r = 0; r < brickLayoutConfiguration.rows; r++) {
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
            activeGameState.bricks = [];
            activeGameState.bricksLeft = 0;

            for (let c = 0; c < brickLayoutConfiguration.cols; c++) {
                activeGameState.bricks[c] = [];
                for (let r = 0; r < brickLayoutConfiguration.rows; r++) {
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
                    let col = brickLayoutConfiguration.colors[r % brickLayoutConfiguration.colors.length];

                    if (activeGameState.level === 1) {
                        col = "#00f2fe";
                    } else if (activeGameState.level === 2 || activeGameState.level === 5) {
                        const l2Cols = { 5: "#ff4757", 4: "#ffa502", 3: "#eccc68", 2: "#2ed573", 1: "#1e90ff" };
                        col = l2Cols[hp] || "#1e90ff";
                    } else if (activeGameState.level === 4) {
                        isHideable = true;
                        col = "#1dd1a1";
                    } else if (activeGameState.level === 6) {
                        if (r === 3 && c === 6) {
                            isBoss = true;
                            col = "#1a1a2e";
                        }
                    }

                    if (activeGameState.level === 5) {
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

                        activeGameState.bricks[c][r] = createBrick(c, r, hp, isU, isH, isHideable, isT, isTOn, isHealer, isBoss, col);

                        if (active && !isU && !isBoss) {
                            activeGameState.bricksLeft++;
                        }
                    } else {
                        activeGameState.bricks[c][r] = { active: false };
                    }
                }
            }
        }

        ui.score.textContent = activeGameState.score;
        ui.lives.textContent = activeGameState.lives;

        if (!activeGameState.launched) {
            ui.launchHintOverlay.classList.remove("d-none");
            ui.launchHintOverlay.classList.add("d-flex");
        }

        draw();
        activeGameState.running = true;
        update();
    });

    btn.menu.addEventListener("click", () => {
        activeGameState.running = false;
        cancelAnimationFrame(activeGameState.animId);
        ui.launchHintOverlay.classList.add("d-none");
        ui.launchHintOverlay.classList.remove("d-flex");
        ui.pauseOverlay.classList.remove("d-none");
        ui.pauseOverlay.classList.add("d-flex");
    });

    btn.resume.addEventListener("click", () => {
        ui.pauseOverlay.classList.add("d-none");
        ui.pauseOverlay.classList.remove("d-flex");
        activeGameState.running = true;
        if (!activeGameState.launched) {
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

        if (activeGameState.level >= 6) {
            alert("Chúc mừng bạn đã xuất sắc phá đảo toàn bộ 6 màn chơi!");
            goHome();
            return;
        }

        const nextLevel = Math.min(6, activeGameState.level + 1);
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
            activeGameState.bgmVol = e.target.value / 100;
        });
    }

    const sfxSlider = document.getElementById("sfxSlider");
    if (sfxSlider) {
        sfxSlider.addEventListener("input", (e) => {
            activeGameState.sfxVol = e.target.value / 100;
        });
    }
});