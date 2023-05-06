import * as THREE from "three";
import * as Stats from "stats.js";
import * as dat from "dat.gui";
import * as KD_TREE from "kd-tree-javascript";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import "./style/style.css";

const scene = new THREE.Scene();
const setcolor = "#000000";
scene.background = new THREE.Color(setcolor);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000.0);
camera.position.set(40, 40, 45);

const controls = new OrbitControls(camera, renderer.domElement);
controls.listenToKeyEvents(window);

function window_onsize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onresize = window_onsize;

// ================ Light setting ====================

const ambientLight = new THREE.AmbientLight(0xaaaaaa);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff);
dirLight.position.set(1, 1, 1);
dirLight.castShadow = true;
scene.add(dirLight);

const lightBack = new THREE.PointLight(0x0fffff, 1);
lightBack.position.set(0, -3, -1);
scene.add(lightBack);

// # ===========Creating Bound Box ============

const boundRange = 20;

const bound_material = new THREE.MeshStandardMaterial();
bound_material.color = new THREE.Color(0x444488);
bound_material.transparent = true;
bound_material.opacity = 0.1;
bound_material.side = THREE.BackSide;

const edge_material = new THREE.LineBasicMaterial();
edge_material.color = new THREE.Color(0xfffffff);

const bound = new THREE.Mesh(new THREE.BoxGeometry(boundRange * 2, boundRange * 2, boundRange * 2), bound_material);
// const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(boundRange * 2, boundRange * 2, boundRange * 2)));

// scene.add(bound);
// scene.add(edges);

// ===================== CORE =====================

let boidsP: Array<THREE.Vector3> = [];
let boidsV: Array<THREE.Vector3> = [];
let boidsN: number;
let boidShapes: Array<THREE.Mesh> = [];

let protectedRange = 3;
let avoidFactor = 50;
let alignFactor = 10;
let cohesionFactor = 50;
let seekingFactor = 3;

let obstacleDetectRange = 10;
let obstacleAvoidFactor = 10000;

let nearestCount = 10;

let visibilityRange = 10;
let velocityLimit = 30;

let isPlay = false;
let isSeeking = false;
let obstacleAvailable = true;

type treeNode = {
  x: number;
  y: number;
  z: number;
  id: number;
};
let boidsTree: {
  arr: Array<treeNode>;
  tree: KD_TREE.kdTree<treeNode> | null;
  init: () => void;
  nodeOf: (i: number) => treeNode;
  update: (i: number) => void;
  nearest: (i: number, count: number, dist: number) => Array<number>;
} = {
  arr: [],
  tree: null,
  init() {
    this.arr = [];
    for (let i = 0; i < boidsN; i++) {
      this.arr.push(this.nodeOf(i));
    }
    this.tree = new KD_TREE.kdTree<treeNode>(
      this.arr,
      function (a, b) {
        return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2));
      },
      ["x", "y", "z"]
    );
  },
  nodeOf(i) {
    return {
      x: boidsP[i].x,
      y: boidsP[i].y,
      z: boidsP[i].z,
      id: i,
    };
  },
  update(i) {
    this.tree?.remove(this.arr[i]);
    this.arr[i] = this.nodeOf(i);
    this.tree?.insert(this.arr[i]);
  },
  nearest(i, count, dist) {
    let ret = [];
    for (let [node] of this.tree?.nearest(this.arr[i], count, dist)!) {
      ret.push(node.id);
    }
    return ret;
  },
};

// ===================== BOIDS CONTROL =====================

function create_boids(num: number) {
  boidsN = num;

  for (let i = 0; i < num; i++) {
    const geometry = new THREE.CylinderGeometry(0.0, 0.75, 2.25, 20, 1);
    const material = new THREE.MeshPhongMaterial();
    material.color = new THREE.Color(0x335577);
    material.flatShading = true;
    const boidShape = new THREE.Mesh(geometry, material);
    boidShapes.push(boidShape);
    scene.add(boidShape);
  }
}

function draw_boids() {
  for (let i = 0; i < boidsN; i++) {
    boidShapes[i].position.copy(boidsP[i]);

    let norm = boidsV[i].length();
    let axis = boidsV[i].clone();
    axis.setY(axis.y + norm);
    axis.normalize();
    boidShapes[i].setRotationFromAxisAngle(axis, Math.PI);
  }
}

function update_boids(dt: number) {
  if (!isPlay) return;
  for (let i = 0; i < boidsN; i++) {
    let acc = new THREE.Vector3();
    let acc1 = rule1(i);
    let acc2 = rule2(i);
    let acc3 = rule3(i);
    let acc4 = rule4(i);
    let acc5 = rule5(i);
    acc.add(acc1).add(acc2).add(acc3);
    if (isSeeking) acc.add(acc4);
    if (obstacleAvailable) acc.add(acc5);
    boidsV[i].add(acc.multiplyScalar(dt));
    handle_boundary(i);
    limit_velocity(i);
    prevent_collision(i, dt);
    boidsP[i].add(boidsV[i].clone().multiplyScalar(dt));
    boidsTree.update(i);
  }
}

function rule1(i: number): THREE.Vector3 {
  // Seperation
  let ret = new THREE.Vector3();
  let neighbors = boidsTree.nearest(i, nearestCount + 1, protectedRange);
  for (let j of neighbors) {
    ret.add(new THREE.Vector3().subVectors(boidsP[i], boidsP[j]));
  }

  return ret.multiplyScalar(avoidFactor);
}

function rule2(i: number): THREE.Vector3 {
  // Alignment
  let ret = new THREE.Vector3();
  let neighbors = boidsTree.nearest(i, nearestCount + 1, visibilityRange);
  if (neighbors.length <= 1) return ret;
  for (let j of neighbors) {
    ret.add(new THREE.Vector3().subVectors(boidsV[j], boidsV[i]));
  }
  ret.divideScalar(neighbors.length - 1);
  return ret.multiplyScalar(alignFactor);
}

function rule3(i: number): THREE.Vector3 {
  // Cohesion
  let ret = new THREE.Vector3();
  let neighbors = boidsTree.nearest(i, nearestCount + 1, visibilityRange);
  if (neighbors.length <= 1) return ret;
  for (let j of neighbors) {
    ret.add(new THREE.Vector3().subVectors(boidsP[j], boidsP[i]));
  }
  ret.divideScalar(neighbors.length - 1);
  return ret.multiplyScalar(cohesionFactor);
}

function rule4(i: number): THREE.Vector3 {
  // Goal Seeking
  let ret = new THREE.Vector3().subVectors(mouseTracker.position, boidsP[i]).normalize();
  ret.subVectors(ret.multiplyScalar(velocityLimit), boidsV[i]);
  return ret.multiplyScalar(seekingFactor);
}

function rule5(i: number): THREE.Vector3 {
  // Obstacle Avoidance
  let dist: number;
  for (let j = 0; j < raderArray.length; j++) {
    let dir = raderArray[j].clone().applyQuaternion(boidShapes[i].quaternion);
    const ray = new THREE.Raycaster(boidsP[i], dir, 0, obstacleDetectRange);
    const intresects = ray.intersectObjects([...obstacles, bound]);

    if (intresects.length === 0) {
      if (j === 0) return new THREE.Vector3();
      else {
        return dir.multiplyScalar(obstacleAvoidFactor / (dist! + 0.01));
      }
    } else if (j === 0) dist = intresects[0].distance;
  }
  return new THREE.Vector3();
}

function handle_boundary(i: number) {
  for (let n = 0; n < 3; n++) {
    if (boidsP[i].getComponent(n) < -boundRange) boidsV[i].setComponent(n, 0.01);
    if (boidsP[i].getComponent(n) > boundRange) boidsV[i].setComponent(n, -0.01);
  }
}

function limit_velocity(i: number) {
  let vnorm = boidsV[i].length();
  if (vnorm > velocityLimit) boidsV[i].multiplyScalar(velocityLimit / vnorm);
}

function prevent_collision(i: number, dt: number) {
  const ray = new THREE.Raycaster(boidsP[i], boidsV[i].clone().normalize(), 0, boidsV[i].length() * dt);
  const intresects = ray.intersectObjects([...obstacles, bound]);
  if (intresects.length > 0) {
    const dist = intresects[0].distance;
    boidsV[i].normalize().multiplyScalar((0.9 * dist) / dt);
  }
}

// ===================== GOAL SEEKING =====================

let mouseTracker: THREE.Mesh;

function create_mouse_tracking_ball() {
  const sphereGeo = new THREE.SphereGeometry(1);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: 0xffea00,
  });
  const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
  mouseTracker = sphereMesh;
  scene.add(mouseTracker);

  const mouse = new THREE.Vector2();
  const intersectionPoint = new THREE.Vector3();
  const planeNormal = new THREE.Vector3();
  const plane = new THREE.Plane();
  const raycaster = new THREE.Raycaster();

  window.addEventListener("mousemove", function (e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    planeNormal.copy(camera.position).normalize();
    plane.setFromNormalAndCoplanarPoint(planeNormal, scene.position);
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(plane, intersectionPoint);
    mouseTracker.position.copy(intersectionPoint);
  });
}

// ===================== OBSTACLE & DETECTING =====================

let obstacles: Array<THREE.Mesh> = [];

function create_obstacle(num: number) {
  obstacles = [];
  for (let i = 0; i < num; i++) {
    const radius = 3;
    const height = boundRange * (1 + Math.random());
    const x = (2 * Math.random() - 1) * (boundRange - radius);
    const z = (2 * Math.random() - 1) * (boundRange - radius);
    const obsGeo = new THREE.CylinderGeometry(radius, radius, height, 20);
    const obsMat = new THREE.MeshStandardMaterial({
      color: 0x448844,
    });
    const obsMesh = new THREE.Mesh(obsGeo, obsMat);
    obsMesh.visible = obstacleAvailable;
    obsMesh.position.copy(new THREE.Vector3(x, height / 2 - boundRange, z));
    obsMesh.geometry.computeBoundingBox();

    scene.add(obsMesh);
    obstacles.push(obsMesh);
  }
}

let raderArray: Array<THREE.Vector3> = [];
function generate_rader(numPoints: number, frac: number) {
  let turnFraction = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < numPoints; i++) {
    let t = i / (numPoints - 1);
    let inclination = Math.acos(1 - t * (1 - Math.cos(frac * (Math.PI / 2))));
    let azimuth = 2 * Math.PI * turnFraction * i;

    let x = Math.sin(inclination) * Math.cos(azimuth);
    let z = Math.sin(inclination) * Math.sin(azimuth);
    let y = Math.cos(inclination);
    raderArray.push(new THREE.Vector3(x, y, z));
  }
}

// ===================== INIT =====================

function init_state() {
  boidsP = [];
  boidsV = [];
  for (let i = 0; i < boidsN; i++) {
    let P;
    while (true) {
      P = new THREE.Vector3()
        .random()
        .subScalar(0.5)
        .multiplyScalar(boundRange * 2);
      if (!position_in_obstacles(P)) break;
    }
    let V = new THREE.Vector3().randomDirection().multiplyScalar(velocityLimit / 2);
    boidsP.push(P);
    boidsV.push(V);
  }
  boidsTree.init();
}

function position_in_obstacles(P: THREE.Vector3): boolean {
  for (let obstacle of obstacles) {
    let lP = obstacle.worldToLocal(P.clone());
    if (obstacle.geometry.boundingBox?.containsPoint(lP)) {
      return true;
    }
  }
  return false;
}

// ===================== CONTROL =====================

function initGUI() {
  const controls = {
    toggle_run: () => {
      isPlay = !isPlay;
    },
    toggle_seeking: () => {
      isSeeking = !isSeeking;
    },
    reset: init_state,
  };

  const gui = new dat.GUI();
  gui.add(controls, "toggle_run").name("Pause/Unpause");
  gui.add(controls, "reset").name("Reset");
  gui.add(controls, "toggle_seeking").name("On/Off Goal Seeking");
}

function preventDefault() {
  document.oncontextmenu = () => false;
  document.onselectstart = () => false;
}

// ===================== MAIN =====================

async function main() {
  const boid_num = 150;
  create_obstacle(3);
  create_boids(boid_num);
  create_mouse_tracking_ball();
  initGUI();
  generate_rader(100, 1.5);

  init_state();

  const stats = new Stats();
  document.body.appendChild(stats.dom);
  preventDefault();

  let prevTime = 0;
  renderer.setAnimationLoop(animate);

  function animate(timestamp: number) {
    let timediff = (timestamp - prevTime) / 1000;

    stats.begin();
    update_boids(timediff);
    draw_boids();
    mouseTracker.visible = isSeeking;
    renderer.render(scene, camera);
    stats.end();

    prevTime = timestamp;
  }
}

main();
