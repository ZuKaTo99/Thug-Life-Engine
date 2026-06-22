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
        count: 180,
        spreadX: 13,
        spreadY: 7,
        depthMin: -3.6,
        depthMax: 2.4,
        size: 0.035,
        color: 0xffcf75,
        opacity: 0.48
    });

    const redSparks = createParticleField({
        count: 46,
        spreadX: 12,
        spreadY: 5.6,
        depthMin: -2.5,
        depthMax: 2.0,
        size: 0.045,
        color: 0xff3359,
        opacity: 0.26
    });

    const blueNightDust = createParticleField({
        count: 90,
        spreadX: 13,
        spreadY: 6.8,
        depthMin: -3.8,
        depthMax: 1.8,
        size: 0.028,
        color: 0x8ab7ff,
        opacity: 0.18
    });

    goldDust.points.position.z = -1.1;
    redSparks.points.position.z = -0.6;
    blueNightDust.points.position.z = -1.4;

    rootGroup.add(goldDust.points, redSparks.points, blueNightDust.points);

    const sunGlow = createGlowSprite({
        color: 'rgba(255, 186, 82, 1)',
        inner: 0.36,
        outer: 0.0,
        size: 2.9,
        opacity: 0.28
    });
    sunGlow.position.set(3.85, 1.92, 0.2);
    rootGroup.add(sunGlow);

    const moonGlow = createGlowSprite({
        color: 'rgba(132, 170, 255, 1)',
        inner: 0.32,
        outer: 0.0,
        size: 2.5,
        opacity: 0.0
    });
    moonGlow.position.set(3.15, 2.5, 0.05);
    rootGroup.add(moonGlow);

    const horizonGlow = createGlowSprite({
        color: 'rgba(255, 110, 70, 1)',
        inner: 0.28,
        outer: 0.0,
        size: 4.8,
        opacity: 0.18
    });
    horizonGlow.position.set(1.9, -1.8, -0.3);
    horizonGlow.scale.y = 0.42;
    rootGroup.add(horizonGlow);

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
            speed[index] = randomRange(0.18, 0.62);
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

    function updateParticles(field, delta, elapsed, verticalBoost) {
        const positions = field.positions;
        const base = field.basePositions;

        for (let index = 0; index < field.phase.length; index += 1) {
            const i = index * 3;
            const drift = elapsed * field.speed[index];
            const wave = Math.sin(drift + field.phase[index]);
            const side = Math.cos(drift * 0.55 + field.phase[index]) * 0.16;

            positions[i] = base[i] + side;
            positions[i + 1] = base[i + 1] + wave * 0.08 + verticalBoost;
            positions[i + 2] = base[i + 2];

            base[i] -= delta * (0.05 + field.speed[index] * 0.035);
            if (base[i] < -field.spreadX / 2 - 0.6) {
                base[i] = field.spreadX / 2 + 0.6;
                base[i + 1] = randomRange(-field.spreadY / 2, field.spreadY / 2);
            }
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
        const floatY = Math.sin(nextTime * 0.18) * 0.04;

        updateParticles(goldDust, delta, nextTime, floatY);
        updateParticles(redSparks, delta, nextTime * 1.15, floatY * 0.5);
        updateParticles(blueNightDust, delta, nextTime * 0.8, floatY * 0.8);

        goldDust.material.opacity = 0.22 + duskPower * 0.22 + (1 - nightPower) * 0.08;
        redSparks.material.opacity = 0.10 + duskPower * 0.16;
        blueNightDust.material.opacity = 0.02 + nightPower * 0.23;

        sunGlow.material.opacity = 0.12 + (1 - nightPower) * 0.16 + duskPower * 0.08;
        moonGlow.material.opacity = nightPower * 0.20;
        horizonGlow.material.opacity = 0.08 + duskPower * 0.20;

        rootGroup.rotation.z = Math.sin(nextTime * 0.05) * 0.006;
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();
    requestAnimationFrame(animate);
})();
