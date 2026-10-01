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
        } catch (e) {}
    }

    let isPlaying = false;
    let isBallLaunched = false;
    let animationId = null;
    let score = 0;
    let lives = 3;

    const paddle = {
        width: 120,
        height: 16,
        x: 600 / 2 - 60,
        y: 750 - 45,
        speed: 7.5
    };

    const BALL_SPEED = 4.2;

    const ball = {
        x: 600 / 2,
        y: 750 - 45 - 9,
        radius: 9,
        dx: 0,
        dy: 0
    };

    const brickRowCount = 6;
    const brickColumnCount = 8;
    const brickWidth = 58;
    const brickHeight = 22;
    const brickPadding = 10;
    const brickOffsetTop = 60;
    const brickOffsetLeft = (600 - (brickColumnCount * (brickWidth + brickPadding) - brickPadding)) / 2;

    let bricks = [];
    function initBricks() {
        bricks = [];
        const colors = ["#ff4757", "#ff6b81", "#ffa502", "#eccc68", "#2ed573", "#1e90ff"];
        for (let c = 0; c < brickColumnCount; c++) {
            bricks[c] = [];
            for (let r = 0; r < brickRowCount; r++) {
                bricks[c][r] = {
                    x: c * (brickWidth + brickPadding) + brickOffsetLeft,
                    y: r * (brickHeight + brickPadding) + brickOffsetTop,
                    status: 1,
                    color: colors[r]
                };
            }
        }
    }

    function resetBallOnPaddle() {
        isBallLaunched = false;
        ball.x = paddle.x + paddle.width / 2;
        ball.y = paddle.y - ball.radius;
        ball.dx = 0;
        ball.dy = 0;
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
        const angle = (Math.PI / 4) + (Math.random() * (Math.PI / 2));
        ball.dx = BALL_SPEED * Math.cos(angle) * (Math.random() < 0.5 ? -1 : 1);
        ball.dy = -Math.abs(BALL_SPEED * Math.sin(angle));
    }

    function drawPaddle() {
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 6);
        } else {
            ctx.rect(paddle.x, paddle.y, paddle.width, paddle.height);
        }
        ctx.fillStyle = "#00f2fe";
        ctx.fill();
        ctx.closePath();
    }

    function drawBall() {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.closePath();
    }

    function drawBricks() {
        for (let c = 0; c < brickColumnCount; c++) {
            for (let r = 0; r < brickRowCount; r++) {
                const b = bricks[c][r];
                if (b && b.status === 1) {
                    ctx.beginPath();
                    if (ctx.roundRect) {
                        ctx.roundRect(b.x, b.y, brickWidth, brickHeight, 4);
                    } else {
                        ctx.rect(b.x, b.y, brickWidth, brickHeight);
                    }
                    ctx.fillStyle = b.color;
                    ctx.fill();
                    ctx.closePath();
                }
            }
        }
    }

    function renderScene() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBricks();
        drawPaddle();
        drawBall();
    }

    initBricks();
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
            if (!isBallLaunched) {
                ball.x = paddle.x + paddle.width / 2;
            }
        }
    });

    canvas.addEventListener("click", () => {
        launchBall();
    });

    function collisionDetection() {
        let remainingBricks = 0;
        for (let c = 0; c < brickColumnCount; c++) {
            for (let r = 0; r < brickRowCount; r++) {
                const b = bricks[c][r];
                if (b && b.status === 1) {
                    remainingBricks++;
                    if (
                        ball.x > b.x &&
                        ball.x < b.x + brickWidth &&
                        ball.y > b.y &&
                        ball.y < b.y + brickHeight
                    ) {
                        ball.dy = -ball.dy;
                        b.status = 0;
                        score += 10;
                        hudScore.textContent = score;
                        playHitSound();
                        remainingBricks--;
                    }
                }
            }
        }

        if (remainingBricks === 0) {
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

    function gameLoop() {
        if (!isPlaying) return;

        if (!isBallLaunched) {
            ball.x = paddle.x + paddle.width / 2;
            ball.y = paddle.y - ball.radius;
        } else {
            if (ball.x + ball.dx > canvas.width - ball.radius || ball.x + ball.dx < ball.radius) {
                ball.dx = -ball.dx;
                playHitSound();
            }

            if (ball.y + ball.dy < ball.radius) {
                ball.dy = -ball.dy;
                playHitSound();
            } else if (ball.y + ball.dy > paddle.y - ball.radius) {
                if (ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
                    const hitPoint = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
                    const maxBounceAngle = Math.PI / 3;
                    const bounceAngle = hitPoint * maxBounceAngle;

                    ball.dx = BALL_SPEED * Math.sin(bounceAngle);
                    ball.dy = -BALL_SPEED * Math.cos(bounceAngle);
                    playHitSound();
                } else if (ball.y + ball.dy > canvas.height - ball.radius) {
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
            }

            ball.x += ball.dx;
            ball.y += ball.dy;
            collisionDetection();
        }

        if (rightPressed && paddle.x < canvas.width - paddle.width) {
            paddle.x += paddle.speed;
            if (!isBallLaunched) ball.x = paddle.x + paddle.width / 2;
        } else if (leftPressed && paddle.x > 0) {
            paddle.x -= paddle.speed;
            if (!isBallLaunched) ball.x = paddle.x + paddle.width / 2;
        }

        renderScene();
        animationId = requestAnimationFrame(gameLoop);
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

        initBricks();
        resetBallOnPaddle();
        renderScene();
        checkSavedGame();
    }

    function saveGameProgress() {
        const data = {
            score: score,
            lives: lives,
            paddle: { x: paddle.x, y: paddle.y },
            ball: { x: ball.x, y: ball.y, dx: ball.dx, dy: ball.dy, isBallLaunched: isBallLaunched },
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

    document.querySelector('.btn-level[data-level="1"]').addEventListener("click", () => {
        expandGameScreen();
        score = 0;
        lives = 3;
        hudScore.textContent = score;
        hudLives.textContent = lives;
        paddle.x = 600 / 2 - paddle.width / 2;
        initBricks();
        resetBallOnPaddle();
        renderScene();

        victoryOverlay.classList.add("d-none");
        victoryOverlay.classList.remove("d-flex");
        tutorialOverlay.classList.remove("d-none");
        tutorialOverlay.classList.add("d-flex");
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

        expandGameScreen();
        score = data.score;
        lives = data.lives;
        paddle.x = data.paddle.x;
        paddle.y = data.paddle.y;
        ball.x = data.ball.x;
        ball.y = data.ball.y;
        ball.dx = data.ball.dx;
        ball.dy = data.ball.dy;
        isBallLaunched = data.ball.isBallLaunched;
        bricks = data.bricks;
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
        initBricks();
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