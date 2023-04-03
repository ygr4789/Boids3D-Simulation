import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const scene = new THREE.Scene();
const setcolor = "#bbbbbb";
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
// scene.pause = true

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

const boundRange = 70;

const bound_material = new THREE.MeshStandardMaterial();
bound_material.color = new THREE.Color(0x444488);
bound_material.transparent = true;
bound_material.opacity = 0.1;

const edge_material = new THREE.LineBasicMaterial();
edge_material.color = new THREE.Color(0xfffffff);

const bound = new THREE.Mesh(new THREE.BoxGeometry(boundRange * 2, boundRange * 2, boundRange * 2), bound_material);
const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(boundRange * 2, boundRange * 2, boundRange * 2)));

scene.add(bound);
scene.add(edges);

// ===================== CORE =====================

let boidsP: Array<THREE.Vector3> = [];
let boidsV: Array<THREE.Vector3> = [];
let boidsN: number;
let boidsShapes: Array<THREE.Mesh> = [];

let protectedRange = 5;
let avoidFactor = 0.01;
let alignFactor = 0.05;
let cohesionFactor = 0.005;
let pushFactor = 0.05;

let visibilityRange = 10;
let velocityLimit = 0.5;

function create_boids(num: number) {
  boidsN = num;

  for (let i = 0; i < num; i++) {
    let P = new THREE.Vector3().random().subScalar(0.5).multiplyScalar(boundRange * 2);
    let V = new THREE.Vector3().randomDirection().multiplyScalar((Math.random() * velocityLimit) / 2);
    boidsP.push(P);
    boidsV.push(V);

    const geometry = new THREE.CylinderGeometry(0.0, 0.75, 2.25, 4, 1);
    const material = new THREE.MeshPhongMaterial();
    material.color = new THREE.Color(0x993333);
    material.flatShading = true;
    const boidShape = new THREE.Mesh(geometry, material);
    boidsShapes.push(boidShape);
    scene.add(boidShape);
  }
}

function draw_boids() {
  for (let i = 0; i < boidsN; i++) {
    boidsShapes[i].position.copy(boidsP[i]);

    let norm = boidsV[i].length();
    let axis = boidsV[i].clone();
    axis.setY(axis.y + norm);
    axis.normalize();
    boidsShapes[i].setRotationFromAxisAngle(axis, Math.PI);
  }
}

function update_boids() {
  for (let i = 0; i < boidsN; i++) {
    let vel1 = rule1(i);
    let vel2 = rule2(i);
    let vel3 = rule3(i);
    boidsV[i].add(vel1).add(vel2).add(vel3);
    boidsP[i].add(boidsV[i]);
  }
  handle_boundary();
  limit_velocity();
}

function rule1(i: number): THREE.Vector3 {
  let ret = new THREE.Vector3();
  for (let P of boidsP) {
    let D = new THREE.Vector3().subVectors(boidsP[i], P);
    if (D.length() < protectedRange) ret.add(D);
  }
  return ret.multiplyScalar(avoidFactor);
}
function rule2(i: number): THREE.Vector3 {
  let ret = new THREE.Vector3();
  let neighbors = find_neighbors(i);
  if (neighbors.length == 0) return ret;
  for (let j of neighbors) {
    ret.add(new THREE.Vector3().subVectors(boidsV[j], boidsV[i]));
  }
  ret.divideScalar(neighbors.length);
  return ret.multiplyScalar(alignFactor);
}
function rule3(i: number): THREE.Vector3 {
  let ret = new THREE.Vector3();
  let neighbors = find_neighbors(i);
  if (neighbors.length == 0) return ret;
  for (let j of neighbors) {
    ret.add(new THREE.Vector3().subVectors(boidsP[j], boidsP[i]));
  }
  ret.divideScalar(neighbors.length);
  return ret.multiplyScalar(cohesionFactor);
}

function find_neighbors(i: number): Array<number> {
  let ret = [];
  for (let j = 0; j < boidsN; j++) {
    if (i == j) continue;
    if (boidsP[i].distanceTo(boidsP[j]) < visibilityRange) ret.push(j);
  }
  return ret;
}

function handle_boundary() {
  for (let i = 0; i < boidsN; i++) {
    for (let n = 0; n < 3; n++) {
      if (boidsP[i].getComponent(n) < -boundRange) boidsV[i].setComponent(n, boidsV[i].getComponent(n) + pushFactor);
      if (boidsP[i].getComponent(n) > boundRange) boidsV[i].setComponent(n, boidsV[i].getComponent(n) - pushFactor);
    }
  }
}
function limit_velocity() {
  for (let V of boidsV) {
    let vnorm = V.length();
    if (vnorm > velocityLimit) V.multiplyScalar(velocityLimit / vnorm);
  }
}

function animate() {
  update_boids();
  draw_boids();
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

async function main() {
  const boid_num = 1000;
  create_boids(boid_num);
  draw_boids();
  renderer.render(scene, camera);
  animate();
}

main()