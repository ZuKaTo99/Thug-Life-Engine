(() => {
    'use strict';

    const CONFIG = {
        dayNightCycleMinutes: 20,
        atmosphereParticleCount: 92,
        starCount: 120,
        coinSpawnMinSeconds: 1.1,
        coinSpawnMaxSeconds: 1.8,
        coinSpeed: 220,
        gravity: 2100,
        jumpVelocity: 780,
        localStorageKey: 'thugLifeEngineMiniRunnerStatsV1'
    };

    const root = document.documentElement;
    const canvas = document.getElementById('atmosphereCanvas');
    const ctx = canvas.getContext('2d', { alpha: true });

    const miniRunner = document.getElementById('miniRunner');
    const gameLane = document.getElementById('gameLane');
    const coinLayer = document.getElementById('coinLayer');
    const runner = document.getElementById('runner');
    const gameHint = document.getElementById('gameHint');
    const runCoinsLabel = document.getElementById('runCoins');
    const totalCoinsLabel = document.getElementById('totalCoins');
    const recordCoinsLabel = document.getElementById('recordCoins');

    const phase = {
        night: 0,
        dusk: 0,
        warm: 1
    };

    const atmosphere = {
        width: 0,
        height: 0,
        dpr: 1,
        motes: [],
        stars: []
    };

    const game = {
        lastTime: performance.now(),
        spawnTimer: 0,
        nextSpawn: randomRange(CONFIG.coinSpawnMinSeconds, CONFIG.coinSpawnMaxSeconds),
        coins: [],
        currentRunCoins: 0,
        totalCoins: 0,
        recordCoins: 0,
        runnerY: 0,
        runnerVY: 0,
        isJumping: false,
        hasInteracted: false
    };

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function randomRange(min, max) {
        return min + Math.random() * (max - min);
    }

    function smoothstep(edge0, edge1, value) {
        const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
        return x * x * (3 - 2 * x);
    }

    function resizeCanvas() {
        atmosphere.dpr = Math.min(window.devicePixelRatio || 1, 2);
        atmosphere.width = window.innerWidth;
        atmosphere.height = window.innerHeight;

        canvas.width = Math.round(atmosphere.width * atmosphere.dpr);
        canvas.height = Math.round(atmosphere.height * atmosphere.dpr);
        canvas.style.width = `${atmosphere.width}px`;
        canvas.style.height = `${atmosphere.height}px`;
        ctx.setTransform(atmosphere.dpr, 0, 0, atmosphere.dpr, 0, 0);

        createAtmosphere();
    }

    function createAtmosphere() {
        atmosphere.motes = Array.from({ length: CONFIG.atmosphereParticleCount }, () => ({
            x: Math.random() * atmosphere.width,
            y: Math.random() * atmosphere.height,
            size: randomRange(0.6, 2.2),
            speedX: randomRange(-7, 13),
            speedY: randomRange(-4, 7),
            alpha: randomRange(0.12, 0.42),
            warmth: randomRange(0.2, 1)
        }));

        atmosphere.stars = Array.from({ length: CONFIG.starCount }, () => ({
            x: Math.random() * atmosphere.width,
            y: Math.random() * atmosphere.height * 0.56,
            size: randomRange(0.55, 1.65),
            pulse: randomRange(0, Math.PI * 2),
            pulseSpeed: randomRange(0.8, 1.8),
            alpha: randomRange(0.18, 0.86)
        }));
    }

    function updateDayNightCycle() {
        const cycleMs = CONFIG.dayNightCycleMinutes * 60 * 1000;
        const t = (Date.now() % cycleMs) / cycleMs;
        const wave = (1 - Math.cos(t * Math.PI * 2)) / 2;
        const duskA = smoothstep(0.12, 0.25, t) * (1 - smoothstep(0.25, 0.38, t));
        const duskB = smoothstep(0.62, 0.75, t) * (1 - smoothstep(0.75, 0.88, t));

        phase.night = clamp(wave, 0, 1);
        phase.dusk = clamp(Math.max(duskA, duskB), 0, 1);
        phase.warm = clamp(1 - phase.night * 0.76 + phase.dusk * 0.2, 0, 1);

        root.style.setProperty('--night', phase.night.toFixed(3));
        root.style.setProperty('--dusk', phase.dusk.toFixed(3));
        root.style.setProperty('--warm', phase.warm.toFixed(3));
        root.style.setProperty('--star-alpha', phase.night.toFixed(3));
        root.style.setProperty('--cloud-alpha', (0.5 + phase.dusk * 0.15).toFixed(3));
    }

    function drawAtmosphere(deltaSeconds, elapsedSeconds) {
        ctx.clearRect(0, 0, atmosphere.width, atmosphere.height);

        const starOpacity = clamp((phase.night - 0.23) / 0.77, 0, 1);
        if (starOpacity > 0.01) {
            for (const star of atmosphere.stars) {
                const twinkle = 0.65 + Math.sin(elapsedSeconds * star.pulseSpeed + star.pulse) * 0.35;
                ctx.globalAlpha = star.alpha * starOpacity * twinkle;
                ctx.fillStyle = 'rgba(218, 232, 255, 1)';
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        for (const mote of atmosphere.motes) {
            mote.x += mote.speedX * deltaSeconds;
            mote.y += mote.speedY * deltaSeconds;

            if (mote.x < -20) mote.x = atmosphere.width + 20;
            if (mote.x > atmosphere.width + 20) mote.x = -20;
            if (mote.y < -20) mote.y = atmosphere.height + 20;
            if (mote.y > atmosphere.height + 20) mote.y = -20;

            const shimmer = 0.68 + Math.sin(elapsedSeconds * 0.9 + mote.x * 0.01) * 0.32;
            const warmAlpha = mote.alpha * shimmer * (0.48 + phase.dusk * 0.54 + phase.night * 0.2);
            ctx.globalAlpha = warmAlpha;
            ctx.fillStyle = mote.warmth > 0.5 ? 'rgba(255, 196, 105, 1)' : 'rgba(158, 196, 255, 1)';
            ctx.beginPath();
            ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    }

    function loadStats() {
        try {
            const saved = JSON.parse(localStorage.getItem(CONFIG.localStorageKey) || '{}');
            game.totalCoins = Number.isFinite(saved.totalCoins) ? saved.totalCoins : 0;
            game.recordCoins = Number.isFinite(saved.recordCoins) ? saved.recordCoins : 0;
        } catch {
            game.totalCoins = 0;
            game.recordCoins = 0;
        }

        updateHud();
    }

    function saveStats() {
        localStorage.setItem(CONFIG.localStorageKey, JSON.stringify({
            totalCoins: game.totalCoins,
            recordCoins: game.recordCoins
        }));
    }

    function updateHud() {
        runCoinsLabel.textContent = String(game.currentRunCoins);
        totalCoinsLabel.textContent = String(game.totalCoins);
        recordCoinsLabel.textContent = String(game.recordCoins);
    }

    function setInteracted() {
        if (game.hasInteracted) return;
        game.hasInteracted = true;
        gameHint.classList.add('hidden');
    }

    function jump() {
        setInteracted();

        if (game.runnerY > 1) {
            return;
        }

        game.runnerVY = CONFIG.jumpVelocity;
        game.isJumping = true;
        runner.classList.add('jumping');
    }

    function spawnCoin() {
        const laneHeight = gameLane.clientHeight;
        const coin = document.createElement('span');
        coin.className = 'coin';

        const model = {
            element: coin,
            x: gameLane.clientWidth + 30,
            y: randomRange(28, Math.max(34, laneHeight - 45)),
            size: 20,
            spin: randomRange(0, 360),
            collected: false
        };

        coinLayer.appendChild(coin);
        game.coins.push(model);
        updateCoinElement(model);
    }

    function updateCoinElement(coin) {
        coin.element.style.setProperty('--x', `${coin.x}px`);
        coin.element.style.setProperty('--y', `${-coin.y}px`);
        coin.element.style.setProperty('--spin', `${coin.spin}deg`);
    }

    function collectCoin(coin) {
        if (coin.collected) return;

        coin.collected = true;
        coin.element.classList.add('collected');
        game.currentRunCoins += 1;
        game.totalCoins += 1;
        game.recordCoins = Math.max(game.recordCoins, game.currentRunCoins);
        updateHud();
        saveStats();

        window.setTimeout(() => {
            coin.element.remove();
        }, 280);
    }

    function updateMiniGame(deltaSeconds) {
        const laneWidth = gameLane.clientWidth;
        const groundY = 0;

        game.runnerVY -= CONFIG.gravity * deltaSeconds;
        game.runnerY += game.runnerVY * deltaSeconds;

        if (game.runnerY <= groundY) {
            game.runnerY = groundY;
            game.runnerVY = 0;
            game.isJumping = false;
            runner.classList.remove('jumping');
        }

        const jumpProgress = clamp(game.runnerY / 145, 0, 1);
        runner.style.setProperty('--jump-y', `${game.runnerY.toFixed(2)}px`);
        runner.style.setProperty('--jump-progress', jumpProgress.toFixed(3));

        game.spawnTimer += deltaSeconds;
        if (game.spawnTimer >= game.nextSpawn) {
            game.spawnTimer = 0;
            game.nextSpawn = randomRange(CONFIG.coinSpawnMinSeconds, CONFIG.coinSpawnMaxSeconds);
            spawnCoin();
        }

        const runnerRect = {
            x: runner.offsetLeft + 8,
            y: 18 + game.runnerY,
            width: 34,
            height: 42
        };

        for (const coin of game.coins) {
            if (coin.collected) continue;

            coin.x -= CONFIG.coinSpeed * deltaSeconds;
            coin.spin += 260 * deltaSeconds;
            updateCoinElement(coin);

            const coinRect = {
                x: coin.x,
                y: coin.y,
                width: coin.size,
                height: coin.size
            };

            const overlaps =
                runnerRect.x < coinRect.x + coinRect.width &&
                runnerRect.x + runnerRect.width > coinRect.x &&
                runnerRect.y < coinRect.y + coinRect.height &&
                runnerRect.y + runnerRect.height > coinRect.y;

            if (overlaps) {
                collectCoin(coin);
            }
        }

        for (let index = game.coins.length - 1; index >= 0; index -= 1) {
            const coin = game.coins[index];
            if (coin.collected || coin.x > -40) continue;
            coin.element.remove();
            game.coins.splice(index, 1);
        }

        if (laneWidth <= 0) {
            return;
        }
    }

    function animate(now) {
        const deltaSeconds = Math.min((now - game.lastTime) / 1000, 0.04);
        game.lastTime = now;

        updateDayNightCycle();
        drawAtmosphere(deltaSeconds, now / 1000);
        updateMiniGame(deltaSeconds);

        requestAnimationFrame(animate);
    }

    function bindEvents() {
        window.addEventListener('resize', resizeCanvas, { passive: true });

        runner.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            jump();
        });

        gameLane.addEventListener('pointerdown', (event) => {
            if (event.target === runner || runner.contains(event.target)) return;
            jump();
        });

        window.addEventListener('keydown', (event) => {
            if (event.code === 'Space' || event.code === 'ArrowUp') {
                event.preventDefault();
                jump();
            }
        });

        miniRunner.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            game.currentRunCoins = 0;
            game.coins.forEach((coin) => coin.element.remove());
            game.coins = [];
            updateHud();
        });
    }

    loadStats();
    resizeCanvas();
    bindEvents();
    requestAnimationFrame(animate);
})();
