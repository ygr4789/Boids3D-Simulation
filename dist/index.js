var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
var scene = new THREE.Scene();
var setcolor = "#bbbbbb";
scene.background = new THREE.Color(setcolor);
var renderer = new THREE.WebGLRenderer({
    antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000.0);
camera.position.set(40, 40, 45);
var controls = new OrbitControls(camera, renderer.domElement);
controls.listenToKeyEvents(window);
function window_onsize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.onresize = window_onsize;
// scene.pause = true
// ================ Light setting ====================
var ambientLight = new THREE.AmbientLight(0xaaaaaa);
scene.add(ambientLight);
var dirLight = new THREE.DirectionalLight(0xffffff);
dirLight.position.set(1, 1, 1);
dirLight.castShadow = true;
scene.add(dirLight);
var lightBack = new THREE.PointLight(0x0fffff, 1);
lightBack.position.set(0, -3, -1);
scene.add(lightBack);
// # ===========Creating Bound Box ============
var boundRange = 30;
var bound_material = new THREE.MeshStandardMaterial();
bound_material.color = new THREE.Color(0x444488);
bound_material.transparent = true;
bound_material.opacity = 0.1;
var edge_material = new THREE.LineBasicMaterial();
edge_material.color = new THREE.Color(0xfffffff);
var bound = new THREE.Mesh(new THREE.BoxGeometry(boundRange * 2, boundRange * 2, boundRange * 2), bound_material);
var edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(boundRange * 2, boundRange * 2, boundRange * 2)));
scene.add(bound);
scene.add(edges);
// ===================== CORE =====================
var boidsP = [];
var boidsV = [];
var boidsN;
var boidsShapes = [];
var protectedRange = 3;
var avoidFactor = 0.01;
var alignFactor = 0.1;
var cohesionFactor = 0.01;
var pushFactor = 0.05;
var visibilityRange = 10;
var velocityLimit = 0.5;
var isPlay = false;
function create_boids(num) {
    boidsN = num;
    reset_state();
    for (var i = 0; i < num; i++) {
        var geometry = new THREE.CylinderGeometry(0.0, 0.75, 2.25, 4, 1);
        var material = new THREE.MeshPhongMaterial();
        material.color = new THREE.Color(0x993333);
        material.flatShading = true;
        var boidShape = new THREE.Mesh(geometry, material);
        boidsShapes.push(boidShape);
        scene.add(boidShape);
    }
}
function draw_boids() {
    for (var i = 0; i < boidsN; i++) {
        boidsShapes[i].position.copy(boidsP[i]);
        var norm = boidsV[i].length();
        var axis = boidsV[i].clone();
        axis.setY(axis.y + norm);
        axis.normalize();
        boidsShapes[i].setRotationFromAxisAngle(axis, Math.PI);
    }
}
function update_boids() {
    if (!isPlay)
        return;
    for (var i = 0; i < boidsN; i++) {
        var vel1 = rule1(i);
        var vel2 = rule2(i);
        var vel3 = rule3(i);
        boidsV[i].add(vel1).add(vel2).add(vel3);
        boidsP[i].add(boidsV[i]);
    }
    handle_boundary();
    limit_velocity();
}
function rule1(i) {
    var ret = new THREE.Vector3();
    for (var _i = 0, boidsP_1 = boidsP; _i < boidsP_1.length; _i++) {
        var P = boidsP_1[_i];
        var D = new THREE.Vector3().subVectors(boidsP[i], P);
        if (D.length() < protectedRange)
            ret.add(D);
    }
    return ret.multiplyScalar(avoidFactor);
}
function rule2(i) {
    var ret = new THREE.Vector3();
    var neighbors = find_neighbors(i);
    if (neighbors.length == 0)
        return ret;
    for (var _i = 0, neighbors_1 = neighbors; _i < neighbors_1.length; _i++) {
        var j = neighbors_1[_i];
        ret.add(new THREE.Vector3().subVectors(boidsV[j], boidsV[i]));
    }
    ret.divideScalar(neighbors.length);
    return ret.multiplyScalar(alignFactor);
}
function rule3(i) {
    var ret = new THREE.Vector3();
    var neighbors = find_neighbors(i);
    if (neighbors.length == 0)
        return ret;
    for (var _i = 0, neighbors_2 = neighbors; _i < neighbors_2.length; _i++) {
        var j = neighbors_2[_i];
        ret.add(new THREE.Vector3().subVectors(boidsP[j], boidsP[i]));
    }
    ret.divideScalar(neighbors.length);
    return ret.multiplyScalar(cohesionFactor);
}
function find_neighbors(i) {
    var ret = [];
    for (var j = 0; j < boidsN; j++) {
        if (i == j)
            continue;
        if (boidsP[i].distanceTo(boidsP[j]) < visibilityRange)
            ret.push(j);
    }
    return ret;
}
function handle_boundary() {
    for (var i = 0; i < boidsN; i++) {
        for (var n = 0; n < 3; n++) {
            if (boidsP[i].getComponent(n) < -boundRange)
                boidsV[i].setComponent(n, boidsV[i].getComponent(n) + pushFactor);
            if (boidsP[i].getComponent(n) > boundRange)
                boidsV[i].setComponent(n, boidsV[i].getComponent(n) - pushFactor);
        }
    }
}
function limit_velocity() {
    for (var _i = 0, boidsV_1 = boidsV; _i < boidsV_1.length; _i++) {
        var V = boidsV_1[_i];
        var vnorm = V.length();
        if (vnorm > velocityLimit)
            V.multiplyScalar(velocityLimit / vnorm);
    }
}
function animate() {
    update_boids();
    draw_boids();
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
function toggle_run() {
    isPlay = !isPlay;
}
function reset_state() {
    boidsP = [];
    boidsV = [];
    for (var i = 0; i < boidsN; i++) {
        var P = new THREE.Vector3()
            .random()
            .subScalar(0.5)
            .multiplyScalar(boundRange * 2);
        var V = new THREE.Vector3().randomDirection().multiplyScalar((Math.random() * velocityLimit) / 2);
        boidsP.push(P);
        boidsV.push(V);
    }
}
function init_controllers() {
    var _a, _b, _c, _d, _e;
    function generate_Slider(id, min, max, init, name) {
        var ret = document.createElement("div");
        ret.className = "sliderContainer";
        var slider = document.createElement("input");
        slider.setAttribute("type", "range");
        slider.setAttribute("min", String(min));
        slider.setAttribute("max", String(max));
        slider.setAttribute("step", String((max - min) / 1000));
        slider.setAttribute("value", String(init));
        slider.className = "slider";
        slider.id = "Slider" + String(id);
        var label = document.createElement("label");
        label.setAttribute("for", slider.id);
        label.innerHTML = name;
        var span = document.createElement("span");
        span.id = "SliderValue" + String(id);
        span.innerHTML = String(init);
        ret.replaceChildren(slider, label, span);
        return ret;
    }
    var runButton = document.createElement("button");
    runButton.onclick = toggle_run;
    runButton.innerHTML = "run/pause";
    (_a = document.getElementById("controller")) === null || _a === void 0 ? void 0 : _a.appendChild(runButton);
    var resetButton = document.createElement("button");
    resetButton.onclick = reset_state;
    resetButton.innerHTML = "reset";
    (_b = document.getElementById("controller")) === null || _b === void 0 ? void 0 : _b.appendChild(resetButton);
    (_c = document.getElementById("controller")) === null || _c === void 0 ? void 0 : _c.appendChild(generate_Slider(0, 0, 5 * avoidFactor, avoidFactor, "avoidFactor"));
    document.getElementById("Slider0").oninput = function () {
        avoidFactor = Number(document.getElementById("Slider0").value);
        document.getElementById("SliderValue0").innerHTML = String(avoidFactor.toFixed(4));
    };
    (_d = document.getElementById("controller")) === null || _d === void 0 ? void 0 : _d.appendChild(generate_Slider(1, 0, 5 * alignFactor, alignFactor, "alignFactor"));
    document.getElementById("Slider1").oninput = function () {
        alignFactor = Number(document.getElementById("Slider1").value);
        document.getElementById("SliderValue1").innerHTML = String(alignFactor.toFixed(4));
    };
    (_e = document.getElementById("controller")) === null || _e === void 0 ? void 0 : _e.appendChild(generate_Slider(2, 0, 5 * cohesionFactor, cohesionFactor, "cohesionFactor"));
    document.getElementById("Slider2").oninput = function () {
        cohesionFactor = Number(document.getElementById("Slider2").value);
        document.getElementById("SliderValue2").innerHTML = String(cohesionFactor.toFixed(4));
    };
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var boid_num;
        return __generator(this, function (_a) {
            boid_num = 500;
            create_boids(boid_num);
            draw_boids();
            init_controllers();
            renderer.render(scene, camera);
            animate();
            return [2 /*return*/];
        });
    });
}
main();
//# sourceMappingURL=index.js.map