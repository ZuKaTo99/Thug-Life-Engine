import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.min.js';

(() => {
    const canvas = document.getElementById('threeCanvas');
    if (!canvas || !THREE.WebGLRenderer) {
        return;
    }

    const state = {
        width: 0,
        height: 0,
        dpr: 1,
        time: 0,
        night: 0,
        dusk: 0
    };

    const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
    });

    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 8);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const goldDust = createParticleField({
        count: 300,
        spreadX: 13.8,
        spreadY: 7.2,
        depthMin: -3.9,
        depthMax: 2.2,
        size: 0.052,
        color: 0xffcf75,
        opacity: 0.62
    });

    const redSparks = createParticleField({
        count: 86,
        spreadX: 13.2,
        spreadY: 5.8,
        depthMin: -2.5,
        depthMax: 2.0,
        size: 0.062,
        color: 0xff3359,
        opacity: 0.34
    });

    const blueNightDust = createParticleField({
        count: 140,
        spreadX: 13.8,
        spreadY: 6.9,
        depthMin: -4.0,
        depthMax: 1.8,
        size: 0.04,
        color: 0x8ab7ff,
        opacity: 0.2
    });

    const foregroundEmbers = createParticleField({
        count: 64,
        spreadX: 11.6,
        spreadY: 2.4,
        depthMin: -1.2,
        depthMax: 1.6,
        size: 0.078,
        color: 0xff8a37,
        opacity: 0.28
    });

    goldDust.points.position.z = -1.1;
    redSparks.points.position.z = -0.5;
    blueNightDust.points.position.z = -1.4;
    foregroundEmbers.points.position.set(0.2, -1.85, 0.35);

    rootGroup.add(goldDust.points, redSparks.points, blueNightDust.points, foregroundEmbers.points);

    const speedLines = createSpeedLineField({
        count: 52,
        spreadX: 13.6,
        minY: -2.85,
        maxY: -1.9,
        minLength: 0.28,
        maxLength: 0.92,
        color: 0xffc76f,
        opacity: 0.26
    });
    rootGroup.add(speedLines.lines);

    const skyLines = createSpeedLineField({
        count: 30,
        spreadX: 14.4,
        minY: 0.35,
        maxY: 2.75,
        minLength: 0.15,
        maxLength: 0.55,
        color: 0xd7e3ff,
        opacity: 0.16
    });
    rootGroup.add(skyLines.lines);

    const sunGlow = createGlowSprite({
        color: 'rgba(255, 186, 82, 1)',
        inner: 0.34,
        outer: 0.0,
        size: 3.6,
        opacity: 0.38
    });
    sunGlow.position.set(3.85, 1.92, 0.2);
    rootGroup.add(sunGlow);

    const moonGlow = createGlowSprite({
        color: 'rgba(132, 170, 255, 1)',
        inner: 0.31,
        outer: 0.0,
        size: 3.0,
        opacity: 0.0
    });
    moonGlow.position.set(3.15, 2.5, 0.05);
    rootGroup.add(moonGlow);

    const horizonGlow = createGlowSprite({
        color: 'rgba(255, 110, 70, 1)',
        inner: 0.28,
        outer: 0.0,
        size: 6.2,
        opacity: 0.26
    });
    horizonGlow.position.set(1.9, -1.72, -0.3);
    horizonGlow.scale.y = 0.42;
    rootGroup.add(horizonGlow);

    const carUnderGlow = createGlowSprite({
        color: 'rgba(255, 42, 75, 1)',
        inner: 0.28,
        outer: 0.0,
        size: 1.25,
        opacity: 0.36
    });
    carUnderGlow.position.set(-4.25, -2.95, 0.55);
    carUnderGlow.scale.y = 0.24;
    rootGroup.add(carUnderGlow);

    function createParticleField(options) {
        const positions = new Float32Array(options.count * 3);
        const basePositions = new Float32Array(options.count * 3);
        const phase = new Float32Array(options.count);
        const speed = new Float32Array(options.count);

        for (let index = 0; index < options.count; index += 1) {
            const i = index * 3;
            positions[i] = randomRange(-options.spreadX / 2, options.spreadX / 2);
            positions[i + 1] = randomRange(-options.spreadY / 2, options.spreadY / 2);
            positions[i + 2] = randomRange(options.depthMin, options.depthMax);

            basePositions[i] = positions[i];
            basePositions[i + 1] = positions[i + 1];
            basePositions[i + 2] = positions[i + 2];

            phase[index] = randomRange(0, Math.PI * 2);
            speed[index] = randomRange(0.18, 0.72);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: options.color,
            size: options.size,
            transparent: true,
            opacity: options.opacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const points = new THREE.Points(geometry, material);
        return { points, geometry, material, positions, basePositions, phase, speed, spreadX: options.spreadX, spreadY: options.spreadY };
    }

    function createSpeedLineField(options) {
        const positions = new Float32Array(options.count * 2 * 3);
        const base = [];

        for (let index = 0; index < options.count; index += 1) {
            const x = randomRange(-options.spreadX / 2, options.spreadX / 2);
            const y = randomRange(options.minY, options.maxY);
            const length = randomRange(options.minLength, options.maxLength);
            const speed = randomRange(0.9, 2.2);
            base.push({ x, y, length, speed, phase: randomRange(0, Math.PI * 2) });
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.LineBasicMaterial({
            color: options.color,
            transparent: true,
            opacity: options.opacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const lines = new THREE.LineSegments(geometry, material);
        return { lines, geometry, material, positions, base, spreadX: options.spreadX };
    }

    function createGlowSprite(options) {
        const texture = new THREE.CanvasTexture(createGlowCanvas(options.color, options.inner, options.outer));
        texture.colorSpace = THREE.SRGBColorSpace;

        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: options.opacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const sprite = new THREE.Sprite(material);
        sprite.scale.set(options.size, options.size, 1);
        return sprite;
    }

    function createGlowCanvas(color, innerStop, outerStop) {
        const size = 256;
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = size;
        glowCanvas.height = size;
        const glowCtx = glowCanvas.getContext('2d');
        const gradient = glowCtx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, color);
        gradient.addColorStop(innerStop, color.replace('1)', '0.36)'));
        gradient.addColorStop(1, color.replace('1)', `${outerStop})`));
        glowCtx.fillStyle = gradient;
        glowCtx.fillRect(0, 0, size, size);
        return glowCanvas;
    }

    function randomRange(min, max) {
        return min + Math.random() * (max - min);
    }

    function readCssPhase() {
        const styles = getComputedStyle(document.documentElement);
        state.night = Number.parseFloat(styles.getPropertyValue('--night')) || 0;
        state.dusk = Number.parseFloat(styles.getPropertyValue('--dusk')) || 0;
    }

    function updateParticles(field, delta, elapsed, verticalBoost, horizontalSpeed = 1) {
        const positions = field.positions;
        const base = field.basePositions;

        for (let index = 0; index < field.phase.length; index += 1) {
            const i = index * 3;
            const drift = elapsed * field.speed[index];
            const wave = Math.sin(drift + field.phase[index]);
            const side = Math.cos(drift * 0.55 + field.phase[index]) * 0.18;

            positions[i] = base[i] + side;
            positions[i + 1] = base[i + 1] + wave * 0.09 + verticalBoost;
            positions[i + 2] = base[i + 2];

            base[i] -= delta * horizontalSpeed * (0.07 + field.speed[index] * 0.05);
            if (base[i] < -field.spreadX / 2 - 0.7) {
                base[i] = field.spreadX / 2 + 0.7;
                base[i + 1] = randomRange(-field.spreadY / 2, field.spreadY / 2);
            }
        }

        field.geometry.attributes.position.needsUpdate = true;
    }

    function updateSpeedLines(field, delta, elapsed, speedBoost = 1) {
        const positions = field.positions;

        for (let index = 0; index < field.base.length; index += 1) {
            const data = field.base[index];
            data.x -= delta * data.speed * speedBoost;
            if (data.x < -field.spreadX / 2 - 1.0) {
                data.x = field.spreadX / 2 + 1.0;
            }

            const i = index * 6;
            const flicker = 0.85 + Math.sin(elapsed * 2.2 + data.phase) * 0.15;
            positions[i] = data.x;
            positions[i + 1] = data.y;
            positions[i + 2] = 0.12;
            positions[i + 3] = data.x - data.length * flicker;
            positions[i + 4] = data.y;
            positions[i + 5] = 0.12;
        }

        field.geometry.attributes.position.needsUpdate = true;
    }

    function resize() {
        state.width = window.innerWidth;
        state.height = window.innerHeight;
        state.dpr = Math.min(window.devicePixelRatio || 1, 1.75);

        renderer.setPixelRatio(state.dpr);
        renderer.setSize(state.width, state.height, false);

        camera.aspect = state.width / state.height;
        camera.updateProjectionMatrix();
    }

    function animate(now) {
        const nextTime = now / 1000;
        const delta = Math.min(nextTime - state.time, 0.05) || 0.016;
        state.time = nextTime;

        readCssPhase();

        const duskPower = state.dusk;
        const nightPower = state.night;
        const floatY = Math.sin(nextTime * 0.18) * 0.045;

        updateParticles(goldDust, delta, nextTime, floatY, 1.0);
        updateParticles(redSparks, delta, nextTime * 1.15, floatY * 0.5, 1.3);
        updateParticles(blueNightDust, delta, nextTime * 0.8, floatY * 0.8, 0.75);
        updateParticles(foregroundEmbers, delta, nextTime * 1.35, floatY * 0.4, 1.55);
        updateSpeedLines(speedLines, delta, nextTime, 1.55);
        updateSpeedLines(skyLines, delta, nextTime, 0.72);

        goldDust.material.opacity = 0.34 + duskPower * 0.26 + (1 - nightPower) * 0.1;
        redSparks.material.opacity = 0.16 + duskPower * 0.22;
        blueNightDust.material.opacity = 0.04 + nightPower * 0.28;
        foregroundEmbers.material.opacity = 0.16 + duskPower * 0.18;
        speedLines.material.opacity = 0.14 + duskPower * 0.18 + (1 - nightPower) * 0.05;
        skyLines.material.opacity = 0.06 + nightPower * 0.18;

        sunGlow.material.opacity = 0.18 + (1 - nightPower) * 0.22 + duskPower * 0.12;
        moonGlow.material.opacity = nightPower * 0.28;
        horizonGlow.material.opacity = 0.12 + duskPower * 0.26;
        carUnderGlow.material.opacity = 0.24 + Math.sin(nextTime * 3.2) * 0.05 + duskPower * 0.12;

        rootGroup.rotation.z = Math.sin(nextTime * 0.05) * 0.006;
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();
    requestAnimationFrame(animate);
})();
