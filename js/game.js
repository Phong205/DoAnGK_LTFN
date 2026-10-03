document.addEventListener("DOMContentLoaded", () => {
    const mainHeader = document.getElementById("mainHeader");
    const homeActions = document.getElementById("homeActions");
    const levelSelectArea = document.getElementById("levelSelectArea");
    const gameHud = document.getElementById("gameHud");
    const screenWrapper = document.getElementById("screenWrapper");

    const homeOverlay = document.getElementById("homeOverlay");
    const launchHintOverlay = document.getElementById("launchHintOverlay");
    const tutorialOverlay = document.getElementById("tutorialOverlay");
    const pauseOverlay = document.getElementById("pauseOverlay");
    const victoryOverlay = document.getElementById("victoryOverlay");

    const btnNewGame = document.getElementById("btnNewGame");
    const btnContinue = document.getElementById("btnContinue");
    const btnBackToHome = document.getElementById("btnBackToHome");
    const btnStartGameplay = document.getElementById("btnStartGameplay");
    const btnGameMenu = document.getElementById("btnGameMenu");
    const btnResumeGame = document.getElementById("btnResumeGame");
    const btnSelectLevelFromPause = document.getElementById("btnSelectLevelFromPause");
    const btnHomeFromPause = document.getElementById("btnHomeFromPause");
    const btnExitFromPause = document.getElementById("btnExitFromPause");
    const btnConfirmExit = document.getElementById("btnConfirmExit");
    const btnConfirmReset = document.getElementById("btnConfirmReset");

    const btnVictoryContinue = document.getElementById("btnVictoryContinue");
    const btnVictorySelectLevel = document.getElementById("btnVictorySelectLevel");
    const btnVictoryHome = document.getElementById("btnVictoryHome");

    const hudScore = document.getElementById("hudScore");
    const hudLives = document.getElementById("hudLives");
    const hudLevel = document.getElementById("hudLevel");

    const tutorialTitle = document.getElementById("tutorialTitle");
    const tutorialDesc = document.getElementById("tutorialDesc");

    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

    let confirmResetModalInstance = null;
    const confirmModalEl = document.getElementById("confirmResetModal");
    if (confirmModalEl && typeof bootstrap !== "undefined") {
        confirmResetModalInstance = new bootstrap.Modal(confirmModalEl);
    }

    let audioCtx = null;
    let sfxVolume = 0.7;

    function initAudio() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) audioCtx = new AudioContextClass();
        }
    }

    function playHitSound() {
        if (!audioCtx || sfxVolume <= 0) return;
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.05);
            gain.gain.setValueAtTime(sfxVolume, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.05);
        } catch (e) {
        }
    }

    let currentLevel = 1;
    let isPlaying = false;
    let isBallLaunched = false;
    let animationId = null;
    let score = 0;
    let lives = 3;
    let bricksToBreak = 0;

    const BALL_SPEED = 4.2;

    const paddle = {
        width: 120,
        height: 16,
        x: 600 / 2 - 60,
        y: 750 - 45,
        speed: 7.5
    };

    let balls = [];
    let items = [];
    let bullets = [];
    let shield = {active: false, timer: 0};
    let paddleFireballBuff = false;

    const brickRowCount = 12;
    const brickColumnCount = 15;
    const brickWidth = 30;
    const brickHeight = 10;
    const brickPadding = 5;
    const brickOffsetTop = 70;
    const brickOffsetLeft = (600 - (brickColumnCount * (brickWidth + brickPadding) - brickPadding)) / 2;

    let bricks = [];

    function initBricks(level) {
        bricks = [];
        items = [];
        bullets = [];
        paddle.width = 120;
        shield.active = false;
        paddleFireballBuff = false;
        bricksToBreak = 0;

        const colors = ["#00a8ff", "#1e90ff", "#00f2fe", "#48dbfb", "#0abde3", "#70a1ff"];

        for (let c = 0; c < brickColumnCount; c++) {
            bricks[c] = [];
            for (let r = 0; r < brickRowCount; r++) {
                bricks[c][r] = {
                    x: c * (brickWidth + brickPadding) + brickOffsetLeft,
                    y: r * (brickHeight + brickPadding) + brickOffsetTop,
                    status: 1,
                    color: colors[r % colors.length]
                };
                bricksToBreak++;
            }
        }
    }

    function createInitialBall() {
        return {
            x: paddle.x + paddle.width / 2,
            y: paddle.y - 9,
            radius: 9,
            dx: 0,
            dy: 0,
            speed: BALL_SPEED,
            isFireball: false
        };
    }

    function resetBallOnPaddle() {
        isBallLaunched = false;
        balls = [createInitialBall()];
        bullets = [];
        shield.active = false;
        paddleFireballBuff = false;
        if (isPlaying) {
            launchHintOverlay.classList.remove("d-none");
            launchHintOverlay.classList.add("d-flex");
        }
    }

    function launchBall() {
        if (!isPlaying || isBallLaunched) return;
        isBallLaunched = true;
        launchHintOverlay.classList.add("d-none");
        launchHintOverlay.classList.remove("d-flex");

        balls.forEach(ball => {
            const angle = (Math.PI / 4) + (Math.random() * (Math.PI / 2));
            ball.dx = ball.speed * Math.cos(angle) * (Math.random() < 0.5 ? -1 : 1);
            ball.dy = -Math.abs(ball.speed * Math.sin(angle));
        });
    }

    function drawPaddle() {
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 6);
        } else {
            ctx.rect(paddle.x, paddle.y, paddle.width, paddle.height);
        }
        ctx.fillStyle = paddleFireballBuff ? "#ff4757" : "#00f2fe";
        ctx.fill();
        ctx.closePath();
    }

    function drawBalls() {
        balls.forEach(ball => {
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.fillStyle = ball.isFireball ? "#ff4757" : "#ffffff";
            if (ball.isFireball) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = "#ff4757";
            }
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.closePath();
        });
    }

    function drawBullets() {
        bullets.forEach(b => {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fillStyle = "#feca57";
            ctx.fill();
            ctx.closePath();
        });
    }

    function drawShield() {
        if (shield.active && shield.timer > 0) {
            ctx.beginPath();
            ctx.rect(0, canvas.height - 10, canvas.width, 10);
            if (shield.timer < 180 && Math.floor(shield.timer / 15) % 2 === 0) {
                ctx.fillStyle = "rgba(0, 210, 211, 0.2)";
            } else {
                ctx.fillStyle = "rgba(0, 210, 211, 0.7)";
            }
            ctx.fill();
            ctx.closePath();
        }
    }

    function drawItems() {
        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(item.x - item.width / 2, item.y - item.height / 2, item.width, item.height, 4);
            } else {
                ctx.rect(item.x - item.width / 2, item.y - item.height / 2, item.width, item.height);
            }
            ctx.fillStyle = item.color;
            ctx.fill();

            ctx.fillStyle = "white";
            ctx.font = "14px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(item.icon, item.x, item.y + 1);
            ctx.closePath();
        }
    }

    function drawBricks() {
        for (let c = 0; c < brickColumnCount; c++) {
            for (let r = 0; r < brickRowCount; r++) {
                const b = bricks[c][r];
                if (b && b.status === 1) {
                    ctx.beginPath();
                    ctx.rect(b.x, b.y, brickWidth, brickHeight);
                    ctx.fillStyle = b.color;
                    ctx.fill();

                    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.closePath();
                }
            }
        }
    }

    function renderScene() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawShield();
        drawBricks();
        drawItems();
        drawPaddle();
        drawBalls();
    }

    initBricks(currentLevel);
    resetBallOnPaddle();
    renderScene();

    let rightPressed = false;
    let leftPressed = false;

    document.addEventListener("keydown", (e) => {
        if (e.key === "Right" || e.key === "ArrowRight" || e.key === "d" || e.key === "D") rightPressed = true;
        if (e.key === "Left" || e.key === "ArrowLeft" || e.key === "a" || e.key === "A") leftPressed = true;
    });

    document.addEventListener("keyup", (e) => {
        if (e.key === "Right" || e.key === "ArrowRight" || e.key === "d" || e.key === "D") rightPressed = false;
        if (e.key === "Left" || e.key === "ArrowLeft" || e.key === "a" || e.key === "A") leftPressed = false;
    });

    canvas.addEventListener("mousemove", (e) => {
        if (!isPlaying) return;
        const rect = canvas.getBoundingClientRect();
        const relativeX = (e.clientX - rect.left) * (canvas.width / rect.width);
        if (relativeX > 0 && relativeX < canvas.width) {
            paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, relativeX - paddle.width / 2));
            if (!isBallLaunched && balls.length > 0) {
                balls[0].x = paddle.x + paddle.width / 2;
            }
        }
    });

    canvas.addEventListener("click", () => {
        launchBall();
    });

    function breakBrick(b) {
        b.status = 0;
        score += 10;
        hudScore.textContent = score;
        playHitSound();
        bricksToBreak--;

        if (Math.random() < 0.25) {
            const types = [
                {type: "expand", color: "#2ed573", icon: "↔️"},
                {type: "life", color: "#ff4757", icon: "❤️"},
                {type: "slow", color: "#1e90ff", icon: "🐢"},
                {type: "fireball", color: "#ff9f43", icon: "🔥"},
                {type: "shield", color: "#00d2d3", icon: "🛡️"}
            ];
            if (balls.length <= 2) {
                types.push({type: "split", color: "#f368e0", icon: "🔱"});
                types.push({type: "shoot", color: "#feca57", icon: "🔫"});
            }
            const randomItem = types[Math.floor(Math.random() * types.length)];
            items.push({
                x: b.x + brickWidth / 2,
                y: b.y + brickHeight / 2,
                width: 24,
                height: 24,
                type: randomItem.type,
                color: randomItem.color,
                icon: randomItem.icon
            });
        }

        if (bricksToBreak === 0) {
            isPlaying = false;
            cancelAnimationFrame(animationId);
            localStorage.removeItem("BRICK_BREAKER_SAVE");
            checkSavedGame();
            launchHintOverlay.classList.add("d-none");
            launchHintOverlay.classList.remove("d-flex");
            victoryOverlay.classList.remove("d-none");
            victoryOverlay.classList.add("d-flex");
        }
    }

    function updateItems() {
        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            item.y += 1.5;

            if (
                item.y + item.height / 2 > paddle.y &&
                item.y - item.height / 2 < paddle.y + paddle.height &&
                item.x + item.width / 2 > paddle.x &&
                item.x - item.width / 2 < paddle.x + paddle.width
            ) {
                if (item.type === "expand") {
                    paddle.width = Math.min(240, paddle.width + 30);
                } else if (item.type === "life") {
                    if (lives < 5) {
                        lives++;
                        hudLives.textContent = lives;
                    } else {
                        score += 50;
                        hudScore.textContent = score;
                    }
                }else if (item.type === "slow") {
                    balls.forEach(b => {
                        const currentSpeed = Math.hypot(b.dx, b.dy);
                        if (currentSpeed > 2.5) {
                            b.dx *= 0.8;
                            b.dy *= 0.8;
                        }
                    });
                } else if (item.type === "split") {
                    let newBalls = [];
                    balls.forEach(b => {
                        let speed = b.speed || BALL_SPEED;
                        let angle = Math.atan2(b.dy, b.dx);
                        let a1 = angle + Math.PI / 6;
                        let a2 = angle - Math.PI / 6;
                        newBalls.push({...b, dx: speed * Math.cos(a1), dy: speed * Math.sin(a1)});
                        newBalls.push({...b, dx: speed * Math.cos(a2), dy: speed * Math.sin(a2)});
                    });
                    balls = balls.concat(newBalls);
                } else if (item.type === "shoot") {
                    let speed = BALL_SPEED;
                    let angle1 = -Math.PI / 2;
                    let angle2 = -Math.PI / 2 - Math.PI / 6;
                    let angle3 = -Math.PI / 2 + Math.PI / 6;

                    balls.push({
                        x: paddle.x + paddle.width / 2,
                        y: paddle.y - 10,
                        radius: 9,
                        dx: speed * Math.cos(angle1),
                        dy: speed * Math.sin(angle1),
                        speed: speed,
                        isFireball: false
                    });
                    balls.push({
                        x: paddle.x + paddle.width / 2,
                        y: paddle.y - 10,
                        radius: 9,
                        dx: speed * Math.cos(angle2),
                        dy: speed * Math.sin(angle2),
                        speed: speed,
                        isFireball: false
                    });
                    balls.push({
                        x: paddle.x + paddle.width / 2,
                        y: paddle.y - 10,
                        radius: 9,
                        dx: speed * Math.cos(angle3),
                        dy: speed * Math.sin(angle3),
                        speed: speed,
                        isFireball: false
                    });
                } else if (item.type === "fireball") {
                    paddleFireballBuff = true;
                } else if (item.type === "shield") {
                    shield.active = true;
                    shield.timer = 600;
                }

                playHitSound();
                items.splice(i, 1);
                i--;
            } else if (item.y - item.height / 2 > canvas.height) {
                items.splice(i, 1);
                i--;
            }
        }
    }

    function collisionDetection() {
        for (let i = bullets.length - 1; i >= 0; i--) {
            let bullet = bullets[i];
            let bulletHit = false;
            for (let c = 0; c < brickColumnCount; c++) {
                for (let r = 0; r < brickRowCount; r++) {
                    const b = bricks[c][r];
                    if (b && b.status === 1) {
                        if (
                            bullet.x + bullet.radius > b.x &&
                            bullet.x - bullet.radius < b.x + brickWidth &&
                            bullet.y + bullet.radius > b.y &&
                            bullet.y - bullet.radius < b.y + brickHeight
                        ) {
                            breakBrick(b);
                            bulletHit = true;
                            break;
                        }
                    }
                }
                if (bulletHit) break;
            }
            if (bulletHit) bullets.splice(i, 1);
        }

        balls.forEach(ball => {
            let hasBounced = false;
            for (let c = 0; c < brickColumnCount; c++) {
                for (let r = 0; r < brickRowCount; r++) {
                    const b = bricks[c][r];
                    if (b && b.status === 1) {
                        if (
                            ball.x + ball.radius > b.x &&
                            ball.x - ball.radius < b.x + brickWidth &&
                            ball.y + ball.radius > b.y &&
                            ball.y - ball.radius < b.y + brickHeight
                        ) {
                            if (!ball.isFireball && !hasBounced) {
                                ball.dy = -ball.dy;
                                hasBounced = true;
                            }
                            breakBrick(b);
                        }
                    }
                }
            }
        });
    }

    function gameLoop() {
        if (!isPlaying) return;

        if (shield.active) {
            shield.timer--;
            if (shield.timer <= 0) shield.active = false;
        }

        if (!isBallLaunched) {
            if (balls.length > 0) {
                balls[0].x = paddle.x + paddle.width / 2;
                balls[0].y = paddle.y - balls[0].radius;
            }
        } else {
            for (let i = balls.length - 1; i >= 0; i--) {
                let ball = balls[i];

                const removeFireball = () => {
                    if (ball.isFireball) {
                        ball.isFireball = false;
                        ball.speed = BALL_SPEED;
                        const angle = Math.atan2(ball.dy, ball.dx);
                        ball.dx = ball.speed * Math.cos(angle);
                        ball.dy = ball.speed * Math.sin(angle);
                    }
                };

                if (ball.x + ball.dx > canvas.width - ball.radius || ball.x + ball.dx < ball.radius) {
                    ball.dx = -ball.dx;
                    playHitSound();
                }

                if (ball.y + ball.dy < ball.radius) {
                    ball.dy = -ball.dy;
                    playHitSound();
                    removeFireball();
                }

                else if (ball.y + ball.dy > paddle.y - ball.radius) {
                    if (ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
                        const hitPoint = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
                        const maxBounceAngle = Math.PI / 3;
                        const bounceAngle = hitPoint * maxBounceAngle;

                        if (paddleFireballBuff && !ball.isFireball) {
                            ball.isFireball = true;
                            ball.speed = BALL_SPEED * 3;
                            paddleFireballBuff = false;
                        }

                        ball.dx = ball.speed * Math.sin(bounceAngle);
                        ball.dy = -ball.speed * Math.cos(bounceAngle);
                        playHitSound();
                    } else if (ball.y + ball.dy > canvas.height - ball.radius) {
                        if (shield.active) {
                            ball.dy = -ball.dy;
                            ball.y = canvas.height - ball.radius - 15;
                            shield.active = false;
                            playHitSound();
                        } else {
                            balls.splice(i, 1);
                        }
                    }
                }

                ball.x += ball.dx;
                ball.y += ball.dy;
            }

            if (balls.length === 0) {
                lives--;
                hudLives.textContent = lives;
                if (lives <= 0) {
                    localStorage.removeItem("BRICK_BREAKER_SAVE");
                    checkSavedGame();
                    switchToHomeScreen();
                    return;
                } else {
                    resetBallOnPaddle();
                }
            }

            collisionDetection();
            updateItems();
        }

        if (rightPressed && paddle.x < canvas.width - paddle.width) {
            paddle.x += paddle.speed;
            if (!isBallLaunched && balls.length > 0) balls[0].x = paddle.x + paddle.width / 2;
        } else if (leftPressed && paddle.x > 0) {
            paddle.x -= paddle.speed;
            if (!isBallLaunched && balls.length > 0) balls[0].x = paddle.x + paddle.width / 2;
        }

        renderScene();
        if (isPlaying) {
            animationId = requestAnimationFrame(gameLoop);
        }
    }
    function expandGameScreen() {
        mainHeader.classList.add("d-none");
        homeActions.classList.add("d-none");
        homeActions.classList.remove("d-flex");
        levelSelectArea.classList.add("d-none");
        levelSelectArea.classList.remove("d-flex");
        homeOverlay.classList.add("d-none");
        homeOverlay.classList.remove("d-flex");

        screenWrapper.classList.add("playing-size");
        gameHud.classList.remove("d-none");
        gameHud.classList.add("d-flex");
    }

    function switchToHomeScreen() {
        isPlaying = false;
        cancelAnimationFrame(animationId);

        screenWrapper.classList.remove("playing-size");
        gameHud.classList.add("d-none");
        gameHud.classList.remove("d-flex");

        launchHintOverlay.classList.add("d-none");
        launchHintOverlay.classList.remove("d-flex");
        tutorialOverlay.classList.add("d-none");
        tutorialOverlay.classList.remove("d-flex");
        pauseOverlay.classList.add("d-none");
        pauseOverlay.classList.remove("d-flex");
        victoryOverlay.classList.add("d-none");
        victoryOverlay.classList.remove("d-flex");

        mainHeader.classList.remove("d-none");
        homeActions.classList.remove("d-none");
        homeActions.classList.add("d-flex");
        levelSelectArea.classList.add("d-none");
        homeOverlay.classList.remove("d-none");
        homeOverlay.classList.add("d-flex");

        initBricks(currentLevel);
        resetBallOnPaddle();
        renderScene();
        checkSavedGame();
    }

    function loadLevelFromMenu(level) {
        currentLevel = level;
        score = 0;
        lives = 3;
        hudScore.textContent = score;
        hudLives.textContent = lives;
        if (hudLevel) hudLevel.textContent = currentLevel;

        if (level === 1) {
            if (tutorialTitle) tutorialTitle.textContent = "MÀN 1: CƠ BẢN";
            if (tutorialDesc) tutorialDesc.innerHTML = "👉 <strong>Cơ chế:</strong> Khối gạch vỡ sau 1 chạm.<br>🕹️ <strong>Điều khiển:</strong> Di chuyển chuột hoặc phím mũi tên.<br>🖱️ <strong>Khởi động:</strong> Nhấn chuột trái để phóng bóng.";
        }

        paddle.x = 600 / 2 - paddle.width / 2;
        initBricks(currentLevel);
        resetBallOnPaddle();
        renderScene();
        expandGameScreen();

        victoryOverlay.classList.add("d-none");
        victoryOverlay.classList.remove("d-flex");
        tutorialOverlay.classList.remove("d-none");
        tutorialOverlay.classList.add("d-flex");
    }

    function saveGameProgress() {
        const data = {
            level: currentLevel,
            score: score,
            lives: lives,
            paddle: {x: paddle.x, y: paddle.y},
            balls: balls,
            isBallLaunched: isBallLaunched,
            bricks: bricks
        };
        localStorage.setItem("BRICK_BREAKER_SAVE", JSON.stringify(data));
        checkSavedGame();
    }

    function checkSavedGame() {
        if (!btnContinue) return;
        if (localStorage.getItem("BRICK_BREAKER_SAVE")) {
            btnContinue.removeAttribute("disabled");
        } else {
            btnContinue.setAttribute("disabled", "true");
        }
    }

    checkSavedGame();

    let resetActionCallback = null;

    function showConfirmOrRun(action) {
        if (localStorage.getItem("BRICK_BREAKER_SAVE")) {
            resetActionCallback = action;
            if (confirmResetModalInstance) {
                confirmResetModalInstance.show();
            } else if (confirm("Mọi tiến trình của bạn sẽ bị xóa. Bạn có muốn tiếp tục?")) {
                action();
            }
        } else {
            action();
        }
    }

    btnNewGame.addEventListener("click", () => {
        initAudio();
        showConfirmOrRun(() => {
            localStorage.removeItem("BRICK_BREAKER_SAVE");
            checkSavedGame();
            homeActions.classList.add("d-none");
            homeActions.classList.remove("d-flex");
            levelSelectArea.classList.remove("d-none");
            levelSelectArea.classList.add("d-flex");
        });
    });

    btnBackToHome.addEventListener("click", () => {
        levelSelectArea.classList.add("d-none");
        levelSelectArea.classList.remove("d-flex");
        homeActions.classList.remove("d-none");
        homeActions.classList.add("d-flex");
    });

    document.querySelectorAll('.btn-level').forEach(btn => {
        btn.addEventListener("click", (e) => {
            const level = parseInt(e.currentTarget.getAttribute("data-level"));
            loadLevelFromMenu(level);
        });
    });

    btnStartGameplay.addEventListener("click", () => {
        tutorialOverlay.classList.add("d-none");
        tutorialOverlay.classList.remove("d-flex");
        isPlaying = true;
        resetBallOnPaddle();
        gameLoop();
    });

    btnContinue.addEventListener("click", () => {
        initAudio();
        const raw = localStorage.getItem("BRICK_BREAKER_SAVE");
        if (!raw) return;
        const data = JSON.parse(raw);

        currentLevel = data.level || 1;
        if (hudLevel) hudLevel.textContent = currentLevel;

        expandGameScreen();
        score = data.score;
        lives = data.lives;
        paddle.x = data.paddle.x;
        paddle.y = data.paddle.y;
        balls = data.balls || [createInitialBall()];
        isBallLaunched = data.isBallLaunched;
        bricks = data.bricks;

        bricksToBreak = 0;
        for (let c = 0; c < brickColumnCount; c++) {
            for (let r = 0; r < brickRowCount; r++) {
                if (bricks[c][r].status === 1) bricksToBreak++;
            }
        }

        hudScore.textContent = score;
        hudLives.textContent = lives;

        if (!isBallLaunched) {
            launchHintOverlay.classList.remove("d-none");
            launchHintOverlay.classList.add("d-flex");
        }

        renderScene();
        isPlaying = true;
        gameLoop();
    });

    btnGameMenu.addEventListener("click", () => {
        isPlaying = false;
        cancelAnimationFrame(animationId);
        launchHintOverlay.classList.add("d-none");
        launchHintOverlay.classList.remove("d-flex");
        pauseOverlay.classList.remove("d-none");
        pauseOverlay.classList.add("d-flex");
    });

    btnResumeGame.addEventListener("click", () => {
        pauseOverlay.classList.add("d-none");
        pauseOverlay.classList.remove("d-flex");
        isPlaying = true;
        if (!isBallLaunched) {
            launchHintOverlay.classList.remove("d-none");
            launchHintOverlay.classList.add("d-flex");
        }
        gameLoop();
    });

    btnHomeFromPause.addEventListener("click", () => {
        saveGameProgress();
        switchToHomeScreen();
    });

    btnSelectLevelFromPause.addEventListener("click", () => {
        showConfirmOrRun(() => {
            localStorage.removeItem("BRICK_BREAKER_SAVE");
            checkSavedGame();
            switchToHomeScreen();
            homeActions.classList.add("d-none");
            homeActions.classList.remove("d-flex");
            levelSelectArea.classList.remove("d-none");
            levelSelectArea.classList.add("d-flex");
        });
    });

    btnExitFromPause.addEventListener("click", () => {
        saveGameProgress();
        switchToHomeScreen();
        const exitModalEl = document.getElementById("exitModal");
        if (exitModalEl && typeof bootstrap !== "undefined") {
            new bootstrap.Modal(exitModalEl).show();
        }
    });

    btnVictoryContinue.addEventListener("click", () => {
        victoryOverlay.classList.add("d-none");
        victoryOverlay.classList.remove("d-flex");

        paddle.x = 600 / 2 - paddle.width / 2;
        initBricks(currentLevel);
        resetBallOnPaddle();
        renderScene();
        isPlaying = true;
        gameLoop();
    });

    btnVictorySelectLevel.addEventListener("click", () => {
        switchToHomeScreen();
        homeActions.classList.add("d-none");
        homeActions.classList.remove("d-flex");
        levelSelectArea.classList.remove("d-none");
        levelSelectArea.classList.add("d-flex");
    });

    btnVictoryHome.addEventListener("click", () => {
        switchToHomeScreen();
    });

    btnConfirmReset.addEventListener("click", () => {
        if (confirmResetModalInstance) confirmResetModalInstance.hide();
        if (resetActionCallback) {
            resetActionCallback();
            resetActionCallback = null;
        }
    });

    btnConfirmExit.addEventListener("click", () => {
        saveGameProgress();
        window.close();
        document.body.innerHTML = `
      <div class="text-center text-white p-5">
        <h2 class="text-warning">Cảm ơn bạn đã chơi!</h2>
        <p>Tiến trình đã được lưu. Bạn có thể đóng tab này.</p>
      </div>`;
    });

    const sfxSlider = document.getElementById("sfxSlider");
    if (sfxSlider) {
        sfxSlider.addEventListener("input", (e) => {
            sfxVolume = e.target.value / 100;
        });
    }
});