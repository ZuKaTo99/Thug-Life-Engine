import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

(() => {
    const canvas = document.getElementById("threeCanvas");
    const runnerElement = document.getElementById("runner");
    const switchButton = document.getElementById("carSwitch");
    if (!canvas || !runnerElement || !THREE.WebGLRenderer) return;

    const CAR_STORAGE_KEY = "thugLifeEngineSelectedCarV1";
    const CAR_MODELS = [
        {
            name: "Bugatti",
            url: new URL("../assets/models/CAR Model bughatti.glb", import.meta.url).href,
            targetWidth: 148,
            rotation: { x: 0, y: Math.PI / 2, z: 0 },
            position: { x: 0, y: -3, z: 0 },
            tint: 0xff3b58
        },
        {
            name: "Dodge",
            url: new URL("../assets/models/Dodge Charger.glb", import.meta.url).href,
            targetWidth: 144,
            rotation: { x: 0, y: Math.PI / 2, z: 0 },
            position: { x: 0, y: -2, z: 0 },
            tint: 0xff4d37
        }
    ];

    const state = {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: Math.min(window.devicePixelRatio || 1, 1.75),
        night: 0,
        dusk: 0,
        warm: 1,
        time: 0,
        selectedCarIndex: Number.parseInt(localStorage.getItem(CAR_STORAGE_KEY) || "0", 10) || 0
    };

    const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-state.width / 2, state.width / 2, state.height / 2, -state.height / 2, 0.1, 2500);
    camera.position.set(0, 0, 900);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.82);
    const keyLight = new THREE.DirectionalLight(0xffd6a6, 1.4);
    keyLight.position.set(260, 280, 360);
    const fillLight = new THREE.DirectionalLight(0x8ab7ff, 0.95);
    fillLight.position.set(-260, 120, 320);
    const rimLight = new THREE.DirectionalLight(0xff4e73, 0.75);
    rimLight.position.set(-300, 40, 240);
    scene.add(ambient, keyLight, fillLight, rimLight);

    const overlayGroup = new THREE.Group();
    scene.add(overlayGroup);

    const cityGroup = new THREE.Group();
    const bloomGroup = new THREE.Group();
    const roadGroup = new THREE.Group();
    const rainBackGroup = new THREE.Group();
    const rainFrontGroup = new THREE.Group();
    overlayGroup.add(cityGroup, bloomGroup, roadGroup, rainBackGroup, rainFrontGroup);

    const carAnchor = new THREE.Group();
    overlayGroup.add(carAnchor);

    const carModelRoot = new THREE.Group();
    carAnchor.add(carModelRoot);

    const runtime = {
        cityLights: [],
        blooms: [],
        roadBars: [],
        rainBack: [],
        rainFront: [],
        carEntries: [],
        activeCar: null,
        carUnderGlow: null,
        headLights: [],
        tailLights: []
    };

    const tex = {
        warm: createGlowTexture("rgba(255, 214, 129, 1)", "rgba(255, 153, 62, 0.28)"),
        red: createGlowTexture("rgba(255, 92, 112, 1)", "rgba(255, 56, 90, 0.20)"),
        white: createGlowTexture("rgba(255, 248, 225, 1)", "rgba(255, 255, 255, 0.08)"),
        rain: createRainTexture()
    };

    const loader = new GLTFLoader();

    function createGlowTexture(inner, outer) {
        const size = 256;
        const c = document.createElement("canvas");
        c.width = size;
        c.height = size;
        const g = c.getContext("2d");
        const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, inner);
        grad.addColorStop(0.28, inner.replace("1)", "0.82)"));
        grad.addColorStop(0.62, outer);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
        const texture = new THREE.CanvasTexture(c);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    function createRainTexture() {
        const c = document.createElement("canvas");
        c.width = 32;
        c.height = 128;
        const g = c.getContext("2d");
        const grad = g.createLinearGradient(16, 0, 16, 128);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(0.16, "rgba(230,244,255,0.25)");
        grad.addColorStop(0.56, "rgba(185,218,255,0.72)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        g.strokeStyle = grad;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(17, 4);
        g.lineTo(12, 124);
        g.stroke();
        g.fillStyle = "rgba(255,255,255,0.28)";
        g.beginPath();
        g.ellipse(12, 98, 3, 8, -0.15, 0, Math.PI * 2);
        g.fill();
        const texture = new THREE.CanvasTexture(c);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    function makeSprite(map, w, h, color = 0xffffff, opacity = 1) {
        const material = new THREE.SpriteMaterial({
            map,
            color,
            transparent: true,
            opacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(w, h, 1);
        return sprite;
    }

    function norm(nx, ny, z = 0) {
        return new THREE.Vector3((nx - 0.5) * state.width, (0.5 - ny) * state.height, z);
    }

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function clamp(v, min, max) {
        return Math.min(Math.max(v, min), max);
    }

    function smooth(t) {
        return t * t * (3 - 2 * t);
    }

    function readPhase() {
        const styles = getComputedStyle(document.documentElement);
        state.night = parseFloat(styles.getPropertyValue("--night")) || 0;
        state.dusk = parseFloat(styles.getPropertyValue("--dusk")) || 0;
        state.warm = parseFloat(styles.getPropertyValue("--warm")) || 1;
    }

    function buildCityLights() {
        const clusters = [
            { x0: 0.07, x1: 0.22, y0: 0.44, y1: 0.67, count: 54 },
            { x0: 0.52, x1: 0.88, y0: 0.64, y1: 0.87, count: 72 },
            { x0: 0.56, x1: 0.78, y0: 0.44, y1: 0.57, count: 22 },
            { x0: 0.10, x1: 0.92, y0: 0.79, y1: 0.91, count: 28 }
        ];
        clusters.forEach((cluster, idx) => {
            for (let i = 0; i < cluster.count; i += 1) {
                const sprite = makeSprite(tex.warm, rand(7, 16), rand(7, 16), 0xffffff, 0);
                sprite.userData = {
                    nx: rand(cluster.x0, cluster.x1),
                    ny: rand(cluster.y0, cluster.y1),
                    baseOpacity: idx === 3 ? rand(0.18, 0.34) : rand(0.36, 0.82),
                    twinkle: rand(0, Math.PI * 2),
                    speed: rand(0.7, 2.2)
                };
                cityGroup.add(sprite);
                runtime.cityLights.push(sprite);
            }
        });

        for (let i = 0; i < 20; i += 1) {
            const bloom = makeSprite(i % 2 ? tex.red : tex.warm, rand(26, 58), rand(26, 58), 0xffffff, 0);
            bloom.userData = {
                nx: rand(0.08, 0.9),
                ny: rand(0.56, 0.89),
                baseOpacity: rand(0.08, 0.20),
                twinkle: rand(0, Math.PI * 2),
                speed: rand(0.4, 1.1)
            };
            bloomGroup.add(bloom);
            runtime.blooms.push(bloom);
        }

        for (let i = 0; i < 12; i += 1) {
            const bar = new THREE.Mesh(
                new THREE.PlaneGeometry(rand(80, 180), 3.2),
                new THREE.MeshBasicMaterial({
                    color: i % 2 === 0 ? 0xffbc66 : 0xff6078,
                    transparent: true,
                    opacity: 0,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending
                })
            );
            bar.userData = {
                nx: rand(0.08, 0.94),
                ny: rand(0.80, 0.92),
                phase: rand(0, Math.PI * 2),
                speed: rand(0.2, 0.7)
            };
            roadGroup.add(bar);
            runtime.roadBars.push(bar);
        }
    }

    function buildRainLayer(group, count, front = false) {
        for (let i = 0; i < count; i += 1) {
            const drop = new THREE.Mesh(
                new THREE.PlaneGeometry(front ? rand(4, 7) : rand(2.4, 4.2), front ? rand(70, 118) : rand(40, 74)),
                new THREE.MeshBasicMaterial({
                    map: tex.rain,
                    color: front ? 0xf1f7ff : 0xb8d5ff,
                    transparent: true,
                    opacity: 0,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending
                })
            );
            drop.rotation.z = -0.38;
            drop.userData = {
                nx: Math.random(),
                ny: Math.random(),
                speed: front ? rand(0.95, 1.45) : rand(0.52, 1.02),
                alpha: front ? rand(0.10, 0.22) : rand(0.10, 0.24)
            };
            group.add(drop);
            (front ? runtime.rainFront : runtime.rainBack).push(drop);
        }
    }

    function enhanceMaterial(material, tint) {
        if (!material) return material;
        const clone = material.clone();
        clone.needsUpdate = true;
        if ("metalness" in clone) clone.metalness = Math.max(clone.metalness ?? 0, 0.38);
        if ("roughness" in clone) clone.roughness = Math.min(clone.roughness ?? 0.45, 0.42);
        if ("envMapIntensity" in clone) clone.envMapIntensity = 1.25;
        if (clone.color && tint) clone.color.lerp(new THREE.Color(tint), 0.05);
        return clone;
    }

    function normalizeModel(model, config) {
        const group = new THREE.Group();
        model.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z);
        model.traverse((child) => {
            if (!child.isMesh) return;
            child.frustumCulled = false;
            child.material = enhanceMaterial(child.material, config.tint);
        });
        group.add(model);
        group.updateMatrixWorld(true);
        let box = new THREE.Box3().setFromObject(group);
        let size = box.getSize(new THREE.Vector3());
        const scale = config.targetWidth / Math.max(size.x, 1);
        model.scale.setScalar(scale);
        group.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        group.position.sub(center);
        group.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(group);
        group.position.y -= box.min.y;
        group.position.x += config.position.x;
        group.position.y += config.position.y;
        group.position.z += config.position.z;
        return group;
    }

    function createFallbackCar(name) {
        const group = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(120, 26, 42),
            new THREE.MeshPhysicalMaterial({ color: name === "Bugatti" ? 0xb71332 : 0x202632, metalness: 0.65, roughness: 0.3, clearcoat: 1 })
        );
        body.position.y = 15;
        const cabin = new THREE.Mesh(
            new THREE.BoxGeometry(44, 22, 36),
            new THREE.MeshPhysicalMaterial({ color: 0x82ceff, transparent: true, opacity: 0.72, metalness: 0.05, roughness: 0.08 })
        );
        cabin.position.set(4, -4, 0);
        group.add(body, cabin);
        group.userData.isFallback = true;
        return group;
    }

    function loadCarModels() {
        CAR_MODELS.forEach((config, index) => {
            loader.load(
                config.url,
                (gltf) => {
                    const modelGroup = normalizeModel(gltf.scene, config);
                    modelGroup.visible = false;
                    carModelRoot.add(modelGroup);
                    runtime.carEntries[index] = { config, group: modelGroup, loaded: true };
                    setActiveCar(state.selectedCarIndex, false);
                },
                undefined,
                () => {
                    const fallback = createFallbackCar(config.name);
                    fallback.visible = false;
                    carModelRoot.add(fallback);
                    runtime.carEntries[index] = { config, group: fallback, loaded: false };
                    setActiveCar(state.selectedCarIndex, false);
                }
            );
        });
    }

    function setActiveCar(index, save = true) {
        if (!runtime.carEntries.length) return;
        const safeIndex = ((index % CAR_MODELS.length) + CAR_MODELS.length) % CAR_MODELS.length;
        state.selectedCarIndex = safeIndex;
        if (save) localStorage.setItem(CAR_STORAGE_KEY, String(safeIndex));
        runtime.carEntries.forEach((entry, idx) => {
            if (entry?.group) entry.group.visible = idx === safeIndex;
        });
        runtime.activeCar = runtime.carEntries[safeIndex] || null;
        if (switchButton) {
            const label = runtime.activeCar?.config?.name ?? CAR_MODELS[safeIndex].name;
            switchButton.textContent = `Auto: ${label}`;
        }
    }

    function buildCarLights() {
        const under = makeSprite(tex.red, 170, 42, 0xffffff, 0.22);
        under.position.set(0, 22, -35);
        carAnchor.add(under);
        runtime.carUnderGlow = under;

        const headLeft = makeSprite(tex.white, 24, 12, 0xfff0d2, 0.14);
        const headRight = headLeft.clone();
        headLeft.position.set(68, 2, -16);
        headRight.position.set(68, 2, 16);
        carAnchor.add(headLeft, headRight);
        runtime.headLights.push(headLeft, headRight);

        const tailLeft = makeSprite(tex.red, 20, 10, 0xffffff, 0.18);
        const tailRight = tailLeft.clone();
        tailLeft.position.set(-68, 2, -16);
        tailRight.position.set(-68, 2, 16);
        carAnchor.add(tailLeft, tailRight);
        runtime.tailLights.push(tailLeft, tailRight);
    }

    function updateAnchors() {
        [...runtime.cityLights, ...runtime.blooms, ...runtime.roadBars].forEach((obj) => {
            const p = norm(obj.userData.nx, obj.userData.ny, obj.position.z || 0);
            obj.position.x = p.x;
            obj.position.y = p.y;
        });
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
        updateAnchors();
    }

    function updateCity(elapsed) {
        const cityActivation = state.night;

        runtime.cityLights.forEach((sprite, idx) => {
            const twinkle = 0.82 + Math.sin(elapsed * sprite.userData.speed + sprite.userData.twinkle + idx) * 0.18;
            sprite.material.opacity = sprite.userData.baseOpacity * cityActivation * 0.42 * twinkle;
        });
        runtime.blooms.forEach((sprite, idx) => {
            const pulse = 0.86 + Math.sin(elapsed * sprite.userData.speed + sprite.userData.twinkle + idx) * 0.14;
            sprite.material.opacity = sprite.userData.baseOpacity * cityActivation * 0.55 * pulse;
        });
        runtime.roadBars.forEach((bar, idx) => {
            const base = norm(bar.userData.nx, bar.userData.ny, -20);
            const drift = Math.sin(elapsed * bar.userData.speed + bar.userData.phase) * 22;
            bar.position.set(base.x + drift, base.y, -20);
            bar.material.opacity = cityActivation * (0.03 + (0.05 * (0.5 + 0.5 * Math.sin(elapsed + idx))));
        });
    }

    function updateRain() {
        const rainActivation = state.night;
        rainBackGroup.visible = rainActivation > 0.02;
        rainFrontGroup.visible = rainActivation > 0.02;
        runtime.rainBack.forEach((drop) => {
            drop.userData.ny += drop.userData.speed * 0.0066;
            drop.userData.nx += drop.userData.speed * 0.0015;
            if (drop.userData.ny > 1.1 || drop.userData.nx > 1.08) {
                drop.userData.ny = -0.10;
                drop.userData.nx = rand(-0.08, 1);
            }
            const p = norm(drop.userData.nx, drop.userData.ny, 120);
            drop.position.set(p.x, p.y, 120);
            drop.material.opacity = drop.userData.alpha * rainActivation;
        });
        runtime.rainFront.forEach((drop) => {
            drop.userData.ny += drop.userData.speed * 0.0094;
            drop.userData.nx += drop.userData.speed * 0.0021;
            if (drop.userData.ny > 1.15 || drop.userData.nx > 1.10) {
                drop.userData.ny = -0.15;
                drop.userData.nx = rand(-0.10, 1);
            }
            const p = norm(drop.userData.nx, drop.userData.ny, 180);
            drop.position.set(p.x, p.y, 180);
            drop.material.opacity = drop.userData.alpha * rainActivation;
        });
    }

    function updateCar(elapsed) {
        const rect = runnerElement.getBoundingClientRect();
        const x = rect.left + rect.width * 0.5 - state.width * 0.5;
        const y = state.height * 0.5 - (rect.bottom - 5);
        const jumping = runnerElement.classList.contains("jumping");
        carAnchor.position.set(x, y, 80);
        carAnchor.rotation.x = 0.08 + (jumping ? -0.11 : 0) + Math.sin(elapsed * 5.5) * 0.01;
        carAnchor.rotation.y = -0.38 + Math.sin(elapsed * 1.1) * 0.025;
        carAnchor.rotation.z = (jumping ? -0.04 : 0) + Math.sin(elapsed * 2.0) * 0.004;

        const cityActivation = state.night;
        if (runtime.carUnderGlow) runtime.carUnderGlow.material.opacity = 0.14 + cityActivation * 0.42;
        runtime.headLights.forEach((light) => (light.material.opacity = 0.08 + cityActivation * 0.62));
        runtime.tailLights.forEach((light) => (light.material.opacity = 0.12 + cityActivation * 0.34));
    }

    function bindCarSwitch() {
        if (!switchButton) return;
        switchButton.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            setActiveCar(state.selectedCarIndex + 1);
        });
    }

    buildCityLights();
    buildRainLayer(rainBackGroup, 120, false);
    buildRainLayer(rainFrontGroup, 42, true);
    buildCarLights();
    loadCarModels();
    bindCarSwitch();
    resize();

    function animate(now) {
        state.time = now * 0.001;
        readPhase();
        updateCity(state.time);
        updateRain();
        updateCar(state.time);
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    window.addEventListener("resize", resize, { passive: true });
    requestAnimationFrame(animate);
})();
