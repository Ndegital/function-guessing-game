'use strict';

document.addEventListener('DOMContentLoaded', () => {
    /* =====================================================
       DOM
       ===================================================== */
    const $ = (id) => document.getElementById(id);

    const screens = {
        start: $('start-screen'),
        select: $('select-screen'),
        game: $('game-screen'),
        end: $('end-screen')
    };
    const endMessage = $('end-message');
    const endEyebrow = $('end-eyebrow');
    const choicesList = $('choices-list');
    const feedback = $('feedback');
    const graphCanvas = $('graph');
    const graphCtx = graphCanvas.getContext('2d');
    const monsterGrid = $('monster-grid');
    const monsterImage = $('monster-image');
    const monsterSprite = document.querySelector('.monster-sprite');
    const monsterLevelDisplay = $('monster-level');
    const monsterHpFill = $('monster-hp-fill');
    const monsterHpBar = document.querySelector('.hp-bar');
    const playerHpDisplay = $('player-hp');
    const playerHearts = $('player-hearts');
    const monsterHpDisplay = $('monster-hp-value');
    const currentStageDisplay = $('current-stage');
    const quizPanel = $('quiz-panel');
    const damagePop = $('damage-pop');
    const damageFlash = $('damage-flash');

    /* =====================================================
       定数・状態
       ===================================================== */
    const MAX_PLAYER_HP = 3;
    const MAX_MONSTER_HP = 10;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let playerHp = MAX_PLAYER_HP;
    let monsterHp = MAX_MONSTER_HP;
    let selectedLevel = 1;
    let currentStage = 1;
    let locked = false;          // 回答後の連打防止
    let pendingTimer = null;     // 次の問題 / 結果画面への遷移タイマー
    let graphRaf = null;         // グラフ描画アニメーション
    let choiceEntries = [];      // [{ choice, btn }]

    /* 出題に使う関数（ロジックは元のまま） */
    const FUNC_LIST = [
        'X',
        '(X^2)',
        '(X^3)',
        'sin(X)',
        'cos(X)',
        'sin(X/2)',
        'cos(X/2)',
        'sin(X/4)',
        'cos(X/4)'
    ];

    /* LaTeX 表記 */
    const FUNC_TEX = {
        'X': 'x',
        '(X^2)': 'x^{2}',
        '(X^3)': 'x^{3}',
        'sin(X)': '\\sin x',
        'cos(X)': '\\cos x',
        'sin(X/2)': '\\sin\\frac{x}{2}',
        'cos(X/2)': '\\cos\\frac{x}{2}',
        'sin(X/4)': '\\sin\\frac{x}{4}',
        'cos(X/4)': '\\cos\\frac{x}{4}'
    };

    /* 値の評価 */
    const FUNC_EVAL = {
        'X': (x) => x,
        '(X^2)': (x) => x ** 2,
        '(X^3)': (x) => x ** 3,
        'sin(X)': (x) => Math.sin(x),
        'cos(X)': (x) => Math.cos(x),
        'sin(X/2)': (x) => Math.sin(x / 2),
        'cos(X/2)': (x) => Math.cos(x / 2),
        'sin(X/4)': (x) => Math.sin(x / 4),
        'cos(X/4)': (x) => Math.cos(x / 4)
    };

    const monsterImages = [
        'level1.png', 'level2.png', 'level3.png', 'level4.png', 'level5.png',
        'level6.png', 'level7.png', 'level8.png', 'level9.png', 'level10.png',
        'level11.png', 'level12.png', 'level13.png', 'level14.png', 'level15.png'
    ];

    /* =====================================================
       Audio
       ===================================================== */
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

    ['first', 'second', 'third', 'fourth', 'gameClear', 'gameOver', 'selectBgm']
        .forEach((key) => { audioFiles[key].loop = true; });

    function safePlay(audio, restart = false) {
        if (restart) audio.currentTime = 0;
        const p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
    }

    function stopAllAudio() {
        Object.values(audioFiles).forEach((audio) => {
            audio.pause();
            audio.currentTime = 0;
        });
    }

    /** レベル → 強さの帯（BGM・テーマカラー共通） */
    function getTier(level) {
        if (level <= 5) return 1;
        if (level <= 10) return 2;
        if (level <= 14) return 3;
        return 4;
    }

    function playAudioForLevel(level) {
        stopAllAudio();
        const key = ['first', 'second', 'third', 'fourth'][getTier(level) - 1];
        safePlay(audioFiles[key]);
    }
    function playSelectBgm()      { stopAllAudio(); safePlay(audioFiles.selectBgm); }
    function playGameClearAudio() { stopAllAudio(); safePlay(audioFiles.gameClear); }
    function playGameOverAudio()  { stopAllAudio(); safePlay(audioFiles.gameOver); }
    function playTrueSound()      { safePlay(audioFiles.trueSound, true); }
    function playFalseSound()     { safePlay(audioFiles.falseSound, true); }
    function playPushSound()      { safePlay(audioFiles.pushSound, true); }

    /* =====================================================
       汎用ユーティリティ
       ===================================================== */
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

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    /** 同じ要素でアニメーションを再生し直す */
    function triggerAnim(el, cls) {
        el.classList.remove(cls);
        void el.offsetWidth; // reflow
        el.classList.add(cls);
        el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
    }

    /** KaTeX で描画（読み込めなければ通常テキスト） */
    function renderMath(el, tex, fallback) {
        if (window.katex) {
            try {
                window.katex.render(tex, el, { throwOnError: false, displayMode: false });
                return;
            } catch (e) { /* フォールバックへ */ }
        }
        el.textContent = fallback !== undefined ? fallback : tex;
    }

    /* =====================================================
       画面遷移
       ===================================================== */
    function clearPending() {
        clearTimeout(pendingTimer);
        pendingTimer = null;
        cancelAnimationFrame(graphRaf);
    }

    function hideAllScreens() {
        Object.values(screens).forEach((s) => s.classList.add('hidden'));
    }

    function showStartScreen() {
        clearPending();
        hideAllScreens();
        screens.start.classList.remove('hidden');
        stopAllAudio();
    }

    function showSelectScreen() {
        clearPending();
        hideAllScreens();
        screens.select.classList.remove('hidden');
        createMonsterGrid();
        playSelectBgm();
    }

    const bindButton = (id, handler) => {
        $(id).addEventListener('click', () => {
            playPushSound();
            handler();
        });
    };
    bindButton('start-button', showSelectScreen);
    bindButton('title-button-end', showStartScreen);
    bindButton('select-button-end', showSelectScreen);
    bindButton('title-button-select', showStartScreen);
    bindButton('title-button-game', showStartScreen);
    bindButton('select-button-game', showSelectScreen);

    /* =====================================================
       モンスター選択
       ===================================================== */
    function createMonsterGrid() {
        monsterGrid.innerHTML = '';
        for (let i = 1; i <= 15; i++) {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'monster-item';
            item.dataset.tier = getTier(i);
            item.innerHTML = `
                <img src="${monsterImages[i - 1]}" alt="Monster ${i}" loading="lazy">
                <p>Lv ${i}</p>
            `;
            item.addEventListener('click', () => startQuiz(i));
            monsterGrid.appendChild(item);
        }
    }

    /* =====================================================
       ゲーム進行
       ===================================================== */
    function initHearts() {
        playerHearts.innerHTML = '';
        for (let i = 0; i < MAX_PLAYER_HP; i++) {
            const heart = document.createElement('span');
            heart.className = 'heart';
            heart.textContent = '♥';
            playerHearts.appendChild(heart);
        }
    }

    function startQuiz(level) {
        clearPending();
        selectedLevel = level;
        hideAllScreens();
        screens.game.dataset.tier = getTier(level);
        screens.game.classList.remove('hidden');

        playerHp = MAX_PLAYER_HP;
        monsterHp = MAX_MONSTER_HP;
        currentStage = 1;

        monsterImage.style.backgroundImage = `url("${monsterImages[level - 1]}")`;
        monsterLevelDisplay.textContent = `Lv ${level}`;

        updateHpDisplay();
        loadQuiz();
        playAudioForLevel(level);
    }

    function loadQuiz() {
        locked = false;
        choicesList.innerHTML = '';
        choicesList.classList.remove('locked');
        feedback.textContent = '';
        feedback.className = '';
        updateStageDisplay();

        const choices = generateChoices(selectedLevel);
        const correctAnswer = chooseAnswer(choices);
        choiceEntries = [];

        choices.forEach((choice, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'choice';
            btn.innerHTML = `<span class="choice-key">${'ABCD'[idx]}</span><span class="choice-math"></span>`;
            renderMath(btn.querySelector('.choice-math'), `y = ${choice.latex}`, `y = ${choice.text}`);
            btn.addEventListener('click', () => handleChoice(choice, correctAnswer, btn));
            choicesList.appendChild(btn);
            choiceEntries.push({ choice, btn });
        });

        drawGraph(correctAnswer);
    }

    function handleChoice(choice, correctAnswer, clickedBtn) {
        if (locked) return;
        locked = true;
        choicesList.classList.add('locked');

        const isCorrect = choice === correctAnswer;

        choiceEntries.forEach(({ choice: c, btn }) => {
            if (c === correctAnswer) btn.classList.add(isCorrect ? 'is-correct' : 'is-answer');
            else if (btn === clickedBtn) btn.classList.add('is-wrong');
            else btn.classList.add('is-dim');
        });

        if (isCorrect) {
            monsterHp--;
            feedback.textContent = '正解！';
            feedback.className = 'correct';
            playTrueSound();
            effectMonsterHit();
        } else {
            playerHp--;
            feedback.textContent = '不正解！';
            feedback.className = 'incorrect';
            playFalseSound();
            effectPlayerHurt();
        }
        currentStage++;
        updateHpDisplay();

        if (monsterHp <= 0) {
            pendingTimer = setTimeout(() => endGame(true), 1200);
        } else if (playerHp <= 0) {
            pendingTimer = setTimeout(() => endGame(false), 1200);
        } else {
            pendingTimer = setTimeout(loadQuiz, 1000);
        }
    }

    function effectMonsterHit() {
        triggerAnim(monsterSprite, 'is-hit');
        damagePop.textContent = '−1';
        triggerAnim(damagePop, 'show');
    }

    function effectPlayerHurt() {
        triggerAnim(quizPanel, 'is-shake');
        triggerAnim(damageFlash, 'show');
    }

    function updateHpDisplay() {
        playerHpDisplay.textContent = playerHp;
        monsterHpDisplay.textContent = monsterHp;

        [...playerHearts.children].forEach((heart, i) => {
            heart.classList.toggle('lost', i >= playerHp);
        });

        const ratio = clamp(monsterHp / MAX_MONSTER_HP, 0, 1);
        monsterHpFill.style.width = `${ratio * 100}%`;
        monsterHpBar.setAttribute('aria-valuenow', String(Math.max(monsterHp, 0)));
    }

    function updateStageDisplay() {
        currentStageDisplay.textContent = String(currentStage).padStart(2, '0');
    }

    function endGame(isClear) {
        clearPending();
        hideAllScreens();
        screens.end.dataset.result = isClear ? 'clear' : 'over';
        endMessage.textContent = isClear ? 'ゲームクリア！' : 'ゲームオーバー';
        endEyebrow.textContent = isClear ? 'Victory' : 'Defeat';
        screens.end.classList.remove('hidden');

        if (isClear) playGameClearAudio();
        else playGameOverAudio();
    }

    /* =====================================================
       問題生成（ロジックは基本そのまま）
       ===================================================== */
    function generateChoices(level) {
        const list = [];
        const funcStrings = [];

        while (list.length < 4) {
            const func = makeFunc(level);
            if (!funcStrings.includes(func.text)) {
                list.push(func);
                funcStrings.push(func.text);
            }
        }
        return list;
    }

    function chooseAnswer(choices) {
        return randomChoice(choices);
    }

    /** 高レベルでも組み合わせは最大2つ */
    function countFuncsForLevel(level) {
        if (level <= 7) return 1;
        return 2;
    }

    function makeFunc(level) {
        const funcRange = Math.max(3, Math.min(level, 9));
        const countFuncs = countFuncsForLevel(level);
        const xList = Array.from({ length: 201 }, (_, i) => (i - 100) / 10);

        let chosenFuncs;
        if (level <= 3) {
            // レベル1-3: 基本の3関数から選択
            chosenFuncs = randomSample(FUNC_LIST.slice(0, 3), countFuncs);
        } else if (level >= 9 && Math.random() * 10 <= 3) {
            // レベル9以上: 30%の確率で基本関数
            chosenFuncs = randomSample(FUNC_LIST.slice(0, 3), countFuncs);
        } else {
            // それ以外: 三角関数など
            chosenFuncs = randomSample(FUNC_LIST.slice(3, funcRange), countFuncs);
        }

        // 項の並び順を固定（順序違いの同一関数が選択肢に重複しないようにする）
        chosenFuncs.sort((a, b) => FUNC_LIST.indexOf(a) - FUNC_LIST.indexOf(b));

        let text = '';
        let latex = '';
        const numList = [];
        const signList = [];

        chosenFuncs.forEach((func, i) => {
            const num = randomChoice(['2', '3', '4']);
            const sign = i === 0 ? randomChoice(['', '-']) : randomChoice(['+', '-']);
            const term = `${num}${FUNC_TEX[func]}`;

            text += `${sign}${num}${func}`;
            if (i === 0) latex += sign === '-' ? `-${term}` : term;
            else latex += sign === '-' ? ` - ${term}` : ` + ${term}`;

            numList.push(parseInt(num, 10));
            signList.push(sign);
        });

        return { text, latex, funcs: chosenFuncs, nums: numList, signs: signList, xList };
    }

    function calculateYValues(details) {
        return details.xList.map((x) => {
            let y = 0;
            details.funcs.forEach((func, i) => {
                const sign = details.signs[i] === '-' ? -1 : 1;
                y += sign * details.nums[i] * FUNC_EVAL[func](x);
            });
            return y;
        });
    }

    /* =====================================================
       グラフ描画
       ===================================================== */
    const GRAPH = { w: 560, h: 448, grid: 28 };
    const OX = GRAPH.w / 2;   // 原点 x（x: -10〜10）
    const OY = GRAPH.h / 2;   // 原点 y（y: -8〜8）

    function setupCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        graphCanvas.width = GRAPH.w * dpr;
        graphCanvas.height = GRAPH.h * dpr;
        graphCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawGrid() {
        const ctx = graphCtx;
        const { w, h, grid } = GRAPH;

        // 格子
        ctx.lineWidth = 1;
        for (let i = -10; i <= 10; i++) {
            const x = OX + i * grid;
            ctx.strokeStyle = i % 5 === 0 ? 'rgba(255,255,255,.11)' : 'rgba(255,255,255,.05)';
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let j = -8; j <= 8; j++) {
            const y = OY - j * grid;
            ctx.strokeStyle = j % 4 === 0 ? 'rgba(255,255,255,.11)' : 'rgba(255,255,255,.05)';
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // 軸
        ctx.strokeStyle = 'rgba(248,231,176,.72)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, OY); ctx.lineTo(w, OY);
        ctx.moveTo(OX, 0); ctx.lineTo(OX, h);
        ctx.stroke();

        // 矢印
        ctx.fillStyle = 'rgba(248,231,176,.9)';
        ctx.beginPath(); ctx.moveTo(w - 2, OY); ctx.lineTo(w - 12, OY - 5); ctx.lineTo(w - 12, OY + 5); ctx.fill();
        ctx.beginPath(); ctx.moveTo(OX, 2); ctx.lineTo(OX - 5, 12); ctx.lineTo(OX + 5, 12); ctx.fill();

        // 目盛り
        ctx.strokeStyle = 'rgba(248,231,176,.72)';
        ctx.lineWidth = 1.2;
        for (let i = -10; i <= 10; i++) {
            if (i === 0) continue;
            const x = OX + i * grid;
            ctx.beginPath(); ctx.moveTo(x, OY - 4); ctx.lineTo(x, OY + 4); ctx.stroke();
        }
        for (let j = -8; j <= 8; j++) {
            if (j === 0) continue;
            const y = OY - j * grid;
            ctx.beginPath(); ctx.moveTo(OX - 4, y); ctx.lineTo(OX + 4, y); ctx.stroke();
        }

        // 数値ラベル
        ctx.fillStyle = 'rgba(190,197,222,.82)';
        ctx.font = '11px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = -9; i <= 9; i++) {
            if (i === 0) continue;
            ctx.fillText(String(i), OX + i * grid, OY + 17);
        }
        for (let j = -7; j <= 7; j++) {
            if (j === 0) continue;
            ctx.fillText(String(j), OX - 17, OY - j * grid);
        }
        ctx.fillText('O', OX - 12, OY + 14);

        // 軸名
        ctx.fillStyle = 'rgba(248,231,176,.95)';
        ctx.font = 'italic 600 16px "Cormorant Garamond", serif';
        ctx.fillText('x', w - 16, OY - 14);
        ctx.fillText('y', OX + 14, 16);
    }

    function renderGraph(xs, ys, progress) {
        const ctx = graphCtx;
        ctx.clearRect(0, 0, GRAPH.w, GRAPH.h);
        drawGrid();

        const count = Math.max(2, Math.round(progress * xs.length));
        const toPx = (i) => [OX + xs[i] * GRAPH.grid, clamp(OY - ys[i] * GRAPH.grid, -4000, 4000)];
        const tracePath = () => {
            ctx.beginPath();
            for (let i = 0; i < count; i++) {
                const [px, py] = toPx(i);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
        };

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, GRAPH.w, GRAPH.h);
        ctx.clip();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // グロー
        tracePath();
        ctx.strokeStyle = 'rgba(103,232,249,.22)';
        ctx.lineWidth = 8;
        ctx.stroke();

        // 本線
        const grad = ctx.createLinearGradient(0, 0, GRAPH.w, 0);
        grad.addColorStop(0, '#67e8f9');
        grad.addColorStop(1, '#a5b4fc');
        tracePath();
        ctx.shadowColor = 'rgba(103,232,249,.85)';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.6;
        ctx.stroke();

        // 描画中の先端
        if (progress < 1) {
            const [hx, hy] = toPx(count - 1);
            ctx.shadowBlur = 16;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(hx, hy, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawGraph(details) {
        const xs = details.xList;
        const ys = calculateYValues(details);

        cancelAnimationFrame(graphRaf);
        const duration = prefersReducedMotion ? 0 : 700;
        const start = performance.now();

        const step = (now) => {
            const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            renderGraph(xs, ys, eased);
            if (t < 1) graphRaf = requestAnimationFrame(step);
        };
        graphRaf = requestAnimationFrame(step);
    }

    /* =====================================================
       初期化
       ===================================================== */
    setupCanvas();
    initHearts();
    updateHpDisplay();
    document.querySelectorAll('[data-tex]').forEach((el) => {
        renderMath(el, el.dataset.tex, el.textContent);
    });
});
