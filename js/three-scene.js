import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.min.js";

(() => {
    const canvas = document.getElementById("threeCanvas");
    const runnerElement = document.getElementById("runner");
    if (!canvas || !runnerElement) return;

    const state = {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: Math.min(window.devicePixelRatio || 1, 1.75),
        night: 0,
        dusk: 0,
        time: 0
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
    const camera = new THREE.OrthographicCamera(-state.width / 2, state.width / 2, state.height / 2, -state.height / 2, 0.1, 2000);
    camera.position.set(0, 0, 800);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.75);
    const keyLight = new THREE.DirectionalLight(0xffd5a3, 1.2);
    keyLight.position.set(200, 280, 260);
    const fillLight = new THREE.DirectionalLight(0x89b7ff, 0.9);
    fillLight.position.set(-180, 110, 280);
    const rimLight = new THREE.DirectionalLight(0xff4e73, 0.4);
    rimLight.position.set(-220, 40, 180);
    scene.add(ambient, keyLight, fillLight, rimLight);

    const overlayGroup = new THREE.Group();
    scene.add(overlayGroup);

    const cityGroup = new THREE.Group();
    const bloomGroup = new THREE.Group();
    const roadGroup = new THREE.Group();
    const rainBackGroup = new THREE.Group();
    const rainFrontGroup = new THREE.Group();
    overlayGroup.add(cityGroup, bloomGroup, roadGroup, rainBackGroup, rainFrontGroup);

    const carRoot = new THREE.Group();
    overlayGroup.add(carRoot);

    const runtime = {
        cityLights: [],
        blooms: [],
        roadBars: [],
        rainBack: [],
        rainFront: [],
        car: null,
        groundGlow: null,
        headLights: [],
        tailLights: [],
        wheels: []
    };

    const tex = {
        warm: createGlowTexture("rgba(255, 211, 128, 1)", "rgba(255, 154, 74, 0.28)"),
        red: createGlowTexture("rgba(255, 92, 112, 1)", "rgba(255, 56, 90, 0.20)"),
        white: createGlowTexture("rgba(255, 248, 225, 1)", "rgba(255, 255, 255, 0.08)"),
        cyan: createGlowTexture("rgba(135, 214, 255, 1)", "rgba(70, 154, 255, 0.18)")
    };

    function createGlowTexture(inner, outer) {
        const size = 256;
        const c = document.createElement("canvas");
        c.width = size;
        c.height = size;
        const g = c.getContext("2d");
        const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, inner);
        grad.addColorStop(0.28, inner.replace("1)", "0.85)"));
        grad.addColorStop(0.6, outer);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
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
    }

    function addCityClusters() {
        const clusters = [
            { x0: 0.07, x1: 0.22, y0: 0.44, y1: 0.67, count: 48 },
            { x0: 0.52, x1: 0.88, y0: 0.64, y1: 0.87, count: 62 },
            { x0: 0.56, x1: 0.78, y0: 0.44, y1: 0.57, count: 20 },
            { x0: 0.10, x1: 0.92, y0: 0.79, y1: 0.91, count: 24 }
        ];
        clusters.forEach((cluster, idx) => {
            for (let i = 0; i < cluster.count; i += 1) {
                const sprite = makeSprite(tex.warm, rand(8, 18), rand(8, 18), 0xffffff, 0);
                sprite.userData = {
                    nx: rand(cluster.x0, cluster.x1),
                    ny: rand(cluster.y0, cluster.y1),
                    baseOpacity: idx === 3 ? rand(0.18, 0.36) : rand(0.38, 0.85),
                    twinkle: rand(0, Math.PI * 2),
                    speed: rand(0.7, 2.2)
                };
                cityGroup.add(sprite);
                runtime.cityLights.push(sprite);
            }
        });

        for (let i = 0; i < 18; i += 1) {
            const bloom = makeSprite(i % 2 ? tex.red : tex.warm, rand(26, 52), rand(26, 52), 0xffffff, 0);
            bloom.userData = {
                nx: rand(0.08, 0.9),
                ny: rand(0.56, 0.89),
                baseOpacity: rand(0.08, 0.22),
                twinkle: rand(0, Math.PI * 2),
                speed: rand(0.4, 1.1)
            };
            bloomGroup.add(bloom);
            runtime.blooms.push(bloom);
        }

        for (let i = 0; i < 10; i += 1) {
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

    function addRain(group, count, front = false) {
        for (let i = 0; i < count; i += 1) {
            const drop = new THREE.Mesh(
                new THREE.PlaneGeometry(front ? rand(2.2, 3.6) : rand(1.2, 2.2), front ? rand(42, 76) : rand(20, 38)),
                new THREE.MeshBasicMaterial({
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
                speed: front ? rand(0.9, 1.45) : rand(0.42, 0.95),
                alpha: front ? rand(0.07, 0.18) : rand(0.08, 0.22)
            };
            group.add(drop);
            (front ? runtime.rainFront : runtime.rainBack).push(drop);
        }
    }

    function createCar() {
        const car = new THREE.Group();

        const bodyMat = new THREE.MeshPhysicalMaterial({
            color: 0xb21330,
            metalness: 0.78,
            roughness: 0.28,
            clearcoat: 1,
            clearcoatRoughness: 0.08,
            emissive: 0x25050c,
            emissiveIntensity: 0.2
        });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x13161b, metalness: 0.45, roughness: 0.55 });
        const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0x94d6ff,
            metalness: 0.02,
            roughness: 0.05,
            transmission: 0.15,
            transparent: true,
            opacity: 0.82,
            emissive: 0x0f2d42,
            emissiveIntensity: 0.35
        });
        const accentMat = new THREE.MeshBasicMaterial({ color: 0xff5470, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending });

        const chassis = new THREE.Mesh(new THREE.BoxGeometry(126, 18, 38), bodyMat);
        chassis.position.set(0, 6, 0);
        car.add(chassis);

        const hood = new THREE.Mesh(new THREE.BoxGeometry(34, 10, 36), bodyMat);
        hood.position.set(43, 0, 0);
        hood.rotation.z = -0.14;
        car.add(hood);

        const trunk = new THREE.Mesh(new THREE.BoxGeometry(26, 9, 34), bodyMat);
        trunk.position.set(-44, 0, 0);
        trunk.rotation.z = 0.12;
        car.add(trunk);

        const cabinBase = new THREE.Mesh(new THREE.BoxGeometry(56, 14, 34), darkMat);
        cabinBase.position.set(4, -9, 0);
        car.add(cabinBase);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(38, 12, 30), bodyMat);
        roof.position.set(2, -18, 0);
        car.add(roof);

        const windshield = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 30), glassMat);
        windshield.position.set(20, -14, 0);
        windshield.rotation.z = -0.48;
        car.add(windshield);

        const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 28), glassMat);
        rearWindow.position.set(-16, -15, 0);
        rearWindow.rotation.z = 0.35;
        car.add(rearWindow);

        const sideSkirt = new THREE.Mesh(new THREE.BoxGeometry(122, 2.4, 30), accentMat);
        sideSkirt.position.set(0, 16, 0);
        car.add(sideSkirt);

        const spoilerStandL = new THREE.Mesh(new THREE.BoxGeometry(2, 7, 3), darkMat);
        spoilerStandL.position.set(-56, -18, -10);
        const spoilerStandR = spoilerStandL.clone();
        spoilerStandR.position.z = 10;
        const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(20, 2.5, 16), darkMat);
        spoilerWing.position.set(-56, -22, 0);
        car.add(spoilerStandL, spoilerStandR, spoilerWing);

        const splitter = new THREE.Mesh(new THREE.BoxGeometry(18, 1.6, 26), darkMat);
        splitter.position.set(59, 16, 0);
        car.add(splitter);

        const underGlow = makeSprite(tex.red, 150, 36, 0xffffff, 0.32);
        underGlow.position.set(0, 25, -10);
        car.add(underGlow);
        runtime.groundGlow = underGlow;

        const lightLeft = makeSprite(tex.white, 16, 10, 0xfff5dd, 0.15);
        lightLeft.position.set(63, 4, -10);
        const lightRight = lightLeft.clone();
        lightRight.position.z = 10;
        car.add(lightLeft, lightRight);
        runtime.headLights.push(lightLeft, lightRight);

        const tailLeft = makeSprite(tex.red, 14, 8, 0xffffff, 0.16);
        tailLeft.position.set(-63, 4, -10);
        const tailRight = tailLeft.clone();
        tailRight.position.z = 10;
        car.add(tailLeft, tailRight);
        runtime.tailLights.push(tailLeft, tailRight);

        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, metalness: 0.28, roughness: 0.8 });
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xb9c1cf, metalness: 0.95, roughness: 0.18 });
        [
            { x: -36, y: 18, z: -16 },
            { x: 34, y: 18, z: -16 },
            { x: -36, y: 18, z: 16 },
            { x: 34, y: 18, z: 16 }
        ].forEach((p) => {
            const wheel = new THREE.Group();
            const tire = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 8, 26), wheelMat);
            tire.rotation.x = Math.PI / 2;
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 8.4, 18), rimMat);
            rim.rotation.x = Math.PI / 2;
            wheel.add(tire, rim);
            wheel.position.set(p.x, p.y, p.z);
            car.add(wheel);
            runtime.wheels.push(wheel);
        });

        car.rotation.x = 0.22;
        car.rotation.y = -0.46;
        car.rotation.z = 0.02;
        car.scale.set(1.05, 1.05, 1.05);
        carRoot.add(car);
        runtime.car = car;
    }

    function updateScreenAnchors() {
        const all = [...runtime.cityLights, ...runtime.blooms, ...runtime.roadBars];
        all.forEach((obj) => {
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
        updateScreenAnchors();
    }

    function updateCity(elapsed) {
        const duskActivation = clamp((state.dusk - 0.10) / 0.55, 0, 1);
        const nightActivation = smooth(clamp((state.night - 0.35) / 0.65, 0, 1));
        const cityActivation = Math.max(duskActivation * 0.55, nightActivation);

        runtime.cityLights.forEach((sprite, idx) => {
            const twinkle = 0.8 + Math.sin(elapsed * sprite.userData.speed + sprite.userData.twinkle + idx) * 0.2;
            sprite.material.opacity = sprite.userData.baseOpacity * cityActivation * twinkle;
        });
        runtime.blooms.forEach((sprite, idx) => {
            const pulse = 0.84 + Math.sin(elapsed * sprite.userData.speed + sprite.userData.twinkle + idx) * 0.16;
            sprite.material.opacity = sprite.userData.baseOpacity * cityActivation * pulse;
        });
        runtime.roadBars.forEach((bar, idx) => {
            const base = norm(bar.userData.nx, bar.userData.ny, -20);
            const drift = Math.sin(elapsed * bar.userData.speed + bar.userData.phase) * 22;
            bar.position.set(base.x + drift, base.y, -20);
            bar.material.opacity = cityActivation * (0.06 + (0.08 * (0.5 + 0.5 * Math.sin(elapsed + idx))));
        });
    }

    function updateRain() {
        const rainActivation = smooth(clamp((state.night - 0.62) / 0.38, 0, 1));
        rainBackGroup.visible = rainActivation > 0.02;
        rainFrontGroup.visible = rainActivation > 0.02;
        runtime.rainBack.forEach((drop) => {
            drop.userData.ny += drop.userData.speed * 0.0058;
            drop.userData.nx += drop.userData.speed * 0.0014;
            if (drop.userData.ny > 1.1 || drop.userData.nx > 1.08) {
                drop.userData.ny = -0.10;
                drop.userData.nx = rand(-0.08, 1);
            }
            const p = norm(drop.userData.nx, drop.userData.ny, 120);
            drop.position.set(p.x, p.y, 120);
            drop.material.opacity = drop.userData.alpha * rainActivation;
        });
        runtime.rainFront.forEach((drop) => {
            drop.userData.ny += drop.userData.speed * 0.0084;
            drop.userData.nx += drop.userData.speed * 0.0019;
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
        if (!runtime.car) return;
        const rect = runnerElement.getBoundingClientRect();
        const x = rect.left + rect.width * 0.5 - state.width * 0.5;
        const y = state.height * 0.5 - (rect.top + rect.height * 0.62);
        const jumping = runnerElement.classList.contains("jumping");
        carRoot.position.set(x, y, 80);
        const bob = Math.sin(elapsed * 6.0) * 0.015;
        runtime.car.rotation.x = 0.22 + (jumping ? -0.10 : 0) + bob;
        runtime.car.rotation.y = -0.46 + Math.sin(elapsed * 1.3) * 0.03;
        runtime.car.rotation.z = 0.02 + (jumping ? -0.045 : 0) + Math.sin(elapsed * 2.2) * 0.006;
        const wheelSpin = elapsed * 12.5;
        runtime.wheels.forEach((wheel) => {
            wheel.rotation.z = wheelSpin;
        });
        const cityActivation = Math.max(clamp((state.dusk - 0.1) / 0.55, 0, 1) * 0.55, smooth(clamp((state.night - 0.35) / 0.65, 0, 1)));
        runtime.groundGlow.material.opacity = 0.18 + cityActivation * 0.34;
        runtime.headLights.forEach((light) => (light.material.opacity = 0.10 + cityActivation * 0.48));
        runtime.tailLights.forEach((light) => (light.material.opacity = 0.16 + cityActivation * 0.24));
    }

    addCityClusters();
    addRain(rainBackGroup, 150, false);
    addRain(rainFrontGroup, 56, true);
    createCar();
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
