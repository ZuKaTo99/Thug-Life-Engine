import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.min.js';

(() => {
    const canvas = document.getElementById('threeCanvas');
    const runnerElement = document.getElementById('runner');
    if (!canvas || !runnerElement || !THREE.WebGLRenderer) {
        return;
    }

    const state = {
        width: 0,
        height: 0,
        dpr: 1,
        time: 0,
        night: 0,
        dusk: 0,
        warm: 1
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
    const camera = new THREE.OrthographicCamera(-960, 960, 540, -540, -1000, 1000);
    camera.position.z = 400;

    const overlayGroup = new THREE.Group();
    scene.add(overlayGroup);

    const cityLights = new THREE.Group();
    const cityBloom = new THREE.Group();
    const roadLights = new THREE.Group();
    const rainGroup = new THREE.Group();
    const frontRainGroup = new THREE.Group();
    const skylineGroup = new THREE.Group();
    overlayGroup.add(cityLights, cityBloom, roadLights, rainGroup, frontRainGroup, skylineGroup);

    const carRig = new THREE.Group();
    overlayGroup.add(carRig);

    const textures = {
        warmLight: makeGlowTexture('rgba(255, 214, 129, 1)', 'rgba(255, 153, 62, 0.36)'),
        coolLight: makeGlowTexture('rgba(133, 196, 255, 1)', 'rgba(67, 130, 255, 0.18)'),
        redGlow: makeGlowTexture('rgba(255, 74, 94, 1)', 'rgba(255, 52, 86, 0.08)'),
        whiteGlow: makeGlowTexture('rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0.02)')
    };

    buildCityLights();
    buildRoadLights();
    buildSkyline();
    buildRain();
    buildFrontRain();
    buildCar();

    function makeGlowTexture(innerColor, outerColor) {
        const size = 256;
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const g = c.getContext('2d');
        const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, innerColor);
        gradient.addColorStop(0.28, innerColor.replace('1)', '0.88)'));
        gradient.addColorStop(0.58, outerColor);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gradient;
        g.fillRect(0, 0, size, size);
        const texture = new THREE.CanvasTexture(c);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    function makeSprite(texture, sizeX, sizeY, color = 0xffffff, opacity = 1) {
        const material = new THREE.SpriteMaterial({
            map: texture,
            color,
            transparent: true,
            opacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(sizeX, sizeY, 1);
        return sprite;
    }

    function normToWorld(nx, ny) {
        return {
            x: (nx - 0.5) * state.width,
            y: (0.5 - ny) * state.height
        };
    }

    function addCluster(targetGroup, count, bounds, texture, sizeRange, meta = {}) {
        for (let i = 0; i < count; i += 1) {
            const nx = rand(bounds.x0, bounds.x1);
            const ny = rand(bounds.y0, bounds.y1);
            const size = rand(sizeRange[0], sizeRange[1]);
            const sprite = makeSprite(texture, size, size, meta.color ?? 0xffffff, meta.opacity ?? 1);
            sprite.userData.baseOpacity = meta.opacity ?? 1;
            sprite.userData.twinkle = rand(0, Math.PI * 2);
            sprite.userData.twinkleSpeed = rand(0.6, 1.8);
            sprite.userData.nx = nx;
            sprite.userData.ny = ny;
            targetGroup.add(sprite);
        }
    }

    function buildCityLights() {
        addCluster(cityLights, 44, { x0: 0.06, x1: 0.22, y0: 0.44, y1: 0.66 }, textures.warmLight, [8, 16], { opacity: 0.84 });
        addCluster(cityLights, 52, { x0: 0.52, x1: 0.86, y0: 0.63, y1: 0.84 }, textures.warmLight, [7, 15], { opacity: 0.86 });
        addCluster(cityLights, 18, { x0: 0.58, x1: 0.77, y0: 0.43, y1: 0.58 }, textures.warmLight, [6, 12], { opacity: 0.66 });
        addCluster(cityLights, 24, { x0: 0.10, x1: 0.92, y0: 0.78, y1: 0.90 }, textures.whiteGlow, [4, 9], { opacity: 0.42 });
        addCluster(cityBloom, 12, { x0: 0.08, x1: 0.25, y0: 0.45, y1: 0.68 }, textures.warmLight, [28, 44], { opacity: 0.24 });
        addCluster(cityBloom, 14, { x0: 0.54, x1: 0.88, y0: 0.64, y1: 0.86 }, textures.redGlow, [30, 52], { opacity: 0.16 });
    }

    function buildRoadLights() {
        for (let i = 0; i < 8; i += 1) {
            const lineGeo = new THREE.PlaneGeometry(rand(90, 160), 3.5);
            const lineMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(i % 2 === 0 ? 0xffbf66 : 0xff5b71),
                transparent: true,
                opacity: 0.22,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const mesh = new THREE.Mesh(lineGeo, lineMat);
            mesh.userData.nx = rand(0.10, 0.94);
            mesh.userData.ny = rand(0.81, 0.92);
            mesh.userData.speed = rand(0.02, 0.06);
            mesh.userData.phase = rand(0, Math.PI * 2);
            roadLights.add(mesh);
        }
    }

    function buildSkyline() {
        for (let i = 0; i < 6; i += 1) {
            const geo = new THREE.PlaneGeometry(rand(160, 280), rand(1.6, 2.6));
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(i % 2 === 0 ? 0x92b8ff : 0xffd08a),
                transparent: true,
                opacity: 0.11,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.z = rand(-0.12, 0.12);
            mesh.userData.nx = rand(0.08, 0.90);
            mesh.userData.ny = rand(0.11, 0.23);
            mesh.userData.phase = rand(0, Math.PI * 2);
            skylineGroup.add(mesh);
        }
    }

    function buildRain() {
        for (let i = 0; i < 160; i += 1) {
            const geometry = new THREE.PlaneGeometry(rand(1.2, 2.0), rand(18, 34));
            const material = new THREE.MeshBasicMaterial({
                color: 0xbfdcff,
                transparent: true,
                opacity: 0.2,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const drop = new THREE.Mesh(geometry, material);
            drop.rotation.z = -0.34;
            drop.userData.nx = Math.random();
            drop.userData.ny = Math.random();
            drop.userData.speed = rand(0.38, 0.9);
            drop.userData.alpha = rand(0.12, 0.34);
            rainGroup.add(drop);
        }
    }

    function buildFrontRain() {
        for (let i = 0; i < 54; i += 1) {
            const geometry = new THREE.PlaneGeometry(rand(1.8, 3.0), rand(30, 64));
            const material = new THREE.MeshBasicMaterial({
                color: 0xe8f4ff,
                transparent: true,
                opacity: 0.18,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const drop = new THREE.Mesh(geometry, material);
            drop.rotation.z = -0.38;
            drop.userData.nx = Math.random();
            drop.userData.ny = Math.random();
            drop.userData.speed = rand(0.7, 1.35);
            drop.userData.alpha = rand(0.10, 0.24);
            frontRainGroup.add(drop);
        }
    }

    function shapeFrom(points) {
        const shape = new THREE.Shape();
        shape.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i += 1) {
            shape.lineTo(points[i][0], points[i][1]);
        }
        shape.closePath();
        return shape;
    }

    function buildCar() {
        const bodyShape = shapeFrom([
            [-58, -8], [-48, -20], [-25, -28], [8, -30], [30, -26], [50, -15], [60, -4], [56, 10], [38, 12], [-48, 12], [-58, 6]
        ]);
        const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
            depth: 18,
            bevelEnabled: true,
            bevelSize: 1.6,
            bevelThickness: 1.8,
            bevelSegments: 3
        });
        bodyGeo.center();
        const bodyMat = new THREE.MeshPhysicalMaterial({
            color: 0xb71332,
            metalness: 0.72,
            roughness: 0.32,
            clearcoat: 1,
            clearcoatRoughness: 0.12,
            emissive: 0x2a040d,
            emissiveIntensity: 0.55
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        carRig.add(body);

        const accent = new THREE.Mesh(
            new THREE.BoxGeometry(116, 3.2, 14),
            new THREE.MeshBasicMaterial({ color: 0xff4f6b, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending })
        );
        accent.position.set(0, -7, 3);
        carRig.add(accent);

        const cabinShape = shapeFrom([
            [-18, -17], [-6, -31], [15, -31], [32, -20], [16, -4], [-9, -4]
        ]);
        const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, {
            depth: 10,
            bevelEnabled: true,
            bevelSize: 1.0,
            bevelThickness: 1.2,
            bevelSegments: 2
        });
        cabinGeo.center();
        const cabinMat = new THREE.MeshPhysicalMaterial({
            color: 0x86d9ff,
            metalness: 0.08,
            roughness: 0.08,
            transmission: 0.2,
            transparent: true,
            opacity: 0.82,
            emissive: 0x12354a,
            emissiveIntensity: 0.9
        });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(8, -8, 8);
        carRig.add(cabin);

        const spoiler = new THREE.Mesh(
            new THREE.BoxGeometry(19, 3, 10),
            new THREE.MeshPhysicalMaterial({ color: 0x14171d, metalness: 0.45, roughness: 0.5 })
        );
        spoiler.position.set(-48, -20, 4);
        carRig.add(spoiler);

        const splitter = new THREE.Mesh(
            new THREE.BoxGeometry(20, 2, 8),
            new THREE.MeshBasicMaterial({ color: 0xffb870, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending })
        );
        splitter.position.set(54, 8, 3);
        carRig.add(splitter);

        const underGlow = makeSprite(textures.redGlow, 150, 34, 0xffffff, 0.48);
        underGlow.position.set(0, 16, -12);
        carRig.add(underGlow);
        const headLight = makeSprite(textures.whiteGlow, 20, 10, 0xfff0d2, 0.72);
        headLight.position.set(62, 2, 10);
        carRig.add(headLight);
        const tailLight = makeSprite(textures.redGlow, 18, 8, 0xffffff, 0.68);
        tailLight.position.set(-62, 3, 10);
        carRig.add(tailLight);

        const wheelGroup = new THREE.Group();
        carRig.add(wheelGroup);
        [
            { x: -34, y: 17 },
            { x: 34, y: 17 }
        ].forEach(({ x, y }) => {
            const tire = new THREE.Mesh(
                new THREE.CylinderGeometry(13, 13, 10, 28),
                new THREE.MeshStandardMaterial({ color: 0x0b0b0d, metalness: 0.25, roughness: 0.82 })
            );
            tire.rotation.z = Math.PI / 2;
            tire.position.set(x, y, 1);
            wheelGroup.add(tire);

            const rim = new THREE.Mesh(
                new THREE.CylinderGeometry(7, 7, 11.5, 18),
                new THREE.MeshStandardMaterial({ color: 0xbcc3d2, metalness: 0.95, roughness: 0.18, emissive: 0x101214, emissiveIntensity: 0.2 })
            );
            rim.rotation.z = Math.PI / 2;
            rim.position.set(x, y, 2);
            wheelGroup.add(rim);
        });

        scene.add(new THREE.AmbientLight(0xffffff, 0.56));
        const key = new THREE.DirectionalLight(0xffc688, 1.24);
        key.position.set(150, 120, 220);
        const rim = new THREE.DirectionalLight(0x87c8ff, 0.76);
        rim.position.set(-120, 50, 180);
        scene.add(key, rim);

        carRig.userData = { body, cabin, underGlow, headLight, tailLight, accent, wheelGroup };
    }

    function readCssPhase() {
        const styles = getComputedStyle(document.documentElement);
        state.night = parseFloat(styles.getPropertyValue('--night')) || 0;
        state.dusk = parseFloat(styles.getPropertyValue('--dusk')) || 0;
        state.warm = parseFloat(styles.getPropertyValue('--warm')) || 1;
    }

    function resize() {
        state.width = window.innerWidth;
        state.height = window.innerHeight;
        state.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        renderer.setPixelRatio(state.dpr);
        renderer.setSize(state.width, state.height, false);
        camera.left = -state.width / 2;
        camera.right = state.width / 2;
        camera.top = state.height / 2;
        camera.bottom = -state.height / 2;
        camera.updateProjectionMatrix();
        [...cityLights.children, ...cityBloom.children, ...roadLights.children, ...skylineGroup.children].forEach((child) => {
            if (child.userData.nx === undefined) return;
            const pos = normToWorld(child.userData.nx, child.userData.ny);
            child.position.set(pos.x, pos.y, child.position.z || 0);
        });
    }

    function updateCityLights(elapsed) {
        const nightFactor = smooth(clamp((state.night - 0.16) / 0.84, 0, 1));
        const duskBoost = state.dusk;
        cityLights.children.forEach((sprite, idx) => {
            const twinkle = 0.76 + Math.sin(elapsed * sprite.userData.twinkleSpeed + sprite.userData.twinkle + idx) * 0.24;
            sprite.material.opacity = sprite.userData.baseOpacity * (nightFactor * 0.85 + duskBoost * 0.35) * twinkle;
        });
        cityBloom.children.forEach((sprite, idx) => {
            const pulse = 0.82 + Math.sin(elapsed * 0.8 + sprite.userData.twinkle + idx) * 0.18;
            sprite.material.opacity = sprite.userData.baseOpacity * (nightFactor * 0.9 + duskBoost * 0.25) * pulse;
        });
        roadLights.children.forEach((mesh, idx) => {
            const pos = normToWorld(mesh.userData.nx, mesh.userData.ny);
            const drift = Math.sin(elapsed * mesh.userData.speed * 7 + mesh.userData.phase) * 18;
            mesh.position.set(pos.x + drift, pos.y, -20);
            mesh.material.opacity = (0.06 + nightFactor * 0.2 + duskBoost * 0.08) * (0.7 + Math.sin(elapsed + idx) * 0.3);
        });
        skylineGroup.children.forEach((mesh) => {
            const pos = normToWorld(mesh.userData.nx, mesh.userData.ny);
            mesh.position.set(pos.x, pos.y + Math.sin(elapsed * 0.6 + mesh.userData.phase) * 4, -60);
            mesh.material.opacity = 0.03 + state.dusk * 0.07 + nightFactor * 0.05;
        });
    }

    function updateRain() {
        const rainFactor = clamp((state.night - 0.42) / 0.58, 0, 1) * 0.9 + state.dusk * 0.35;
        rainGroup.visible = rainFactor > 0.04;
        frontRainGroup.visible = rainFactor > 0.06;
        rainGroup.children.forEach((drop) => {
            drop.userData.ny += drop.userData.speed * 0.0055;
            drop.userData.nx += drop.userData.speed * 0.0013;
            if (drop.userData.ny > 1.08 || drop.userData.nx > 1.08) {
                drop.userData.ny = -0.08;
                drop.userData.nx = rand(-0.08, 1);
            }
            const pos = normToWorld(drop.userData.nx, drop.userData.ny);
            drop.position.set(pos.x, pos.y, 90);
            drop.material.opacity = drop.userData.alpha * rainFactor;
        });
        frontRainGroup.children.forEach((drop) => {
            drop.userData.ny += drop.userData.speed * 0.008;
            drop.userData.nx += drop.userData.speed * 0.0017;
            if (drop.userData.ny > 1.12 || drop.userData.nx > 1.12) {
                drop.userData.ny = -0.12;
                drop.userData.nx = rand(-0.12, 1);
            }
            const pos = normToWorld(drop.userData.nx, drop.userData.ny);
            drop.position.set(pos.x, pos.y, 120);
            drop.material.opacity = drop.userData.alpha * rainFactor;
        });
    }

    function updateCar(elapsed) {
        const rect = runnerElement.getBoundingClientRect();
        const cx = rect.left + rect.width * 0.5 - state.width * 0.5;
        const cy = state.height * 0.5 - (rect.top + rect.height * 0.56);
        const jump = runnerElement.classList.contains('jumping');
        carRig.position.set(cx + 2, cy - 2, 40);
        carRig.rotation.y = Math.sin(elapsed * 0.9) * 0.04;
        carRig.rotation.x = -0.08 + Math.sin(elapsed * 2.3) * 0.01 + (jump ? -0.08 : 0);
        carRig.rotation.z = Math.sin(elapsed * 4.6) * 0.008 + (jump ? -0.03 : 0);
        carRig.userData.body.material.emissiveIntensity = 0.3 + state.night * 0.58 + state.dusk * 0.18;
        carRig.userData.cabin.material.emissiveIntensity = 0.4 + state.night * 0.8;
        carRig.userData.underGlow.material.opacity = 0.28 + state.night * 0.42 + state.dusk * 0.1;
        carRig.userData.headLight.material.opacity = 0.18 + state.night * 0.64 + state.dusk * 0.18;
        carRig.userData.tailLight.material.opacity = 0.28 + state.night * 0.3;
        carRig.userData.accent.material.opacity = 0.18 + state.night * 0.22;
        const wheelSpin = elapsed * 10.5;
        carRig.userData.wheelGroup.children.forEach((wheel, idx) => {
            wheel.rotation.x = idx % 2 === 0 ? wheelSpin : wheelSpin + 0.1;
        });
    }

    function clamp(v, min, max) {
        return Math.min(Math.max(v, min), max);
    }

    function smooth(t) {
        return t * t * (3 - 2 * t);
    }

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function animate(now) {
        const t = now * 0.001;
        state.time = t;
        readCssPhase();
        updateCityLights(t);
        updateRain();
        updateCar(t);
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();
    requestAnimationFrame(animate);
})();
