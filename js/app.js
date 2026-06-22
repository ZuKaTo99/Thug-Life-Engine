
(() => {
    const CONFIG = {
        localStorageKey: 'thugLifeEngineStatsV1',
        cycleStartStorageKey: 'thugLifeEngineCycleStartV1',
        dayNightCycleMinutes: 20,
        atmosphereParticleCount: 44,
        pearlCount: 30,
        starCount: 66,
        coinSpawnMinSeconds: 1.8,
        coinSpawnMaxSeconds: 3.1,
        coinSpeed: 230,
        gravity: 690,
        jumpVelocity: 360,
        cloudCount: 0
    };

    const root = document.documentElement;
    const canvas = document.getElementById('atmosphereCanvas');
    const ctx = canvas.getContext('2d');
    const cloudCanvas = document.getElementById('cloudCanvas');
    const cloudCtx = cloudCanvas.getContext('2d');
    const miniRunner = document.getElementById('miniRunner');
    const gameLane = document.getElementById('gameLane');
    const coinLayer = document.getElementById('coinLayer');
    const runner = document.getElementById('runner');
    const gameHint = document.getElementById('gameHint');
    const runCoinsLabel = document.getElementById('runCoins');
    const totalCoinsLabel = document.getElementById('totalCoins');
    const recordCoinsLabel = document.getElementById('recordCoins');
    const phaseSwitch = document.getElementById('phaseSwitch');
    const skyCloudVideo = document.getElementById('skyCloudVideo');
    const rainOverlayVideo = document.getElementById('rainOverlayVideo');
    const lightningFrontVideo = document.getElementById('lightningFrontVideo');
    const lightningVideoLayer = document.querySelector('.lightning-video-layer');

    const phase = {
        night: 0,
        dusk: 0,
        warm: 1
    };

    const phasePresets = [
        { label: 'Tag', t: 0.0 },
        { label: 'Nacht', t: 0.5 }
    ];

    let cycleStartMs = Number.parseFloat(localStorage.getItem(CONFIG.cycleStartStorageKey) || '');
    if (!Number.isFinite(cycleStartMs)) {
        const cycleMs = CONFIG.dayNightCycleMinutes * 60 * 1000;
        cycleStartMs = Date.now() - (Date.now() % cycleMs);
        localStorage.setItem(CONFIG.cycleStartStorageKey, String(cycleStartMs));
    }


    const atmosphere = {
        width: 0,
        height: 0,
        dpr: 1,
        motes: [],
        pearls: [],
        stars: []
    };

    const clouds = {
        width: 0,
        height: 0,
        dpr: 1,
        items: []
    };

    const videoFx = {
        nextLightningAt: performance.now() + randomRange(18000, 34000),
        lightningActiveUntil: 0
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

    window.thugLifeRuntime = {
        phase,
        game,
        elements: {
            wallpaper: document.getElementById('wallpaper'),
            runner,
            gameLane,
            miniRunner,
            coinLayer
        }
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

        clouds.dpr = atmosphere.dpr;
        clouds.width = window.innerWidth;
        clouds.height = Math.round(window.innerHeight * 0.32);
        cloudCanvas.width = Math.round(clouds.width * clouds.dpr);
        cloudCanvas.height = Math.round(clouds.height * clouds.dpr);
        cloudCanvas.style.width = `${clouds.width}px`;
        cloudCanvas.style.height = `${clouds.height}px`;
        cloudCtx.setTransform(clouds.dpr, 0, 0, clouds.dpr, 0, 0);

        createAtmosphere();
        createClouds();
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

        const pearlZones = [
            { x0: 0.06, x1: 0.24, y0: 0.48, y1: 0.75 },
            { x0: 0.55, x1: 0.92, y0: 0.40, y1: 0.72 },
            { x0: 0.28, x1: 0.92, y0: 0.76, y1: 0.92 }
        ];

        atmosphere.pearls = Array.from({ length: CONFIG.pearlCount }, (_, index) => {
            const zone = pearlZones[index % pearlZones.length];
            return {
                x: randomRange(zone.x0, zone.x1) * atmosphere.width,
                y: randomRange(zone.y0, zone.y1) * atmosphere.height,
                size: randomRange(1.4, 4.2),
                speedX: randomRange(-3.4, 4.8),
                speedY: randomRange(-2.2, 2.8),
                pulse: randomRange(0, Math.PI * 2),
                pulseSpeed: randomRange(0.55, 1.45),
                alpha: randomRange(0.16, 0.46),
                hue: Math.random() > 0.58 ? 'warm' : 'cool'
            };
        });

        atmosphere.stars = Array.from({ length: CONFIG.starCount }, () => ({
            x: Math.random() * atmosphere.width,
            y: Math.random() * atmosphere.height * 0.56,
            size: randomRange(0.55, 1.65),
            pulse: randomRange(0, Math.PI * 2),
            pulseSpeed: randomRange(0.8, 1.8),
            alpha: randomRange(0.18, 0.86)
        }));
    }

    function createClouds() {
        const layerConfigs = [
            {
                yMin: 0.06,
                yMax: 0.24,
                width: [280, 470],
                height: [72, 118],
                speed: [3.2, 5.8],
                alpha: [0.12, 0.22],
                blur: [20, 28],
                scale: [0.95, 1.28]
            },
            {
                yMin: 0.12,
                yMax: 0.34,
                width: [220, 360],
                height: [56, 92],
                speed: [5.6, 8.8],
                alpha: [0.15, 0.28],
                blur: [13, 20],
                scale: [0.82, 1.08]
            },
            {
                yMin: 0.18,
                yMax: 0.52,
                width: [150, 250],
                height: [36, 62],
                speed: [8.4, 13.5],
                alpha: [0.10, 0.19],
                blur: [8, 14],
                scale: [0.68, 0.92]
            }
        ];

        clouds.items = Array.from({ length: CONFIG.cloudCount }, (_, index) => {
            const layer = layerConfigs[index % layerConfigs.length];
            const scale = randomRange(layer.scale[0], layer.scale[1]);
            return {
                x: randomRange(-260, clouds.width + 180),
                y: randomRange(clouds.height * layer.yMin, clouds.height * layer.yMax),
                width: randomRange(layer.width[0], layer.width[1]) * scale,
                height: randomRange(layer.height[0], layer.height[1]) * scale,
                speed: randomRange(layer.speed[0], layer.speed[1]),
                alpha: randomRange(layer.alpha[0], layer.alpha[1]),
                blur: randomRange(layer.blur[0], layer.blur[1]),
                seed: randomRange(0, Math.PI * 2),
                layer: index % layerConfigs.length
            };
        });
    }

    function getCycleProgress() {
        const cycleMs = CONFIG.dayNightCycleMinutes * 60 * 1000;
        const elapsedMs = Date.now() - cycleStartMs;
        return (((elapsedMs % cycleMs) + cycleMs) % cycleMs) / cycleMs;
    }

    function updateDayNightCycle() {
        const t = getCycleProgress();
        const isNightPhase = t >= 0.5;

        phase.night = isNightPhase ? 1 : 0;
        phase.dusk = 0;
        phase.warm = isNightPhase ? 0.12 : 1;

        root.style.setProperty('--night', phase.night.toFixed(3));
        root.style.setProperty('--dusk', phase.dusk.toFixed(3));
        root.style.setProperty('--warm', phase.warm.toFixed(3));
        root.style.setProperty('--star-alpha', phase.night.toFixed(3));
        root.dataset.phase = isNightPhase ? 'night' : 'day';

        updatePhaseSwitchLabel(isNightPhase);
    }

    function getCurrentPhaseLabel(isNightPhase) {
        return isNightPhase ? 'Nacht' : 'Tag';
    }

    function updatePhaseSwitchLabel(isNightPhase) {
        if (!phaseSwitch) return;
        phaseSwitch.textContent = `Zeit: ${getCurrentPhaseLabel(isNightPhase)} ${isNightPhase ? '10M' : '0M'}`;
    }

    function switchPhase() {
        const cycleMs = CONFIG.dayNightCycleMinutes * 60 * 1000;
        const isNightPhase = getCycleProgress() >= 0.5;
        const nextPreset = isNightPhase ? phasePresets[0] : phasePresets[1];
        cycleStartMs = Date.now() - nextPreset.t * cycleMs;
        localStorage.setItem(CONFIG.cycleStartStorageKey, String(cycleStartMs));
        updateDayNightCycle();
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
            const dayAlpha = mote.alpha * shimmer * (1 - phase.night) * 0.13;
            const nightAlpha = mote.alpha * shimmer * clamp((phase.night - 0.15) / 0.85, 0, 1) * 0.22;
            const alpha = dayAlpha + nightAlpha;

            if (alpha <= 0.002) continue;

            ctx.globalAlpha = alpha;
            ctx.fillStyle = mote.warmth > 0.5 ? 'rgba(255, 203, 126, 1)' : 'rgba(169, 209, 255, 1)';
            ctx.beginPath();
            ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
            ctx.fill();
        }

        const pearlOpacity = clamp((phase.night - 0.18) / 0.82, 0, 1);
        if (pearlOpacity > 0.01) {
            for (const pearl of atmosphere.pearls) {
                pearl.x += pearl.speedX * deltaSeconds;
                pearl.y += pearl.speedY * deltaSeconds;

                if (pearl.x < -30) pearl.x = atmosphere.width + 30;
                if (pearl.x > atmosphere.width + 30) pearl.x = -30;
                if (pearl.y < atmosphere.height * 0.34) pearl.y = atmosphere.height * 0.92;
                if (pearl.y > atmosphere.height * 0.95) pearl.y = atmosphere.height * 0.38;

                const pulse = 0.62 + Math.sin(elapsedSeconds * pearl.pulseSpeed + pearl.pulse) * 0.38;
                const alpha = pearl.alpha * pearlOpacity * pulse;
                const radius = pearl.size * (2.4 + pulse * 1.1);
                const glow = ctx.createRadialGradient(pearl.x, pearl.y, 0, pearl.x, pearl.y, radius);

                if (pearl.hue === 'warm') {
                    glow.addColorStop(0, `rgba(255, 244, 213, ${alpha})`);
                    glow.addColorStop(0.42, `rgba(255, 177, 92, ${alpha * 0.35})`);
                } else {
                    glow.addColorStop(0, `rgba(231, 247, 255, ${alpha})`);
                    glow.addColorStop(0.42, `rgba(99, 188, 255, ${alpha * 0.38})`);
                }

                glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.globalAlpha = 1;
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(pearl.x, pearl.y, radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.globalAlpha = alpha * 0.30;
                ctx.strokeStyle = pearl.hue === 'warm' ? 'rgba(255, 217, 150, 1)' : 'rgba(177, 223, 255, 1)';
                ctx.lineWidth = Math.max(0.7, pearl.size * 0.28);
                ctx.beginPath();
                ctx.moveTo(pearl.x - radius * 0.55, pearl.y + radius * 0.35);
                ctx.lineTo(pearl.x + radius * 0.55, pearl.y + radius * 0.26);
                ctx.stroke();
            }
        }

        ctx.globalAlpha = 1;
    }

    function drawCloudLayer(deltaSeconds, elapsedSeconds) {
        cloudCtx.clearRect(0, 0, clouds.width, clouds.height);
        const dayPresence = clamp(1 - (phase.night * 1.25), 0, 1);
        if (dayPresence <= 0.01) return;

        for (const cloud of clouds.items) {
            const layerDepth = cloud.layer / 2;
            cloud.x += cloud.speed * deltaSeconds;
            if (cloud.x - cloud.width > clouds.width + 180) {
                cloud.x = -cloud.width - 180;
                const yBands = [
                    [0.06, 0.24],
                    [0.12, 0.34],
                    [0.18, 0.52]
                ];
                const [minBand, maxBand] = yBands[cloud.layer] || yBands[1];
                cloud.y = randomRange(clouds.height * minBand, clouds.height * maxBand);
            }

            const drift = Math.sin(elapsedSeconds * (0.12 + layerDepth * 0.04) + cloud.seed) * (3.5 + layerDepth * 2.4);
            const sway = Math.cos(elapsedSeconds * (0.06 + layerDepth * 0.02) + cloud.seed * 0.7) * (8 + layerDepth * 6);
            const puffAlpha = cloud.alpha * dayPresence;
            const baseR = 247 - Math.round(layerDepth * 18);
            const baseG = 239 - Math.round(layerDepth * 14);
            const baseB = 232 - Math.round(layerDepth * 8);

            cloudCtx.save();
            cloudCtx.translate(cloud.x + sway, cloud.y + drift);
            cloudCtx.filter = `blur(${cloud.blur}px)`;
            cloudCtx.globalAlpha = puffAlpha;

            const grad = cloudCtx.createLinearGradient(0, -cloud.height * 0.75, 0, cloud.height * 0.9);
            grad.addColorStop(0, `rgba(${baseR + 6}, ${baseG + 4}, ${baseB + 2}, 0.96)`);
            grad.addColorStop(0.58, `rgba(${baseR}, ${baseG}, ${baseB}, 0.72)`);
            grad.addColorStop(1, `rgba(${baseR - 12}, ${baseG - 14}, ${baseB - 12}, 0.40)`);
            cloudCtx.fillStyle = grad;

            const puffs = [
                [-cloud.width * 0.44, cloud.height * 0.15, cloud.width * 0.18, cloud.height * 0.15],
                [-cloud.width * 0.28, cloud.height * 0.08, cloud.width * 0.24, cloud.height * 0.20],
                [-cloud.width * 0.05, -cloud.height * 0.08, cloud.width * 0.30, cloud.height * 0.28],
                [cloud.width * 0.20, cloud.height * 0.04, cloud.width * 0.28, cloud.height * 0.25],
                [cloud.width * 0.42, cloud.height * 0.14, cloud.width * 0.18, cloud.height * 0.16],
                [cloud.width * 0.05, cloud.height * 0.20, cloud.width * 0.48, cloud.height * 0.18]
            ];

            for (const [px, py, rx, ry] of puffs) {
                cloudCtx.beginPath();
                cloudCtx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
                cloudCtx.fill();
            }

            cloudCtx.globalAlpha = puffAlpha * 0.22;
            cloudCtx.fillStyle = 'rgba(255, 248, 235, 1)';
            cloudCtx.beginPath();
            cloudCtx.ellipse(-cloud.width * 0.04, -cloud.height * 0.10, cloud.width * 0.26, cloud.height * 0.12, -0.04, 0, Math.PI * 2);
            cloudCtx.fill();

            cloudCtx.globalAlpha = puffAlpha * 0.13;
            cloudCtx.fillStyle = 'rgba(255, 210, 162, 1)';
            cloudCtx.beginPath();
            cloudCtx.ellipse(cloud.width * 0.16, cloud.height * 0.08, cloud.width * 0.32, cloud.height * 0.10, 0.03, 0, Math.PI * 2);
            cloudCtx.fill();
            cloudCtx.restore();
        }
    }

    function startVideo(video) {
        if (!video) return;
        video.muted = true;
        video.playsInline = true;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
                // Wallpaper Engine/browser may delay autoplay until the page is ready.
            });
        }
    }

    function startVideoLayers() {
        startVideo(skyCloudVideo);
        startVideo(rainOverlayVideo);

        if (lightningFrontVideo) {
            lightningFrontVideo.pause();
            lightningFrontVideo.currentTime = 0;
        }
    }

    function triggerLightning(now) {
        if (!lightningFrontVideo || !lightningVideoLayer || phase.night < 0.5) return;

        lightningVideoLayer.classList.add('is-active');
        lightningFrontVideo.currentTime = 0;
        startVideo(lightningFrontVideo);

        videoFx.lightningActiveUntil = now + 950;
        videoFx.nextLightningAt = now + randomRange(24000, 52000);
    }

    function updateVideoEffects(now) {
        if (!lightningVideoLayer) return;

        if (phase.night < 0.5) {
            lightningVideoLayer.classList.remove('is-active');
            videoFx.nextLightningAt = now + randomRange(18000, 34000);
            videoFx.lightningActiveUntil = 0;
            if (lightningFrontVideo && !lightningFrontVideo.paused) {
                lightningFrontVideo.pause();
            }
            return;
        }

        if (now >= videoFx.nextLightningAt) {
            triggerLightning(now);
        }

        if (videoFx.lightningActiveUntil > 0 && now >= videoFx.lightningActiveUntil) {
            lightningVideoLayer.classList.remove('is-active');
            videoFx.lightningActiveUntil = 0;
            if (lightningFrontVideo && !lightningFrontVideo.paused) {
                lightningFrontVideo.pause();
            }
        }
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
            y: randomRange(72, Math.max(88, laneHeight - 42)),
            size: 18,
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
            x: runner.offsetLeft + runner.offsetWidth * 0.08,
            y: 18 + game.runnerY,
            width: runner.offsetWidth * 0.84,
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
        updateVideoEffects(now);
        drawCloudLayer(deltaSeconds, now / 1000);
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

        if (phaseSwitch) {
            phaseSwitch.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                event.stopPropagation();
                switchPhase();
            });
        }
    }

    loadStats();
    resizeCanvas();
    bindEvents();
    startVideoLayers();
    requestAnimationFrame(animate);
})();
