document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-button');
    const titleButtonEnd = document.getElementById('title-button-end');
    const selectButtonEnd = document.getElementById('select-button-end');
    const startScreen = document.getElementById('start-screen');
    const selectScreen = document.getElementById('select-screen');
    const gameScreen = document.getElementById('game-screen');
    const endScreen = document.getElementById('end-screen');
    const endMessage = document.getElementById('end-message');
    const choicesList = document.getElementById('choices-list');
    const feedback = document.getElementById('feedback');
    const graphCanvas = document.getElementById('graph');
    const graphCtx = graphCanvas.getContext('2d');
    const monsterGrid = document.getElementById('monster-grid');
    const monsterImage = document.getElementById('monster-image');
    const playerHpDisplay = document.getElementById('player-hp');
    const monsterHpDisplay = document.getElementById('monster-hp-value');
    const currentStageDisplay = document.getElementById('current-stage');
    const titleButtonSelect = document.getElementById('title-button-select');
    const titleButtonGame = document.getElementById('title-button-game');
    const selectButtonGame = document.getElementById('select-button-game');

    let playerHp = 3;
    let monsterHp = 10;
    let selectedLevel = 1;
    let currentStage = 1;

    const func_list = [
        "X",
        "(X^2)",
        "(X^3)",
        "sin(X)",
        "cos(X)",
        "sin(X/2)",
        "cos(X/2)",
        "sin(X/4)",
        "cos(X/4)"
    ];

    const monsterImages = [
        "level1.png","level2.png","level3.png","level4.png","level5.png","level6","level7","level8","level9","level10","level11","level12","level13","level14","level15"
    ];

    // Audio files
    const audioFiles = {
        first: new Audio('first.mp3'),
        second: new Audio('second.mp3'),
        third: new Audio('third.mp3'),
        fourth: new Audio('fourth.mp3'),
        gameClear: new Audio('gameclear.mp3'),
        gameOver: new Audio('gameover.mp3'),
        selectBgm: new Audio('selectbgm.mp3'),
        trueSound: new Audio('True.mp3'),
        falseSound: new Audio('False.mp3'),
        pushSound: new Audio('push.mp3')
    };

    // Set loop property for specific audio files
    audioFiles.first.loop = true;
    audioFiles.second.loop = true;
    audioFiles.third.loop = true;
    audioFiles.fourth.loop = true;
    audioFiles.gameClear.loop = true;
    audioFiles.gameOver.loop = true;
    audioFiles.selectBgm.loop = true;

    startButton.addEventListener('click', () => {
        playPushSound();
        showSelectScreen();
    });
    titleButtonEnd.addEventListener('click', () => {
        playPushSound();
        showStartScreen();
    });
    selectButtonEnd.addEventListener('click', () => {
        playPushSound();
        showSelectScreen();
    });
    titleButtonSelect.addEventListener('click', () => {
        playPushSound();
        showStartScreen();
    });
    titleButtonGame.addEventListener('click', () => {
        playPushSound();
        showStartScreen();
    });
    selectButtonGame.addEventListener('click', () => {
        playPushSound();
        showSelectScreen();
    });

    function showStartScreen() {
        hideAllScreens();
        startScreen.classList.remove('hidden');
        stopAllAudio();
    }

    function showSelectScreen() {
        hideAllScreens();
        selectScreen.classList.remove('hidden');
        createMonsterGrid();
        playSelectBgm();
    }

    function hideAllScreens() {
        startScreen.classList.add('hidden');
        selectScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');
        endScreen.classList.add('hidden');
    }

    function createMonsterGrid() {
        monsterGrid.innerHTML = '';
        for (let i = 1; i <= 15; i++) {
            const monsterItem = document.createElement('div');
            monsterItem.className = 'monster-item';
            monsterItem.innerHTML = `
                <img src="${monsterImages[i-1]}" alt="Monster ${i}">
                <p>Lv ${i}</p>
            `;
            monsterItem.addEventListener('click', () => startQuiz(i));
            monsterGrid.appendChild(monsterItem);
        }
    }

    function startQuiz(level) {
        selectedLevel = level;
        hideAllScreens();
        gameScreen.classList.remove('hidden');
        playerHp = 3;
        monsterHp = 10;
        currentStage = 1;
        updateHpDisplay();
        updateStageDisplay();
        monsterImage.style.backgroundImage = `url(${monsterImages[level-1]})`;
        loadQuiz();

        playAudioForLevel(level);
    }

    function loadQuiz() {
        choicesList.innerHTML = '';
        feedback.textContent = '';
        const choices = generateChoices(selectedLevel);
        const correctAnswer = chooseAnswer(choices);

        choices.forEach((choice) => {
            const choiceElem = document.createElement('div');
            choiceElem.textContent = choice[0][0];
            choiceElem.className = 'choice';
            choiceElem.addEventListener('click', () => handleChoice(choice, correctAnswer));
            choicesList.appendChild(choiceElem);
        });

        drawGraph(correctAnswer);
    }

    function handleChoice(choice, correctAnswer) {
        if (choice === correctAnswer) {
            monsterHp--;
            feedback.textContent = '正解！';
            feedback.className = 'correct';
            currentStage++;
            playTrueSound();
        } else {
            playerHp--;
            feedback.textContent = '不正解！';
            feedback.className = 'incorrect';
            currentStage++;
            playFalseSound();
        }

        updateHpDisplay();
        updateStageDisplay();

        if (monsterHp <= 0) {
            endGame('ゲームクリア！');
        } else if (playerHp <= 0) {
            endGame('ゲームオーバー');
        } else {
            setTimeout(loadQuiz, 1000);
        }
    }

    function updateHpDisplay() {
        playerHpDisplay.textContent = playerHp;
        monsterHpDisplay.textContent = monsterHp;
    }

    function updateStageDisplay() {
        currentStageDisplay.textContent = currentStage;
    }

    function endGame(message) {
        hideAllScreens();
        endScreen.classList.remove('hidden');
        endMessage.textContent = message;

        if (message === 'ゲームクリア！') {
            playGameClearAudio();
        } else if (message === 'ゲームオーバー') {
            playGameOverAudio();
        }
    }

    function generateChoices(level) {
        let list = [];
        let funcStrings = [];

        while (list.length < 4) {
            const func = makeFunc(level);
            const funcStr = func[0][0];
            if (!funcStrings.includes(funcStr)) {
                list.push(func);
                funcStrings.push(funcStr);
            }
        }
        return list;
    }

    function chooseAnswer(choices) {
        return randomChoice(choices);
    }

    function drawGraph(funcDetails) {
        const xList = funcDetails[4];
        const yList = calculateYValues(funcDetails);
        graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
        const gridSize = 20; // Size of each grid square in pixels

        // Calculate axis positions to ensure they're on grid lines
        const xAxisY = Math.round(graphCanvas.height / 2 / gridSize) * gridSize;
        const yAxisX = Math.round(graphCanvas.width / 2 / gridSize) * gridSize;

        // Draw grid
        graphCtx.strokeStyle = '#444';
        graphCtx.lineWidth = 1;
        for (let x = 0; x <= graphCanvas.width; x += gridSize) {
            graphCtx.beginPath();
            graphCtx.moveTo(x, 0);
            graphCtx.lineTo(x, graphCanvas.height);
            graphCtx.stroke();
        }
        for (let y = 0; y <= graphCanvas.height; y += gridSize) {
            graphCtx.beginPath();
            graphCtx.moveTo(0, y);
            graphCtx.lineTo(graphCanvas.width, y);
            graphCtx.stroke();
        }

        // Draw axes
        graphCtx.strokeStyle = '#fff';
        graphCtx.lineWidth = 2;
        graphCtx.beginPath();
        graphCtx.moveTo(0, xAxisY);
        graphCtx.lineTo(graphCanvas.width, xAxisY);
        graphCtx.moveTo(yAxisX, 0);
        graphCtx.lineTo(yAxisX, graphCanvas.height);
        graphCtx.stroke();

        // Draw tick marks and labels
        graphCtx.fillStyle = '#fff';
        graphCtx.font = '12px Arial';
        graphCtx.textAlign = 'center';
        graphCtx.textBaseline = 'middle';
        for (let i = -8; i <= 8; i++) {
            const x = yAxisX + i * gridSize;
            const y = xAxisY - i * gridSize;

            // X-axis ticks and labels
            graphCtx.beginPath();
            graphCtx.moveTo(x, xAxisY - 5);
            graphCtx.lineTo(x, xAxisY + 5);
            graphCtx.stroke();
            if (i !== 0) {
                graphCtx.fillText(i.toString(), x, xAxisY + 20);
            }

            // Y-axis ticks and labels
            graphCtx.beginPath();
            graphCtx.moveTo(yAxisX - 5, y);
            graphCtx.lineTo(yAxisX + 5, y);
            graphCtx.stroke();
            if (i !== 0) {
                graphCtx.fillText(i.toString(), yAxisX - 20, y);
            }
        }

        // Draw graph
        graphCtx.strokeStyle = '#00ff00';
        graphCtx.lineWidth = 2;
        graphCtx.beginPath();
        const scale = gridSize; // 1 unit = 40 pixels
        for (let i = 0; i < xList.length; i++) {
            const x = yAxisX + xList[i] * scale;
            const y = xAxisY - yList[i] * scale;
            if (i === 0) {
                graphCtx.moveTo(x, y);
            } else {
                graphCtx.lineTo(x, y);
            }
        }
        graphCtx.stroke();
    }

    function calculateYValues(funcDetails) {
        const funcs = funcDetails[1];
        const nums = funcDetails[2];
        const signs = funcDetails[3];
        const xList = funcDetails[4];
        return xList.map(x => {
            let y = 0;
            funcs.forEach((func, i) => {
                const preY = evaluateFunction(func, x);
                const sign = signs[i] === "-" ? -1 : 1;
                y += sign * nums[i] * preY;
            });
            return y;
        });
    }

    function evaluateFunction(func, x) {
        switch (func) {
            case "X": return x;
            case "(X^2)": return x ** 2;
            case "(X^3)": return x ** 3;
            case "sin(X)": return Math.sin(x);
            case "cos(X)": return Math.cos(x);
            case "sin(X/2)": return Math.sin(x / 2);
            case "cos(X/2)": return Math.cos(x / 2);
            case "sin(X/4)": return Math.sin(x / 4);
            case "cos(X/4)": return Math.cos(x / 4);
            default: return 0;
        }
    }

    function makeFunc(level) {
        const funcRange = Math.max(3, Math.min(level, 9)); // 最小値を3に設定
        const countFuncs = countFuncsForLevel(level);
        const xList = Array.from({ length: 201 }, (_, i) => (i - 100) / 10);

        // レベルに応じて関数の選択範囲を調整
        let chosenFuncs;
        if (level <= 3) {
            // レベル1-3の場合は、最初の3つの基本関数から選択
            chosenFuncs = randomSample(func_list.slice(0, 3), countFuncs);
        } else if (level >= 9 && Math.random() * 10 <= 3) {
            // レベル9以上で、30%の確率で基本関数を含める
            chosenFuncs = randomSample(func_list.slice(0, 3), countFuncs);
        } else {
            // それ以外の場合は、より複雑な関数から選択
            chosenFuncs = randomSample(func_list.slice(3, funcRange), countFuncs);
        }

        let mixFunc = "";
        let numList = [];
        let signList = [];

        chosenFuncs.forEach((func, i) => {
            const num = randomChoice(["2", "3", "4"]);
            const sign = i === 0 ? randomChoice(["", "-"]) : randomChoice(["+", "-"]);
            mixFunc += `${sign}${num}${func}`;
            numList.push(parseInt(num));
            signList.push(sign);
        });

        return [[mixFunc], chosenFuncs, numList, signList, xList];
    }

    function countFuncsForLevel(level) {
        if (level <= 7) return 1;
        if (level <= 14) return 2;
        return 3;
    }

    function randomChoice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function randomSample(arr, num) {
        const shuffled = arr.slice();
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, num);
    }

// Audio functions
    function playAudioForLevel(level) {
        stopAllAudio();

        if (level >= 1 && level <= 5) {
            audioFiles.first.play();
        } else if (level >= 6 && level <= 10) {
            audioFiles.second.play();
        } else if (level >= 11 && level <= 14) {
            audioFiles.third.play();
        } else if (level === 15) {
            audioFiles.fourth.play();
        }
    }

    function playSelectBgm() {
        stopAllAudio();
        audioFiles.selectBgm.play();
    }

    function playGameClearAudio() {
        stopAllAudio();
        audioFiles.gameClear.play();
    }

    function playGameOverAudio() {
        stopAllAudio();
        audioFiles.gameOver.play();
    }

    function playTrueSound() {
        audioFiles.trueSound.play();
    }

    function playFalseSound() {
        audioFiles.falseSound.play();
    }

    function playPushSound() {
        audioFiles.pushSound.play();
    }

    function stopAllAudio() {
        Object.values(audioFiles).forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
    }
});
