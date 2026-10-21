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
        bossProjectiles: [],
        bossAttackTimer: 0,
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
        soundVolume: 0.7,
        triggerCooldown: 0
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
        if (!GameState.audioContext || GameState.soundVolume <= 0) return;
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
        } catch (error) {}
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
        GameState.bossProjectiles = [];
        GameState.bossAttackTimer = 0;
        GameState.totalBricksToBreak = 0;
        GameState.paddle.width = 120;
        GameState.paddle.hasFireballBuff = false;
        GameState.shield.isActive = false;
        GameState.triggerCooldown = 0;

        for (let col = 0; col < LevelConfig.columnCount; col++) {
            GameState.activeBricks[col] = [];
            for (let row = 0; row < LevelConfig.rowCount; row++) {
                let brickHp = 1;
                let brickColor = LevelConfig.colors[row % LevelConfig.colors.length];
                let isUnbreakable = false;
                let isHidden = false;
                let isHideable = false;
                let isTrigger = false;
                let isHealer = false;
                let isBoss = false;
                let isActive = true;

                if (GameState.currentLevel === 1) {
                    brickColor = "#00f2fe";
                } else if (GameState.currentLevel === 2) {
                    const Level2Colors = { 5: "#ff4757", 4: "#ffa502", 3: "#eccc68", 2: "#2ed573", 1: "#1e90ff" };
                    if (row < 2) brickHp = 5;
                    else if (row < 4) brickHp = 4;
                    else if (row < 7) brickHp = 3;
                    else if (row < 9) brickHp = 2;
                    else brickHp = 1;
                    brickColor = Level2Colors[brickHp];
                } else if (GameState.currentLevel === 3) {
                    if (row === 4 || row === 8) {
                        if (col !== 2 && col !== 7 && col !== 12) {
                            isUnbreakable = true;
                            brickHp = -1;
                            brickColor = "#7f8c8d";
                        }
                    }
                } else if (GameState.currentLevel === 4) {
                    if ((row === 3 && col === 7) || (row === 6 && col === 3) || (row === 6 && col === 11)) {
                        isTrigger = true;
                        isUnbreakable = true;
                        brickHp = -1;
                        brickColor = "#ff9f43";
                    } else if (row >= 2 && row <= 8 && col >= 2 && col <= 12) {
                        isHidden = true;
                        isHideable = true;
                        brickColor = "#1dd1a1";
                    } else {
                        isActive = false;
                    }
                } else if (GameState.currentLevel === 5) {
                    isActive = false;
                    brickHp = 1;
                    brickColor = "#1e90ff";

                    if (row === 0 || row === 1 || row === 10 || row === 11 || col === 0 || col === 14) {
                        isActive = true;
                    }

                    const centers = [[3, 3], [3, 11], [8, 7]];
                    for (let i = 0; i < centers.length; i++) {
                        const cr = centers[i][0];
                        const cc = centers[i][1];
                        const dr = Math.abs(row - cr);
                        const dc = Math.abs(col - cc);

                        if (dr === 0 && dc === 0) {
                            isHealer = true;
                            brickHp = 2;
                            brickColor = "#e84393";
                            isActive = true;
                        } else if (dr <= 2 && dc <= 2) {
                            brickHp = 2;
                            brickColor = "#2ed573";
                            isActive = true;
                        }
                    }
                } else if (GameState.currentLevel === 6) {
                    isActive = false;
                    brickHp = 1;
                    brickColor = "#1e90ff";

                    if (row === 3 && (col === 6 || col === 8)) {
                        isUnbreakable = true;
                        brickHp = -1;
                        brickColor = "#ff4757";
                        isActive = true;
                    } else if (row === 3 && col === 7) {
                        isBoss = true;
                        isUnbreakable = false;
                        brickHp = 30;
                        brickColor = "#2f3640";
                        isActive = true;
                    } else if (row === 0 || row === 1 || col === 0 || col === 14) {
                        isActive = true;
                        brickHp = 2;
                        brickColor = "#9c88ff";
                    }
                }

                if (!isActive) {
                    GameState.activeBricks[col][row] = { isActive: false };
                    continue;
                }

                const calculatedX = col * (LevelConfig.brickWidth + LevelConfig.brickPadding) + LevelConfig.offsetLeft;
                const calculatedY = row * (LevelConfig.brickHeight + LevelConfig.brickPadding) + LevelConfig.offsetTop;

                const finalWidth = isBoss ? LevelConfig.brickWidth * 3 : LevelConfig.brickWidth;
                const finalHeight = isBoss ? LevelConfig.brickHeight * 2 : LevelConfig.brickHeight;

                const brickElement = createHtmlElement("div", {
                    width: finalWidth + "px",
                    height: finalHeight + "px",
                    backgroundColor: brickColor,
                    border: isUnbreakable ? "2px solid #2c3e50" : "1px solid rgba(0,0,0,0.3)",
                    left: calculatedX + "px",
                    top: calculatedY + "px",
                    boxSizing: "border-box",
                    opacity: isHidden ? "0" : "1",
                    transition: "opacity 0.4s, box-shadow 0.3s, background-color 0.3s"
                });

                if (isTrigger) {
                    brickElement.style.boxShadow = "0 0 12px #ff9f43";
                } else if (isBoss) {
                    brickElement.style.boxShadow = "0 0 15px #ff4757";
                }

                InterfaceElements.playArea.appendChild(brickElement);

                GameState.activeBricks[col][row] = {
                    element: brickElement,
                    positionX: calculatedX,
                    positionY: calculatedY,
                    width: finalWidth,
                    height: finalHeight,
                    isActive: true,
                    hp: brickHp,
                    hitCooldown: 0,
                    isUnbreakable: isUnbreakable,
                    isHidden: isHidden,
                    isHideable: isHideable,
                    isTrigger: isTrigger,
                    isTriggerOn: isTrigger ? true : false,
                    isHealer: isHealer,
                    isBoss: isBoss,
                    healTimer: 0
                };

                if (!isUnbreakable) {
                    GameState.totalBricksToBreak++;
                }
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
        if (!GameState.isGameRunning || GameState.isBallLaunched) return;

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
        if (["Right", "ArrowRight", "d", "D"].includes(event.key)) GameState.controls.moveRight = true;
        if (["Left", "ArrowLeft", "a", "A"].includes(event.key)) GameState.controls.moveLeft = true;
    });

    document.addEventListener("keyup", (event) => {
        if (["Right", "ArrowRight", "d", "D"].includes(event.key)) GameState.controls.moveRight = false;
        if (["Left", "ArrowLeft", "a", "A"].includes(event.key)) GameState.controls.moveLeft = false;
    });

    InterfaceElements.playArea.addEventListener("mousemove", (event) => {
        if (!GameState.isGameRunning) return;
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

    InterfaceElements.playArea.addEventListener("click", launchAllBalls);

    function spawnRandomItem(spawnX, spawnY) {
        if (Math.random() >= 0.25) return;

        const standardItems = [
            { type: "expand", color: "#ffffff", iconFile: "expand.png" },
            { type: "life", color: "#ffffff", iconFile: "life.png" },
            { type: "slow", color: "#ffffff", iconFile: "slow.png" },
            { type: "fireball", color: "#ffffff", iconFile: "fireball.png" },
            { type: "shield", color: "#ffffff", iconFile: "shield.png" }
        ];

        if (GameState.activeBalls.length <= 2) {
            standardItems.push({ type: "split", color: "#ffffff", iconFile: "split.png" });
            standardItems.push({ type: "shoot", color: "#ffffff", iconFile: "shoot.png" });
        }

        const pickedItemInfo = standardItems[Math.floor(Math.random() * standardItems.length)];

        const itemElement = createHtmlElement("div", {
            width: "24px",
            height: "24px",
            backgroundColor: pickedItemInfo.color,
            borderRadius: "4px",
            backgroundImage: `url('assets/icon_Item/${pickedItemInfo.iconFile}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            cursor: "default"
        });
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

    function processBrickHit(brickObject) {
        if (brickObject.isTrigger) {
            playCollisionSound();
            if (GameState.triggerCooldown > 0) return;
            GameState.triggerCooldown = 60;
            const newState = !brickObject.isTriggerOn;

            for (let c = 0; c < LevelConfig.columnCount; c++) {
                for (let r = 0; r < LevelConfig.rowCount; r++) {
                    const b = GameState.activeBricks[c][r];
                    if (b && b.isActive) {
                        if (b.isTrigger) {
                            b.hitCooldown = 15;
                            b.isTriggerOn = newState;
                            if (b.isTriggerOn) {
                                b.element.style.backgroundColor = "#ff9f43";
                                b.element.style.boxShadow = "0 0 12px #ff9f43";
                            } else {
                                b.element.style.backgroundColor = "#d35400";
                                b.element.style.boxShadow = "none";
                            }
                        } else if (b.isHideable) {
                            b.isHidden = newState;
                            b.element.style.opacity = b.isHidden ? "0" : "1";
                        }
                    }
                }
            }
            return;
        }

        if (brickObject.isUnbreakable) {
            playCollisionSound();
            brickObject.hitCooldown = 15;
            return;
        }

        brickObject.hp--;
        brickObject.hitCooldown = 15;

        if (brickObject.hp > 0) {
            if (GameState.currentLevel === 2 || (GameState.currentLevel === 5 && !brickObject.isHealer)) {
                const Level2Colors = { 5: "#ff4757", 4: "#ffa502", 3: "#eccc68", 2: "#2ed573", 1: "#1e90ff" };
                brickObject.element.style.backgroundColor = Level2Colors[brickObject.hp] || "#1e90ff";
            } else if (GameState.currentLevel === 5 && brickObject.isHealer) {
                brickObject.element.style.backgroundColor = "#fd79a8";
            } else if (GameState.currentLevel === 6 && brickObject.isBoss) {
                brickObject.element.style.backgroundColor = "#ff4757";
            }
            GameState.currentScore += 5;
            InterfaceElements.scoreDisplay.textContent = GameState.currentScore;
            playCollisionSound();
        } else {
            brickObject.isActive = false;
            brickObject.element.remove();

            GameState.currentScore += 10;
            InterfaceElements.scoreDisplay.textContent = GameState.currentScore;
            GameState.totalBricksToBreak--;

            playCollisionSound();
            spawnRandomItem(brickObject.positionX + (brickObject.width || LevelConfig.brickWidth) / 2, brickObject.positionY + (brickObject.height || LevelConfig.brickHeight) / 2);

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
    }

    function checkCollisionBetweenBallsAndBricks() {
        for (let col = 0; col < LevelConfig.columnCount; col++) {
            for (let row = 0; row < LevelConfig.rowCount; row++) {
                const brick = GameState.activeBricks[col][row];
                if (brick && brick.isActive && brick.hitCooldown > 0) {
                    brick.hitCooldown--;
                }
            }
        }

        GameState.activeBalls.forEach(ball => {
            let hasBouncedThisFrame = false;

            for (let col = 0; col < LevelConfig.columnCount; col++) {
                for (let row = 0; row < LevelConfig.rowCount; row++) {
                    const brick = GameState.activeBricks[col][row];

                    if (brick && brick.isActive && brick.hitCooldown <= 0 && !brick.isHidden) {
                        const bWidth = brick.width || LevelConfig.brickWidth;
                        const bHeight = brick.height || LevelConfig.brickHeight;

                        const isOverlappingX = ball.positionX + ball.radius > brick.positionX && ball.positionX - ball.radius < brick.positionX + bWidth;
                        const isOverlappingY = ball.positionY + ball.radius > brick.positionY && ball.positionY - ball.radius < brick.positionY + bHeight;

                        if (isOverlappingX && isOverlappingY) {
                            if ((!ball.isFireball || brick.isUnbreakable) && !hasBouncedThisFrame) {
                                const overlapLeft = (ball.positionX + ball.radius) - brick.positionX;
                                const overlapRight = (brick.positionX + bWidth) - (ball.positionX - ball.radius);
                                const overlapTop = (ball.positionY + ball.radius) - brick.positionY;
                                const overlapBottom = (brick.positionY + bHeight) - (ball.positionY - ball.radius);

                                const minOverlapX = Math.min(overlapLeft, overlapRight);
                                const minOverlapY = Math.min(overlapTop, overlapBottom);

                                if (minOverlapX < minOverlapY) {
                                    ball.velocityX = -ball.velocityX;
                                } else {
                                    ball.velocityY = -ball.velocityY;
                                }

                                hasBouncedThisFrame = true;
                            }
                            processBrickHit(brick);
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
        if (!GameState.isGameRunning) return;

        if (GameState.shield.isActive) {
            GameState.shield.remainingTime--;
            if (GameState.shield.remainingTime <= 0) {
                GameState.shield.isActive = false;
            }
        }

        if (GameState.triggerCooldown > 0) {
            GameState.triggerCooldown--;
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

                if (ball.positionX - ball.radius <= 0) {
                    ball.positionX = ball.radius;
                    ball.velocityX = -ball.velocityX;
                    playCollisionSound();
                } else if (ball.positionX + ball.radius >= 600) {
                    ball.positionX = 600 - ball.radius;
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

            if (GameState.currentLevel === 5) {
                const healerBadge = document.getElementById("healerHudBadge");
                const timerDisplay = document.getElementById("healerTimerDisplay");
                if (healerBadge) healerBadge.classList.remove("d-none");

                for (let c = 0; c < LevelConfig.columnCount; c++) {
                    for (let r = 0; r < LevelConfig.rowCount; r++) {
                        const core = GameState.activeBricks[c][r];
                        if (core && core.isActive && core.isHealer) {
                            core.healTimer++;
                            const remainingSeconds = Math.ceil((3600 - core.healTimer) / 60);
                            if (timerDisplay) timerDisplay.textContent = Math.max(0, remainingSeconds);

                            if (core.healTimer >= 3600) {
                                core.healTimer = 0;

                                if (core.hp < 2) {
                                    core.hp++;
                                    core.element.style.backgroundColor = "#e84393";
                                }

                                for (let dc = -2; dc <= 2; dc++) {
                                    for (let dr = -2; dr <= 2; dr++) {
                                        if (dc === 0 && dr === 0) continue;
                                        const nc = c + dc;
                                        const nr = r + dr;

                                        if (nc >= 0 && nc < LevelConfig.columnCount && nr >= 0 && nr < LevelConfig.rowCount) {
                                            const target = GameState.activeBricks[nc][nr];
                                            if (target && target.isActive && !target.isHealer) {
                                                if (target.hp < 3) {
                                                    target.hp++;
                                                    const Level2Colors = { 5: "#ff4757", 4: "#ffa502", 3: "#eccc68", 2: "#2ed573", 1: "#1e90ff" };
                                                    target.element.style.backgroundColor = Level2Colors[target.hp] || "#1e90ff";
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
                const healerBadge = document.getElementById("healerHudBadge");
                if (healerBadge) healerBadge.classList.add("d-none");
            }

            if (GameState.currentLevel === 6) {
                const bossBadge = document.getElementById("bossHudBadge");
                const bossHpDisplay = document.getElementById("bossHpDisplay");
                if (bossBadge) bossBadge.classList.remove("d-none");

                let bossX = 300;
                let bossY = 100;
                let bossAlive = false;

                for (let c = 0; c < LevelConfig.columnCount; c++) {
                    for (let r = 0; r < LevelConfig.rowCount; r++) {
                        const b = GameState.activeBricks[c][r];
                        if (b && b.isActive && b.isBoss) {
                            bossAlive = true;
                            bossX = b.positionX + (b.width || LevelConfig.brickWidth) / 2;
                            bossY = b.positionY + (b.height || LevelConfig.brickHeight);
                            if (bossHpDisplay) bossHpDisplay.textContent = b.hp;
                        }
                    }
                }

                if (bossAlive) {
                    GameState.bossAttackTimer++;
                    if (GameState.bossAttackTimer >= 300) {
                        GameState.bossAttackTimer = 0;

                        const bulletEl = createHtmlElement("div", {
                            width: "8px",
                            height: "16px",
                            backgroundColor: "#ff4757",
                            borderRadius: "4px",
                            boxShadow: "0 0 8px #ff4757"
                        });
                        InterfaceElements.playArea.appendChild(bulletEl);

                        GameState.bossProjectiles.push({
                            positionX: bossX,
                            positionY: bossY,
                            speedY: 2.0,
                            element: bulletEl
                        });
                    }
                }

                for (let i = GameState.bossProjectiles.length - 1; i >= 0; i--) {
                    const p = GameState.bossProjectiles[i];
                    p.positionY += p.speedY;
                    p.element.style.transform = `translate(${p.positionX - 4}px, ${p.positionY}px)`;

                    const hitPaddleY = p.positionY + 16 >= GameState.paddle.positionY && p.positionY <= GameState.paddle.positionY + GameState.paddle.height;
                    const hitPaddleX = p.positionX >= GameState.paddle.positionX && p.positionX <= GameState.paddle.positionX + GameState.paddle.width;

                    if (hitPaddleY && hitPaddleX) {
                        p.element.remove();
                        GameState.bossProjectiles.splice(i, 1);

                        if (!GameState.shield.isActive) {
                            GameState.currentLives--;
                            InterfaceElements.livesDisplay.textContent = GameState.currentLives;
                            playCollisionSound();

                            if (GameState.currentLives <= 0) {
                                localStorage.removeItem("BRICK_BREAKER_SAVE");
                                updateContinueButtonState();
                                switchToHomeMenuScreen();
                                return;
                            }
                        } else {
                            GameState.shield.isActive = false;
                        }
                    } else if (p.positionY > 750) {
                        p.element.remove();
                        GameState.bossProjectiles.splice(i, 1);
                    }
                }
            } else {
                const bossBadge = document.getElementById("bossHudBadge");
                if (bossBadge) bossBadge.classList.add("d-none");

                GameState.bossProjectiles.forEach(p => p.element.remove());
                GameState.bossProjectiles = [];
            }
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
            InterfaceElements.levelDisplay.textContent = `MÀN ${GameState.currentLevel}`;
        }

        const tutorialData = {
            1: {
                title: "MÀN 1: GẠCH CƠ BẢN",
                desc: "👉 Khối gạch vỡ sau 1 chạm.<br>🕹️ Điều khiển: Chuột hoặc phím mũi tên.<br>🖱️ Khởi động: Nhấn chuột trái."
            },
            2: {
                title: "MÀN 2: GẠCH NHIỀU MÁU",
                desc: "👉 Có những khối gạch cứng cần đập nhiều lần mới vỡ.<br>⚠️ Hãy chú ý màu sắc để biết độ bền của gạch."
            },
            3: {
                title: "MÀN 3: GẠCH THANH CHẮN",
                desc: "👉 Xuất hiện các thanh chắn kim loại vĩnh cửu không thể bị phá vỡ.<br>⚠️ Bạn phải khéo léo lách bóng qua các khe hở."
            },
            4: {
                title: "MÀN 4: GẠCH BỊ ẨN",
                desc: "👉 Một số khối gạch tàng hình và chỉ lộ diện khi bóng chạm vào khối nút chỉ định.<br>⚠ Nếu chạm nút lần nữa, gạch sẽ tàng hình lại."
            },
            5: {
                title: "MÀN 5: GẠCH HỒI PHỤC",
                desc: "👉 Có 3 quả cầu đặc biệt. Lõi ở giữa sẽ bơm máu cho gạch xung quanh mỗi 60s.<br>⚠️ Gạch đã vỡ sẽ không thể mọc lại, hãy ưu tiên tiêu diệt lõi."
            },
            6: {
                title: "MÀN 6: GẠCH BOSS",
                desc: "👉 Đối đầu với trùm cuối. Khối gạch khổng lồ có lượng máu lớn và tự động bắn đạn tấn công.<br>⚠ Hãy né tránh và tiêu diệt trùm!"
            }
        };

        const activeTutorial = tutorialData[levelNumber] || tutorialData[1];
        const titleElement = document.getElementById("tutorialTitle");
        const descriptionElement = document.getElementById("tutorialDesc");

        if (titleElement) titleElement.textContent = activeTutorial.title;
        if (descriptionElement) descriptionElement.innerHTML = activeTutorial.desc;

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
        if (!GameState.activeBricks || GameState.totalBricksToBreak <= 0) return;

        const brickMatrixForSave = [];
        for (let col = 0; col < LevelConfig.columnCount; col++) {
            brickMatrixForSave[col] = [];
            for (let row = 0; row < LevelConfig.rowCount; row++) {
                let sv = 0;
                const b = GameState.activeBricks[col][row];
                if (b && b.isActive) {
                    if (b.isTrigger) {
                        sv = b.isTriggerOn ? -2 : -3;
                    } else if (b.isUnbreakable) {
                        sv = -1;
                    } else {
                        sv = b.hp;
                        if (b.isHidden) sv += 100;
                    }
                }
                brickMatrixForSave[col][row] = sv;
            }
        }

        const dataToSave = {
            level: GameState.currentLevel,
            score: GameState.currentScore,
            lives: GameState.currentLives,
            paddleX: GameState.paddle.positionX,
            paddleY: 705,
            isLaunched: GameState.isBallLaunched,
            savedBalls: GameState.activeBalls.map(ball => ({
                posX: ball.positionX > 0 ? ball.positionX : GameState.paddle.positionX + 60,
                posY: ball.posY > 0 ? ball.posY : 690,
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
        if (!Buttons.continueGame) return;

        const savedData = localStorage.getItem("BRICK_BREAKER_SAVE");
        if (savedData && savedData !== "undefined" && savedData !== "null") {
            Buttons.continueGame.removeAttribute("disabled");
            Buttons.continueGame.classList.remove("disabled");
            Buttons.continueGame.style.opacity = "1";
            Buttons.continueGame.style.pointerEvents = "auto";
        } else {
            Buttons.continueGame.setAttribute("disabled", "true");
            Buttons.continueGame.classList.add("disabled");
            Buttons.continueGame.style.opacity = "0.5";
            Buttons.continueGame.style.pointerEvents = "none";
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
        if (!rawSavedString) return;

        const parsedData = JSON.parse(rawSavedString);
        GameState.currentLevel = parsedData.level || 1;
        if (InterfaceElements.levelDisplay) {
            InterfaceElements.levelDisplay.textContent = `MÀN ${GameState.currentLevel}`;
        }

        expandGameplayContainer();
        GameState.currentScore = parsedData.score;
        GameState.currentLives = parsedData.lives;
        GameState.paddle.positionX = parsedData.paddleX;
        GameState.paddle.positionY = 705;
        GameState.isBallLaunched = parsedData.isLaunched;

        clearEntirePlayArea();
        setupPaddleElement();
        setupShieldElement();
        GameState.activeBalls = [];
        GameState.fallingItems = [];
        GameState.bossProjectiles = [];
        GameState.bossAttackTimer = 0;
        GameState.shield.isActive = false;
        GameState.paddle.hasFireballBuff = false;
        GameState.paddle.width = 120;

        parsedData.savedBalls.forEach(savedBall => {
            const recreatedBall = generateNewBallObject(
                savedBall.posX > 0 ? savedBall.posX : GameState.paddle.positionX + 60,
                savedBall.posY > 0 ? savedBall.posY : 690
            );
            recreatedBall.velocityX = savedBall.velX;
            recreatedBall.velocityY = savedBall.velY;
            recreatedBall.currentSpeed = savedBall.speed;
            recreatedBall.isFireball = savedBall.isRed;
            setupBallElement(recreatedBall);
            GameState.activeBalls.push(recreatedBall);
        });

        let hasValidBricks = false;
        if (parsedData.brickMatrix) {
            for (let c = 0; c < LevelConfig.columnCount; c++) {
                for (let r = 0; r < LevelConfig.rowCount; r++) {
                    if (parsedData.brickMatrix[c] && parsedData.brickMatrix[c][r] !== 0) {
                        hasValidBricks = true;
                        break;
                    }
                }
                if (hasValidBricks) break;
            }
        }

        if (!hasValidBricks) {
            buildLevelBricks();
            resetBallsToPaddle();
        } else {
            GameState.activeBricks = [];
            GameState.totalBricksToBreak = 0;

            for (let col = 0; col < LevelConfig.columnCount; col++) {
                GameState.activeBricks[col] = [];
                for (let row = 0; row < LevelConfig.rowCount; row++) {
                    const sv = parsedData.brickMatrix[col][row];
                    let createdBrickElement = null;
                    const calculatedX = col * (LevelConfig.brickWidth + LevelConfig.brickPadding) + LevelConfig.offsetLeft;
                    const calculatedY = row * (LevelConfig.brickHeight + LevelConfig.brickPadding) + LevelConfig.offsetTop;

                    let hp = sv;
                    let isU = false;
                    let isH = false;
                    let isHideable = false;
                    let isT = false;
                    let isTOn = false;
                    let isHealer = false;
                    let isBoss = false;
                    let isActive = sv !== 0;
                    let c = LevelConfig.colors[row % LevelConfig.colors.length];

                    if (GameState.currentLevel === 1) {
                        c = "#00f2fe";
                    } else if (GameState.currentLevel === 2 || GameState.currentLevel === 5) {
                        const L2 = { 5: "#ff4757", 4: "#ffa502", 3: "#eccc68", 2: "#2ed573", 1: "#1e90ff" };
                        c = L2[hp] || "#1e90ff";
                    } else if (GameState.currentLevel === 4) {
                        isHideable = true;
                        c = "#1dd1a1";
                    } else if (GameState.currentLevel === 6) {
                        if (row === 3 && col === 7) {
                            isBoss = true;
                            c = "#ff4757";
                        }
                    }

                    if (GameState.currentLevel === 5) {
                        const centers = [[3, 3], [3, 11], [8, 7]];
                        for (let i = 0; i < centers.length; i++) {
                            const cr = centers[i][0];
                            const cc = centers[i][1];
                            const dr = Math.abs(row - cr);
                            const dc = Math.abs(col - cc);

                            if (dr === 0 && dc === 0) {
                                isHealer = true;
                                c = (hp === 2) ? "#e84393" : "#fd79a8";
                            }
                        }
                    }

                    if (sv !== 0) {
                        if (hp === -1) {
                            isU = true;
                            c = "#7f8c8d";
                        } else if (hp === -2 || hp === -3) {
                            isU = true;
                            isT = true;
                            isTOn = (hp === -2);
                            hp = -1;
                            c = isTOn ? "#ff9f43" : "#d35400";
                        } else {
                            if (hp >= 100) {
                                isH = true;
                                hp -= 100;
                            }
                        }

                        const finalWidth = isBoss ? LevelConfig.brickWidth * 3 : LevelConfig.brickWidth;
                        const finalHeight = isBoss ? LevelConfig.brickHeight * 2 : LevelConfig.brickHeight;

                        createdBrickElement = createHtmlElement("div", {
                            width: finalWidth + "px",
                            height: finalHeight + "px",
                            backgroundColor: c,
                            border: isU ? (isT ? "2px solid #fff" : "2px solid #2c3e50") : "1px solid rgba(0,0,0,0.3)",
                            left: calculatedX + "px",
                            top: calculatedY + "px",
                            boxSizing: "border-box",
                            opacity: isH ? "0" : "1",
                            transition: "opacity 0.4s, box-shadow 0.3s, background-color 0.3s"
                        });

                        if (isT && isTOn) createdBrickElement.style.boxShadow = "0 0 12px #ff9f43";
                        if (isBoss) createdBrickElement.style.boxShadow = "0 0 15px #ff4757";

                        if (isActive) {
                            InterfaceElements.playArea.appendChild(createdBrickElement);
                            if (!isU) GameState.totalBricksToBreak++;
                        }
                    }

                    GameState.activeBricks[col][row] = {
                        element: createdBrickElement,
                        positionX: calculatedX,
                        positionY: calculatedY,
                        width: finalWidth,
                        height: finalHeight,
                        isActive: isActive,
                        hp: hp,
                        hitCooldown: 0,
                        isUnbreakable: isU,
                        isHidden: isH,
                        isHideable: isHideable,
                        isTrigger: isT,
                        isTriggerOn: isTOn,
                        isHealer: isHealer,
                        isBoss: isBoss,
                        healTimer: 0
                    };
                }
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
    });

    Buttons.victoryContinue.addEventListener("click", () => {
        InterfaceElements.victoryOverlay.classList.add("d-none");
        InterfaceElements.victoryOverlay.classList.remove("d-flex");

        GameState.currentLevel = Math.min(6, GameState.currentLevel + 1);
        if (InterfaceElements.levelDisplay) {
            InterfaceElements.levelDisplay.textContent = `MÀN ${GameState.currentLevel}`;
        }

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