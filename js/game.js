document.addEventListener("DOMContentLoaded", () => {
    const InterfaceElements = {
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
        scoreDisplay: document.getElementById("hudScore"),
        livesDisplay: document.getElementById("hudLives"),
        levelDisplay: document.getElementById("hudLevel"),
        playArea: document.getElementById("playArea")
    };

    const boardObserver = new ResizeObserver(() => {
        const currentWidth = InterfaceElements.screenWrapper.clientWidth;
        const scaleRatio = currentWidth / 600;
        InterfaceElements.playArea.style.transform = `scale(${scaleRatio})`;
    });
    boardObserver.observe(InterfaceElements.screenWrapper);

    const Buttons = {
        newGame: document.getElementById("btnNewGame"),
        continueGame: document.getElementById("btnContinue"),
        backToHome: document.getElementById("btnBackToHome"),
        startGameplay: document.getElementById("btnStartGameplay"),
        gameMenu: document.getElementById("btnGameMenu"),
        resumeGame: document.getElementById("btnResumeGame"),
        selectLevelFromPause: document.getElementById("btnSelectLevelFromPause"),
        homeFromPause: document.getElementById("btnHomeFromPause"),
        exitFromPause: document.getElementById("btnExitFromPause"),
        confirmExit: document.getElementById("btnConfirmExit"),
        confirmReset: document.getElementById("btnConfirmReset"),
        victoryContinue: document.getElementById("btnVictoryContinue"),
        victorySelectLevel: document.getElementById("btnVictorySelectLevel"),
        victoryHome: document.getElementById("btnVictoryHome")
    };

    const GameState = {
        isGameRunning: false,
        isBallLaunched: false,
        animationFrameId: null,
        currentScore: 0,
        currentLives: 3,
        currentLevel: 1,
        totalBricksToBreak: 0,
        baseBallSpeed: 4.2,
        activeBalls: [],
        fallingItems: [],
        activeBricks: [],
        paddle: {
            element: null,
            width: 120,
            height: 16,
            positionX: 240,
            positionY: 705,
            moveSpeed: 7.5,
            hasFireballBuff: false
        },
        shield: {
            element: null,
            isActive: false,
            remainingTime: 0
        },
        controls: {
            moveLeft: false,
            moveRight: false
        },
        audioContext: null,
        soundVolume: 0.7
    };

    const LevelConfig = {
        rowCount: 12,
        columnCount: 15,
        brickWidth: 30,
        brickHeight: 10,
        brickPadding: 5,
        offsetTop: 70,
        colors: ["#00a8ff", "#1e90ff", "#00f2fe", "#48dbfb", "#0abde3", "#70a1ff"]
    };
    LevelConfig.offsetLeft = (600 - (LevelConfig.columnCount * (LevelConfig.brickWidth + LevelConfig.brickPadding) - LevelConfig.brickPadding)) / 2;

    function initializeAudioSystem() {
        if (!GameState.audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                GameState.audioContext = new AudioContextClass();
            }
        }
    }

    function playCollisionSound() {
        if (!GameState.audioContext || GameState.soundVolume <= 0) {
            return;
        }
        try {
            const oscillator = GameState.audioContext.createOscillator();
            const gainNode = GameState.audioContext.createGain();

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(440, GameState.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(880, GameState.audioContext.currentTime + 0.05);

            gainNode.gain.setValueAtTime(GameState.soundVolume, GameState.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.01, GameState.audioContext.currentTime + 0.05);

            oscillator.connect(gainNode);
            gainNode.connect(GameState.audioContext.destination);

            oscillator.start();
            oscillator.stop(GameState.audioContext.currentTime + 0.05);
        } catch (error) {
        }
    }

    function createHtmlElement(tagName, styles) {
        const element = document.createElement(tagName);
        Object.assign(element.style, styles);
        element.style.position = "absolute";
        return element;
    }

    function generateNewBallObject(startX, startY) {
        return {
            element: null,
            radius: 9,
            positionX: startX,
            positionY: startY,
            velocityX: 0,
            velocityY: 0,
            currentSpeed: GameState.baseBallSpeed,
            isFireball: false
        };
    }

    function clearEntirePlayArea() {
        if (InterfaceElements.playArea) {
            InterfaceElements.playArea.innerHTML = "";
        }
    }

    function setupPaddleElement() {
        GameState.paddle.element = createHtmlElement("div", {
            width: GameState.paddle.width + "px",
            height: GameState.paddle.height + "px",
            borderRadius: "6px",
            backgroundColor: "#00f2fe",
            transition: "width 0.2s"
        });
        InterfaceElements.playArea.appendChild(GameState.paddle.element);
    }

    function setupShieldElement() {
        GameState.shield.element = createHtmlElement("div", {
            width: "600px",
            height: "10px",
            bottom: "10px",
            left: "0px",
            backgroundColor: "rgba(0, 210, 211, 0.7)",
            display: "none"
        });
        InterfaceElements.playArea.appendChild(GameState.shield.element);
    }

    function setupBallElement(ballObject) {
        ballObject.element = createHtmlElement("div", {
            width: (ballObject.radius * 2) + "px",
            height: (ballObject.radius * 2) + "px",
            borderRadius: "50%",
            backgroundColor: "#ffffff"
        });
        InterfaceElements.playArea.appendChild(ballObject.element);
    }

    function buildLevelBricks() {
        clearEntirePlayArea();
        setupPaddleElement();
        setupShieldElement();

        GameState.activeBricks = [];
        GameState.fallingItems = [];
        GameState.activeBalls = [];
        GameState.totalBricksToBreak = 0;
        GameState.paddle.width = 120;
        GameState.paddle.hasFireballBuff = false;
        GameState.shield.isActive = false;

        for (let col = 0; col < LevelConfig.columnCount; col++) {
            GameState.activeBricks[col] = [];
            for (let row = 0; row < LevelConfig.rowCount; row++) {
                const brickColor = LevelConfig.colors[row % LevelConfig.colors.length];
                const calculatedX = col * (LevelConfig.brickWidth + LevelConfig.brickPadding) + LevelConfig.offsetLeft;
                const calculatedY = row * (LevelConfig.brickHeight + LevelConfig.brickPadding) + LevelConfig.offsetTop;

                const brickElement = createHtmlElement("div", {
                    width: LevelConfig.brickWidth + "px",
                    height: LevelConfig.brickHeight + "px",
                    backgroundColor: brickColor,
                    border: "1px solid rgba(0,0,0,0.3)",
                    left: calculatedX + "px",
                    top: calculatedY + "px",
                    boxSizing: "border-box"
                });

                InterfaceElements.playArea.appendChild(brickElement);

                GameState.activeBricks[col][row] = {
                    element: brickElement,
                    positionX: calculatedX,
                    positionY: calculatedY,
                    isActive: true
                };
                GameState.totalBricksToBreak++;
            }
        }
    }

    function resetBallsToPaddle() {
        GameState.isBallLaunched = false;
        GameState.paddle.hasFireballBuff = false;

        GameState.activeBalls.forEach(ball => {
            if (ball.element) ball.element.remove();
        });

        const initialBall = generateNewBallObject(
            GameState.paddle.positionX + GameState.paddle.width / 2,
            GameState.paddle.positionY - 9
        );
        setupBallElement(initialBall);
        GameState.activeBalls = [initialBall];

        if (GameState.isGameRunning) {
            InterfaceElements.launchHintOverlay.classList.remove("d-none");
            InterfaceElements.launchHintOverlay.classList.add("d-flex");
        }
    }

    function launchAllBalls() {
        if (!GameState.isGameRunning || GameState.isBallLaunched) {
            return;
        }
        GameState.isBallLaunched = true;
        InterfaceElements.launchHintOverlay.classList.add("d-none");
        InterfaceElements.launchHintOverlay.classList.remove("d-flex");

        GameState.activeBalls.forEach(ball => {
            const launchAngle = (Math.PI / 4) + (Math.random() * (Math.PI / 2));
            const directionX = Math.random() < 0.5 ? -1 : 1;
            ball.velocityX = ball.currentSpeed * Math.cos(launchAngle) * directionX;
            ball.velocityY = -Math.abs(ball.currentSpeed * Math.sin(launchAngle));
        });
    }

    function renderGraphicsToScreen() {
        GameState.paddle.element.style.transform = `translate(${GameState.paddle.positionX}px, ${GameState.paddle.positionY}px)`;
        GameState.paddle.element.style.width = GameState.paddle.width + "px";
        GameState.paddle.element.style.backgroundColor = GameState.paddle.hasFireballBuff ? "#ff4757" : "#00f2fe";

        if (GameState.shield.isActive && GameState.shield.remainingTime > 0) {
            GameState.shield.element.style.display = "block";
            const isBlinking = GameState.shield.remainingTime < 180 && Math.floor(GameState.shield.remainingTime / 15) % 2 === 0;
            GameState.shield.element.style.opacity = isBlinking ? "0.2" : "1";
        } else {
            GameState.shield.element.style.display = "none";
        }

        GameState.activeBalls.forEach(ball => {
            const visualX = ball.positionX - ball.radius;
            const visualY = ball.positionY - ball.radius;
            ball.element.style.transform = `translate(${visualX}px, ${visualY}px)`;

            if (ball.isFireball) {
                ball.element.style.backgroundColor = "#ff4757";
                ball.element.style.boxShadow = "0 0 15px #ff4757";
            } else {
                ball.element.style.backgroundColor = "#ffffff";
                ball.element.style.boxShadow = "none";
            }
        });

        GameState.fallingItems.forEach(item => {
            const visualX = item.positionX - item.width / 2;
            const visualY = item.positionY - item.height / 2;
            item.element.style.transform = `translate(${visualX}px, ${visualY}px)`;
        });
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Right" || event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
            GameState.controls.moveRight = true;
        }
        if (event.key === "Left" || event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
            GameState.controls.moveLeft = true;
        }
    });

    document.addEventListener("keyup", (event) => {
        if (event.key === "Right" || event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
            GameState.controls.moveRight = false;
        }
        if (event.key === "Left" || event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
            GameState.controls.moveLeft = false;
        }
    });

    InterfaceElements.playArea.addEventListener("mousemove", (event) => {
        if (!GameState.isGameRunning) {
            return;
        }
        const bounds = InterfaceElements.playArea.getBoundingClientRect();
        const relativeMouseX = (event.clientX - bounds.left) * (600 / bounds.width);

        if (relativeMouseX > 0 && relativeMouseX < 600) {
            const limitedX = Math.max(0, Math.min(600 - GameState.paddle.width, relativeMouseX - GameState.paddle.width / 2));
            GameState.paddle.positionX = limitedX;

            if (!GameState.isBallLaunched && GameState.activeBalls.length > 0) {
                GameState.activeBalls[0].positionX = GameState.paddle.positionX + GameState.paddle.width / 2;
            }
        }
    });

    InterfaceElements.playArea.addEventListener("click", () => {
        launchAllBalls();
    });

    function spawnRandomItem(spawnX, spawnY) {
        if (Math.random() >= 0.25) {
            return;
        }

        const standardItems = [
            { type: "expand", color: "#2ed573", icon: "↔️" },
            { type: "life", color: "#ff4757", icon: "❤️" },
            { type: "slow", color: "#1e90ff", icon: "🐢" },
            { type: "fireball", color: "#ff9f43", icon: "🔥" },
            { type: "shield", color: "#00d2d3", icon: "🛡️" }
        ];

        if (GameState.activeBalls.length <= 2) {
            standardItems.push({ type: "split", color: "#f368e0", icon: "🔱" });
            standardItems.push({ type: "shoot", color: "#feca57", icon: "🔫" });
        }

        const pickedItemInfo = standardItems[Math.floor(Math.random() * standardItems.length)];

        const itemElement = createHtmlElement("div", {
            width: "24px",
            height: "24px",
            backgroundColor: pickedItemInfo.color,
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            color: "#ffffff",
            cursor: "default"
        });
        itemElement.innerText = pickedItemInfo.icon;
        InterfaceElements.playArea.appendChild(itemElement);

        GameState.fallingItems.push({
            positionX: spawnX,
            positionY: spawnY,
            width: 24,
            height: 24,
            type: pickedItemInfo.type,
            element: itemElement
        });
    }

    function processBrickDestruction(brickObject) {
        brickObject.isActive = false;
        brickObject.element.remove();

        GameState.currentScore += 10;
        InterfaceElements.scoreDisplay.textContent = GameState.currentScore;
        GameState.totalBricksToBreak--;

        playCollisionSound();
        spawnRandomItem(brickObject.positionX + LevelConfig.brickWidth / 2, brickObject.positionY + LevelConfig.brickHeight / 2);

        if (GameState.totalBricksToBreak === 0) {
            GameState.isGameRunning = false;
            cancelAnimationFrame(GameState.animationFrameId);
            localStorage.removeItem("BRICK_BREAKER_SAVE");
            updateContinueButtonState();

            InterfaceElements.launchHintOverlay.classList.add("d-none");
            InterfaceElements.launchHintOverlay.classList.remove("d-flex");
            InterfaceElements.victoryOverlay.classList.remove("d-none");
            InterfaceElements.victoryOverlay.classList.add("d-flex");
        }
    }

    function checkCollisionBetweenBallsAndBricks() {
        GameState.activeBalls.forEach(ball => {
            let hasBouncedThisFrame = false;

            for (let col = 0; col < LevelConfig.columnCount; col++) {
                for (let row = 0; row < LevelConfig.rowCount; row++) {
                    const brick = GameState.activeBricks[col][row];

                    if (brick && brick.isActive) {
                        const isOverlappingX = ball.positionX + ball.radius > brick.positionX && ball.positionX - ball.radius < brick.positionX + LevelConfig.brickWidth;
                        const isOverlappingY = ball.positionY + ball.radius > brick.positionY && ball.positionY - ball.radius < brick.positionY + LevelConfig.brickHeight;

                        if (isOverlappingX && isOverlappingY) {
                            if (!ball.isFireball && !hasBouncedThisFrame) {
                                ball.velocityY = -ball.velocityY;
                                hasBouncedThisFrame = true;
                            }
                            processBrickDestruction(brick);
                        }
                    }
                }
            }
        });
    }

    function updateFallingItemsLogic() {
        for (let index = 0; index < GameState.fallingItems.length; index++) {
            const item = GameState.fallingItems[index];
            item.positionY += 1.5;

            const isTouchingPaddleY = item.positionY + item.height / 2 > GameState.paddle.positionY && item.positionY - item.height / 2 < GameState.paddle.positionY + GameState.paddle.height;
            const isTouchingPaddleX = item.positionX + item.width / 2 > GameState.paddle.positionX && item.positionX - item.width / 2 < GameState.paddle.positionX + GameState.paddle.width;

            if (isTouchingPaddleY && isTouchingPaddleX) {
                if (item.type === "expand") {
                    GameState.paddle.width = Math.min(240, GameState.paddle.width + 30);
                }
                else if (item.type === "life") {
                    if (GameState.currentLives < 5) {
                        GameState.currentLives++;
                        InterfaceElements.livesDisplay.textContent = GameState.currentLives;
                    } else {
                        GameState.currentScore += 50;
                        InterfaceElements.scoreDisplay.textContent = GameState.currentScore;
                    }
                }
                else if (item.type === "slow") {
                    GameState.activeBalls.forEach(ball => {
                        const actualSpeed = Math.hypot(ball.velocityX, ball.velocityY);
                        if (actualSpeed > 2.5) {
                            ball.velocityX *= 0.8;
                            ball.velocityY *= 0.8;
                        }
                    });
                }
                else if (item.type === "split") {
                    const newSplitBalls = [];
                    GameState.activeBalls.forEach(ball => {
                        const currentAngle = Math.atan2(ball.velocityY, ball.velocityX);
                        const angleOffset1 = currentAngle + Math.PI / 6;
                        const angleOffset2 = currentAngle - Math.PI / 6;

                        const ballOne = generateNewBallObject(ball.positionX, ball.positionY);
                        ballOne.velocityX = ball.currentSpeed * Math.cos(angleOffset1);
                        ballOne.velocityY = ball.currentSpeed * Math.sin(angleOffset1);
                        ballOne.isFireball = ball.isFireball;
                        setupBallElement(ballOne);
                        newSplitBalls.push(ballOne);

                        const ballTwo = generateNewBallObject(ball.positionX, ball.positionY);
                        ballTwo.velocityX = ball.currentSpeed * Math.cos(angleOffset2);
                        ballTwo.velocityY = ball.currentSpeed * Math.sin(angleOffset2);
                        ballTwo.isFireball = ball.isFireball;
                        setupBallElement(ballTwo);
                        newSplitBalls.push(ballTwo);
                    });
                    GameState.activeBalls = GameState.activeBalls.concat(newSplitBalls);
                }
                else if (item.type === "shoot") {
                    const anglesToShoot = [-Math.PI / 2, -Math.PI / 2 - Math.PI / 6, -Math.PI / 2 + Math.PI / 6];
                    anglesToShoot.forEach(angle => {
                        const bulletBall = generateNewBallObject(GameState.paddle.positionX + GameState.paddle.width / 2, GameState.paddle.positionY - 10);
                        bulletBall.velocityX = bulletBall.currentSpeed * Math.cos(angle);
                        bulletBall.velocityY = bulletBall.currentSpeed * Math.sin(angle);
                        setupBallElement(bulletBall);
                        GameState.activeBalls.push(bulletBall);
                    });
                }
                else if (item.type === "fireball") {
                    GameState.paddle.hasFireballBuff = true;
                }
                else if (item.type === "shield") {
                    GameState.shield.isActive = true;
                    GameState.shield.remainingTime = 600;
                }

                playCollisionSound();
                item.element.remove();
                GameState.fallingItems.splice(index, 1);
                index--;
            }
            else if (item.positionY - item.height / 2 > 750) {
                item.element.remove();
                GameState.fallingItems.splice(index, 1);
                index--;
            }
        }
    }

    function processMainGameLoop() {
        if (!GameState.isGameRunning) {
            return;
        }

        if (GameState.shield.isActive) {
            GameState.shield.remainingTime--;
            if (GameState.shield.remainingTime <= 0) {
                GameState.shield.isActive = false;
            }
        }

        if (!GameState.isBallLaunched) {
            if (GameState.activeBalls.length > 0) {
                GameState.activeBalls[0].positionX = GameState.paddle.positionX + GameState.paddle.width / 2;
                GameState.activeBalls[0].positionY = GameState.paddle.positionY - GameState.activeBalls[0].radius;
            }
        } else {
            for (let i = GameState.activeBalls.length - 1; i >= 0; i--) {
                const ball = GameState.activeBalls[i];

                function removeFireballState() {
                    if (ball.isFireball) {
                        ball.isFireball = false;
                        ball.currentSpeed = GameState.baseBallSpeed;
                        const currentDirectionAngle = Math.atan2(ball.velocityY, ball.velocityX);
                        ball.velocityX = ball.currentSpeed * Math.cos(currentDirectionAngle);
                        ball.velocityY = ball.currentSpeed * Math.sin(currentDirectionAngle);
                    }
                }

                const hitLeftOrRightWall = ball.positionX + ball.velocityX > 600 - ball.radius || ball.positionX + ball.velocityX < ball.radius;
                if (hitLeftOrRightWall) {
                    ball.velocityX = -ball.velocityX;
                    playCollisionSound();
                }

                const hitCeiling = ball.positionY + ball.velocityY < ball.radius;
                if (hitCeiling) {
                    ball.velocityY = -ball.velocityY;
                    playCollisionSound();
                    removeFireballState();
                }
                else if (ball.positionY + ball.velocityY > GameState.paddle.positionY - ball.radius) {
                    const hitPaddleX = ball.positionX > GameState.paddle.positionX && ball.positionX < GameState.paddle.positionX + GameState.paddle.width;

                    if (hitPaddleX) {
                        const relativeHitPoint = (ball.positionX - (GameState.paddle.positionX + GameState.paddle.width / 2)) / (GameState.paddle.width / 2);
                        const maximumBounceAngle = Math.PI / 3;
                        const finalBounceAngle = relativeHitPoint * maximumBounceAngle;

                        if (GameState.paddle.hasFireballBuff && !ball.isFireball) {
                            ball.isFireball = true;
                            ball.currentSpeed = GameState.baseBallSpeed * 3;
                            GameState.paddle.hasFireballBuff = false;
                        }

                        ball.velocityX = ball.currentSpeed * Math.sin(finalBounceAngle);
                        ball.velocityY = -ball.currentSpeed * Math.cos(finalBounceAngle);
                        playCollisionSound();
                    }
                    else if (ball.positionY + ball.velocityY > 750 - ball.radius) {
                        if (GameState.shield.isActive) {
                            ball.velocityY = -ball.velocityY;
                            ball.positionY = 750 - ball.radius - 15;
                            GameState.shield.isActive = false;
                            playCollisionSound();
                        } else {
                            ball.element.remove();
                            GameState.activeBalls.splice(i, 1);
                        }
                    }
                }

                ball.positionX += ball.velocityX;
                ball.positionY += ball.velocityY;
            }

            if (GameState.activeBalls.length === 0) {
                GameState.currentLives--;
                InterfaceElements.livesDisplay.textContent = GameState.currentLives;

                if (GameState.currentLives <= 0) {
                    localStorage.removeItem("BRICK_BREAKER_SAVE");
                    updateContinueButtonState();
                    switchToHomeMenuScreen();
                    return;
                } else {
                    resetBallsToPaddle();
                }
            }

            checkCollisionBetweenBallsAndBricks();
            updateFallingItemsLogic();
        }

        if (GameState.controls.moveRight && GameState.paddle.positionX < 600 - GameState.paddle.width) {
            GameState.paddle.positionX += GameState.paddle.moveSpeed;
            if (!GameState.isBallLaunched && GameState.activeBalls.length > 0) {
                GameState.activeBalls[0].positionX = GameState.paddle.positionX + GameState.paddle.width / 2;
            }
        }
        else if (GameState.controls.moveLeft && GameState.paddle.positionX > 0) {
            GameState.paddle.positionX -= GameState.paddle.moveSpeed;
            if (!GameState.isBallLaunched && GameState.activeBalls.length > 0) {
                GameState.activeBalls[0].positionX = GameState.paddle.positionX + GameState.paddle.width / 2;
            }
        }

        renderGraphicsToScreen();

        if (GameState.isGameRunning) {
            GameState.animationFrameId = requestAnimationFrame(processMainGameLoop);
        }
    }

    function expandGameplayContainer() {
        InterfaceElements.mainHeader.classList.add("d-none");
        InterfaceElements.homeActions.classList.add("d-none");
        InterfaceElements.homeActions.classList.remove("d-flex");
        InterfaceElements.levelSelectArea.classList.add("d-none");
        InterfaceElements.levelSelectArea.classList.remove("d-flex");
        InterfaceElements.homeOverlay.classList.add("d-none");
        InterfaceElements.homeOverlay.classList.remove("d-flex");

        InterfaceElements.screenWrapper.classList.add("playing-size");
        InterfaceElements.gameHud.classList.remove("d-none");
        InterfaceElements.gameHud.classList.add("d-flex");
    }

    function switchToHomeMenuScreen() {
        GameState.isGameRunning = false;
        cancelAnimationFrame(GameState.animationFrameId);

        InterfaceElements.screenWrapper.classList.remove("playing-size");
        InterfaceElements.gameHud.classList.add("d-none");
        InterfaceElements.gameHud.classList.remove("d-flex");

        InterfaceElements.launchHintOverlay.classList.add("d-none");
        InterfaceElements.launchHintOverlay.classList.remove("d-flex");
        InterfaceElements.tutorialOverlay.classList.add("d-none");
        InterfaceElements.tutorialOverlay.classList.remove("d-flex");
        InterfaceElements.pauseOverlay.classList.add("d-none");
        InterfaceElements.pauseOverlay.classList.remove("d-flex");
        InterfaceElements.victoryOverlay.classList.add("d-none");
        InterfaceElements.victoryOverlay.classList.remove("d-flex");

        InterfaceElements.mainHeader.classList.remove("d-none");
        InterfaceElements.homeActions.classList.remove("d-none");
        InterfaceElements.homeActions.classList.add("d-flex");
        InterfaceElements.levelSelectArea.classList.add("d-none");
        InterfaceElements.homeOverlay.classList.remove("d-none");
        InterfaceElements.homeOverlay.classList.add("d-flex");

        buildLevelBricks();
        resetBallsToPaddle();
        renderGraphicsToScreen();
        updateContinueButtonState();
    }

    function loadSelectedLevelToScreen(levelNumber) {
        GameState.currentLevel = levelNumber;
        GameState.currentScore = 0;
        GameState.currentLives = 3;

        InterfaceElements.scoreDisplay.textContent = GameState.currentScore;
        InterfaceElements.livesDisplay.textContent = GameState.currentLives;

        if (InterfaceElements.levelDisplay) {
            InterfaceElements.levelDisplay.textContent = GameState.currentLevel;
        }

        if (levelNumber === 1) {
            const titleElement = document.getElementById("tutorialTitle");
            const descriptionElement = document.getElementById("tutorialDesc");
            if (titleElement) titleElement.textContent = "MÀN 1: CƠ BẢN";
            if (descriptionElement) descriptionElement.innerHTML = "👉 Khối gạch vỡ sau 1 chạm.<br>🕹️ Điều khiển: Chuột hoặc phím mũi tên.<br>🖱️ Khởi động: Nhấn chuột trái.";
        }

        GameState.paddle.positionX = 240;
        buildLevelBricks();
        resetBallsToPaddle();
        renderGraphicsToScreen();
        expandGameplayContainer();

        InterfaceElements.victoryOverlay.classList.add("d-none");
        InterfaceElements.victoryOverlay.classList.remove("d-flex");
        InterfaceElements.tutorialOverlay.classList.remove("d-none");
        InterfaceElements.tutorialOverlay.classList.add("d-flex");
    }

    function saveCurrentProgressToStorage() {
        const brickMatrixForSave = [];
        for (let col = 0; col < LevelConfig.columnCount; col++) {
            brickMatrixForSave[col] = [];
            for (let row = 0; row < LevelConfig.rowCount; row++) {
                brickMatrixForSave[col][row] = GameState.activeBricks[col][row].isActive ? 1 : 0;
            }
        }

        const dataToSave = {
            level: GameState.currentLevel,
            score: GameState.currentScore,
            lives: GameState.currentLives,
            paddleX: GameState.paddle.positionX,
            isLaunched: GameState.isBallLaunched,
            savedBalls: GameState.activeBalls.map(ball => ({
                posX: ball.positionX,
                posY: ball.positionY,
                velX: ball.velocityX,
                velY: ball.velocityY,
                speed: ball.currentSpeed,
                isRed: ball.isFireball
            })),
            brickMatrix: brickMatrixForSave
        };
        localStorage.setItem("BRICK_BREAKER_SAVE", JSON.stringify(dataToSave));
        updateContinueButtonState();
    }

    function updateContinueButtonState() {
        if (!Buttons.continueGame) {
            return;
        }
        if (localStorage.getItem("BRICK_BREAKER_SAVE")) {
            Buttons.continueGame.removeAttribute("disabled");
        } else {
            Buttons.continueGame.setAttribute("disabled", "true");
        }
    }

    updateContinueButtonState();

    let callbackForReset = null;
    let modalInstanceForConfirm = null;
    const confirmModalNode = document.getElementById("confirmResetModal");
    if (confirmModalNode && typeof bootstrap !== "undefined") {
        modalInstanceForConfirm = new bootstrap.Modal(confirmModalNode);
    }

    function showWarningBeforeExecute(actionToRun) {
        if (localStorage.getItem("BRICK_BREAKER_SAVE")) {
            callbackForReset = actionToRun;
            if (modalInstanceForConfirm) {
                modalInstanceForConfirm.show();
            } else if (confirm("Tiến trình sẽ bị xóa. Bạn có muốn tiếp tục?")) {
                actionToRun();
            }
        } else {
            actionToRun();
        }
    }

    Buttons.newGame.addEventListener("click", () => {
        initializeAudioSystem();
        showWarningBeforeExecute(() => {
            localStorage.removeItem("BRICK_BREAKER_SAVE");
            updateContinueButtonState();
            InterfaceElements.homeActions.classList.add("d-none");
            InterfaceElements.homeActions.classList.remove("d-flex");
            InterfaceElements.levelSelectArea.classList.remove("d-none");
            InterfaceElements.levelSelectArea.classList.add("d-flex");
        });
    });

    Buttons.backToHome.addEventListener("click", () => {
        InterfaceElements.levelSelectArea.classList.add("d-none");
        InterfaceElements.levelSelectArea.classList.remove("d-flex");
        InterfaceElements.homeActions.classList.remove("d-none");
        InterfaceElements.homeActions.classList.add("d-flex");
    });

    document.querySelectorAll('.btn-level').forEach(buttonNode => {
        buttonNode.addEventListener("click", (event) => {
            const levelValue = parseInt(event.currentTarget.getAttribute("data-level"));
            loadSelectedLevelToScreen(levelValue);
        });
    });

    Buttons.startGameplay.addEventListener("click", () => {
        InterfaceElements.tutorialOverlay.classList.add("d-none");
        InterfaceElements.tutorialOverlay.classList.remove("d-flex");
        GameState.isGameRunning = true;
        resetBallsToPaddle();
        processMainGameLoop();
    });

    Buttons.continueGame.addEventListener("click", () => {
        initializeAudioSystem();
        const rawSavedString = localStorage.getItem("BRICK_BREAKER_SAVE");
        if (!rawSavedString) {
            return;
        }

        const parsedData = JSON.parse(rawSavedString);
        GameState.currentLevel = parsedData.level || 1;
        if (InterfaceElements.levelDisplay) {
            InterfaceElements.levelDisplay.textContent = GameState.currentLevel;
        }

        expandGameplayContainer();
        GameState.currentScore = parsedData.score;
        GameState.currentLives = parsedData.lives;
        GameState.paddle.positionX = parsedData.paddleX;
        GameState.isBallLaunched = parsedData.isLaunched;

        clearEntirePlayArea();
        setupPaddleElement();
        setupShieldElement();
        GameState.activeBalls = [];
        GameState.fallingItems = [];
        GameState.shield.isActive = false;
        GameState.paddle.hasFireballBuff = false;
        GameState.paddle.width = 120;

        parsedData.savedBalls.forEach(savedBall => {
            const recreatedBall = generateNewBallObject(savedBall.posX, savedBall.posY);
            recreatedBall.velocityX = savedBall.velX;
            recreatedBall.velocityY = savedBall.velY;
            recreatedBall.currentSpeed = savedBall.speed;
            recreatedBall.isFireball = savedBall.isRed;
            setupBallElement(recreatedBall);
            GameState.activeBalls.push(recreatedBall);
        });

        GameState.activeBricks = [];
        GameState.totalBricksToBreak = 0;
        for (let col = 0; col < LevelConfig.columnCount; col++) {
            GameState.activeBricks[col] = [];
            for (let row = 0; row < LevelConfig.rowCount; row++) {
                const brickStatus = parsedData.brickMatrix[col][row];
                let createdBrickElement = null;

                const calculatedX = col * (LevelConfig.brickWidth + LevelConfig.brickPadding) + LevelConfig.offsetLeft;
                const calculatedY = row * (LevelConfig.brickHeight + LevelConfig.brickPadding) + LevelConfig.offsetTop;

                if (brickStatus === 1) {
                    createdBrickElement = createHtmlElement("div", {
                        width: LevelConfig.brickWidth + "px",
                        height: LevelConfig.brickHeight + "px",
                        backgroundColor: LevelConfig.colors[row % LevelConfig.colors.length],
                        border: "1px solid rgba(0,0,0,0.3)",
                        left: calculatedX + "px",
                        top: calculatedY + "px",
                        boxSizing: "border-box"
                    });
                    InterfaceElements.playArea.appendChild(createdBrickElement);
                    GameState.totalBricksToBreak++;
                }

                GameState.activeBricks[col][row] = {
                    element: createdBrickElement,
                    positionX: calculatedX,
                    positionY: calculatedY,
                    isActive: brickStatus === 1
                };
            }
        }

        InterfaceElements.scoreDisplay.textContent = GameState.currentScore;
        InterfaceElements.livesDisplay.textContent = GameState.currentLives;

        if (!GameState.isBallLaunched) {
            InterfaceElements.launchHintOverlay.classList.remove("d-none");
            InterfaceElements.launchHintOverlay.classList.add("d-flex");
        }

        renderGraphicsToScreen();
        GameState.isGameRunning = true;
        processMainGameLoop();
    });

    Buttons.gameMenu.addEventListener("click", () => {
        GameState.isGameRunning = false;
        cancelAnimationFrame(GameState.animationFrameId);
        InterfaceElements.launchHintOverlay.classList.add("d-none");
        InterfaceElements.launchHintOverlay.classList.remove("d-flex");
        InterfaceElements.pauseOverlay.classList.remove("d-none");
        InterfaceElements.pauseOverlay.classList.add("d-flex");
    });

    Buttons.resumeGame.addEventListener("click", () => {
        InterfaceElements.pauseOverlay.classList.add("d-none");
        InterfaceElements.pauseOverlay.classList.remove("d-flex");
        GameState.isGameRunning = true;
        if (!GameState.isBallLaunched) {
            InterfaceElements.launchHintOverlay.classList.remove("d-none");
            InterfaceElements.launchHintOverlay.classList.add("d-flex");
        }
        processMainGameLoop();
    });

    Buttons.homeFromPause.addEventListener("click", () => {
        saveCurrentProgressToStorage();
        switchToHomeMenuScreen();
    });

    Buttons.selectLevelFromPause.addEventListener("click", () => {
        showWarningBeforeExecute(() => {
            localStorage.removeItem("BRICK_BREAKER_SAVE");
            updateContinueButtonState();
            switchToHomeMenuScreen();
            InterfaceElements.homeActions.classList.add("d-none");
            InterfaceElements.homeActions.classList.remove("d-flex");
            InterfaceElements.levelSelectArea.classList.remove("d-none");
            InterfaceElements.levelSelectArea.classList.add("d-flex");
        });
    });

    Buttons.exitFromPause.addEventListener("click", () => {
        saveCurrentProgressToStorage();
        switchToHomeMenuScreen();
        const exitModalNode = document.getElementById("exitModal");
        if (exitModalNode && typeof bootstrap !== "undefined") {
            new bootstrap.Modal(exitModalNode).show();
        }
    });

    Buttons.victoryContinue.addEventListener("click", () => {
        InterfaceElements.victoryOverlay.classList.add("d-none");
        InterfaceElements.victoryOverlay.classList.remove("d-flex");

        GameState.paddle.positionX = 240;
        buildLevelBricks();
        resetBallsToPaddle();
        renderGraphicsToScreen();
        GameState.isGameRunning = true;
        processMainGameLoop();
    });

    Buttons.victorySelectLevel.addEventListener("click", () => {
        switchToHomeMenuScreen();
        InterfaceElements.homeActions.classList.add("d-none");
        InterfaceElements.homeActions.classList.remove("d-flex");
        InterfaceElements.levelSelectArea.classList.remove("d-none");
        InterfaceElements.levelSelectArea.classList.add("d-flex");
    });

    Buttons.victoryHome.addEventListener("click", () => {
        switchToHomeMenuScreen();
    });

    Buttons.confirmReset.addEventListener("click", () => {
        if (modalInstanceForConfirm) modalInstanceForConfirm.hide();
        if (callbackForReset) {
            callbackForReset();
            callbackForReset = null;
        }
    });

    Buttons.confirmExit.addEventListener("click", () => {
        saveCurrentProgressToStorage();
        window.close();
        document.body.innerHTML = `<div class="text-center text-white p-5"><h2 class="text-warning">Cảm ơn bạn đã chơi!</h2><p>Tiến trình đã được lưu.</p></div>`;
    });

    const sfxVolumeSlider = document.getElementById("sfxSlider");
    if (sfxVolumeSlider) {
        sfxVolumeSlider.addEventListener("input", (event) => {
            GameState.soundVolume = event.target.value / 100;
        });
    }
});