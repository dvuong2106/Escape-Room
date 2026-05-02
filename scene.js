import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export let walls = [];
export let currentModel = null;
export let oldModel = null;
export let transitionData = null;

export function isTransitioning() {
    return transitionData !== null;
}

export function updateTransition() {
    if (!transitionData || !currentModel || !oldModel) return;

    transitionData.time += 0.007; // Tốc độ lướt

    let t = transitionData.time;
    if (t >= 1) {
        t = 1;
    }

    // Sử dụng easeInOutCubic để mượt mà
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const dir = transitionData.direction;

    // Mẫu cũ trượt ra ngoài
    oldModel.position.x = -40 * dir * ease;
    oldModel.position.z = 40 * dir * ease;

    // Mẫu mới trượt vào
    currentModel.position.x = 40 * dir * (1 - ease);
    currentModel.position.z = -40 * dir * (1 - ease);

    if (t === 1) {
        if (oldModel.parent) {
            oldModel.parent.remove(oldModel);
        }
        oldModel = null;
        transitionData = null;
    }
}

export const cameraParams = {
    radius: 20, // Tăng radius lên chút để chắc chắn không bị cắt hình
    angleY: Math.PI / 4,
    angleX: Math.atan(1 / Math.sqrt(2)), // Góc nghiêng chuẩn cho Isometric (khoảng 35.264 độ)
    center: new THREE.Vector3(0, 4.5, 0) // Nâng điểm nhìn lên trục Y để đẩy phòng xuống thấp
};

export function updateCamera(camera, params) {
    camera.position.x = params.center.x + params.radius * Math.sin(params.angleY) * Math.cos(params.angleX);
    camera.position.y = params.center.y + params.radius * Math.sin(params.angleX);
    camera.position.z = params.center.z + params.radius * Math.cos(params.angleY) * Math.cos(params.angleX);

    camera.lookAt(params.center);
}

export function setupScene() {
    const scene = new THREE.Scene();
    // Chỉnh màu nền giống với tông màu tối trong ảnh
    scene.background = new THREE.Color(0x2a363b);

    const aspect = window.innerWidth / window.innerHeight;
    const d = 12.5; // Chỉnh d = 11 để phòng nhỏ lại vừa khung hình
    const camera = new THREE.OrthographicCamera(
        -d * aspect, d * aspect, d, -d, 0.1, 1000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Thêm ánh sáng để thấy được Model
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(5, 10, 7.5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    const light2 = new THREE.DirectionalLight(0xffffff, 3);
    light2.position.set(-5, 10, -7.5);
    scene.add(light2);
    scene.add(new THREE.AmbientLight(0x404040));

    // Gọi hàm loadRoom để tải phòng mặc định
    // loadRoom(scene, '/models/main_room.glb'); // Chúng ta sẽ gọi từ main.js

    return { scene, camera, renderer };
}

// --- HỆ THỐNG CACHE PHÒNG ---
// Lưu trữ model và dữ liệu tường của mỗi phòng đã tải.
// Key: roomUrl, Value: { model, wallsData }
const roomCache = new Map();

/**
* Xử lý model lần đầu sau khi tải từ GLB (gộp group, gắn ngăn kéo, mở cửa sẵn...).
* Chỉ chạy 1 lần duy nhất cho mỗi phòng.
*/
function processNewRoom(scene, gltf, roomUrl) {
    const roomModel = gltf.scene;

    // --- MỞ SẴN CỬA KHI VÀO PHÒNG NGỦ ---
    if (roomUrl.includes('bed_room')) {
        roomModel.updateMatrixWorld(true);
        roomModel.traverse((child) => {
            const lowerName = child.name ? child.name.toLowerCase() : '';
            if (lowerName === 'door.001') {
                child.userData.originalBox = new THREE.Box3().setFromObject(child);
                child.rotation.y += Math.PI / 2;
                child.userData.isOpen = true;
            }
        });
    }

    // 0. Gộp các phần của object thành 1 group để tương tác chung
    let c092_1 = null, c092_2 = null;
    let c091_1 = null, c091_2 = null; // Chưa gộp được -> không nhặt được
    let c075_1 = null, c075_2 = null;
    let c090_1 = null, c090_2 = null;
    let c074_1 = null, c074_2 = null;
    let c011_1 = null, c011_2 = null; // add(): lỗi mất c011_1; attach(): nhặt xót c011_2, ảnh items nhỏ
    let c015_1 = null, c015_2 = null;
    let c014_1 = null, c014_2 = null;

    let p013_1 = null, p013_2 = null, p013_3 = null, p013_4 = null,
        p011_1 = null, p011_2 = null, p011_3 = null, p011_4 = null,
        keyboard = null;

    roomModel.traverse((child) => {
        const lowerName = child.name.toLowerCase();
        if (lowerName === 'cube092') c092_1 = child;
        if (lowerName === 'cube092_1' || lowerName === 'cube092 1') c092_2 = child;

        if (lowerName === 'cube091') c091_1 = child;
        if (lowerName === 'cube091_1' || lowerName === 'cube091 1') c091_2 = child;

        if (lowerName === 'cube075') c075_1 = child;
        if (lowerName === 'cube075_1' || lowerName === 'cube075 1') c075_2 = child;

        if (lowerName === 'cube090') c090_1 = child;
        if (lowerName === 'cube090_1' || lowerName === 'cube090 1') c090_2 = child;

        if (lowerName === 'cube074') c074_1 = child;
        if (lowerName === 'cube074_1' || lowerName === 'cube074 1') c074_2 = child;

        if (lowerName === 'cube011_1') c011_1 = child;
        if (lowerName === 'cube011_2' || lowerName === 'cube011 2') c011_2 = child;

        if (lowerName === 'cube015') c015_1 = child;
        if (lowerName === 'cube015_1' || lowerName === 'cube015 1') c015_2 = child;

        if (lowerName === 'cube014') c014_1 = child;
        if (lowerName === 'cube014_1' || lowerName === 'cube014 1') c014_2 = child;

        if (lowerName === 'plane013') p013_1 = child;
        if (lowerName === 'plane013_1' || lowerName === 'plane013 1') p013_2 = child;
        if (lowerName === 'plane013_2' || lowerName === 'plane013 2') p013_3 = child;
        if (lowerName === 'plane013_3' || lowerName === 'plane013 3') p013_4 = child;
        if (lowerName === 'plane011') p011_1 = child;
        if (lowerName === 'plane011_1' || lowerName === 'plane011 1') p011_2 = child;
        if (lowerName === 'plane011_2' || lowerName === 'plane011 2') p011_3 = child;
        if (lowerName === 'plane011_3' || lowerName === 'plane011 3') p011_4 = child;
        if (lowerName === 'keyboard') keyboard = child;
    });

    if (c092_1 && c092_2) {
        const group = new THREE.Group();
        group.name = 'Cube092_Merged';
        if (c092_1.parent) c092_1.parent.add(group);
        else scene.add(group);
        group.add(c092_1);
        group.add(c092_2);
        console.log('Đã gộp', c092_1.name, 'và', c092_2.name, 'thành 1 group:', group.name);
    }

    if (c091_1 && c091_2) {
        const group = new THREE.Group();
        group.name = 'Cube091_Merged';
        if (c091_1.parent) c091_1.parent.add(group);
        else scene.add(group);
        group.add(c091_1);
        group.add(c091_2);
        console.log('Đã gộp', c091_1.name, 'và', c091_2.name, 'thành 1 group:', group.name);
    }

    if (c075_1 && c075_2) {
        const group = new THREE.Group();
        group.name = 'Cube075_Merged';
        if (c075_1.parent) c075_1.parent.add(group);
        else scene.add(group);
        group.add(c075_1);
        group.add(c075_2);
        console.log('Đã gộp', c075_1.name, 'và', c075_2.name, 'thành 1 group:', group.name);
    }

    if (c090_1 && c090_2) {
        const group = new THREE.Group();
        group.name = 'Cube090_Merged';
        if (c090_1.parent) c090_1.parent.add(group);
        else scene.add(group);
        group.add(c090_1);
        group.add(c090_2);
        console.log('Đã gộp', c090_1.name, 'và', c090_2.name, 'thành 1 group:', group.name);
    }

    if (c074_1 && c074_2) {
        const group = new THREE.Group();
        group.name = 'Cube074_Merged';
        if (c074_1.parent) c074_1.parent.add(group);
        else scene.add(group);
        group.add(c074_1);
        group.add(c074_2);
        console.log('Đã gộp', c074_1.name, 'và', c074_2.name, 'thành 1 group:', group.name);
    }

    if (c011_1 && c011_2) {
        const group = new THREE.Group();
        group.name = 'Cube011_Merged';
        if (c011_1.parent) c011_1.parent.add(group);
        else scene.add(group);
        group.add(c011_1);
        group.add(c011_2);
        console.log('Đã gộp', c011_1.name, 'và', c011_2.name, 'thành 1 group:', group.name);
    }

    if (c015_1 && c015_2) {
        const group = new THREE.Group();
        group.name = 'Cube015_Merged';
        if (c015_1.parent) c015_1.parent.add(group);
        else scene.add(group);
        group.add(c015_1);
        group.add(c015_2);
        console.log('Đã gộp', c015_1.name, 'và', c015_2.name, 'thành 1 group:', group.name);
    }

    if (c014_1 && c014_2) {
        const group = new THREE.Group();
        group.name = 'Cube014_Merged';
        if (c014_1.parent) c014_1.parent.add(group);
        else scene.add(group);
        group.add(c014_1);
        group.add(c014_2);
        console.log('Đã gộp', c014_1.name, 'và', c014_2.name, 'thành 1 group:', group.name);
    }

    if (p013_1 && p013_2 && p013_3 && p013_4 && p011_1 && p011_2 && p011_3 && p011_4 && keyboard) {
        const group = new THREE.Group();
        group.name = 'Cube013_Merged';
        if (p013_1.parent) p013_1.parent.add(group);
        else scene.add(group);
        group.add(p013_1);
        group.add(p013_2);
        group.add(p013_3);
        group.add(p013_4);
        group.attach(p011_1);
        group.attach(p011_2);
        group.attach(p011_3);
        group.attach(p011_4);
        group.add(keyboard);
        console.log('Đã gộp', p013_1.name, 'và', p013_2.name, 'và', p013_3.name, 'và', p013_4.name, 'và', p011_1.name, 'và', p011_2.name, 'và', p011_3.name, 'và', p011_4.name, 'và', keyboard.name, 'thành 1 group:', group.name);
    }

    // --- Gắn vật phẩm vào ngăn kéo (cube022) ---
    roomModel.updateMatrixWorld(true);
    let drawer = null;
    roomModel.traverse((child) => {
        if (child.name.toLowerCase() === 'cube022') drawer = child;
    });

    if (drawer) {
        const drawerBox = new THREE.Box3().setFromObject(drawer);
        drawerBox.expandByScalar(0.15);
        // Giữ nguyên mép trên để không bắt nhầm vật phẩm từ ngăn tủ trên
        drawerBox.max.y = new THREE.Box3().setFromObject(drawer).max.y;

        const itemsInside = [];
        roomModel.traverse((child) => {
            if (child.isMesh && child !== drawer) {
                const lowerName = child.name.toLowerCase();
                if (lowerName.includes('wall') || lowerName.includes('floor') || lowerName.includes('room') || lowerName.includes('door') || lowerName.startsWith('f_')) return;

                const box = new THREE.Box3().setFromObject(child);
                const center = box.getCenter(new THREE.Vector3());

                if (drawerBox.containsPoint(center)) {
                    let target = child;
                    if (child.parent && child.parent.name.includes('_Merged')) {
                        target = child.parent;
                    }

                    const targetBox = new THREE.Box3().setFromObject(target);
                    const targetSize = targetBox.getSize(new THREE.Vector3());
                    const drawerSize = drawerBox.getSize(new THREE.Vector3());

                    if (targetSize.lengthSq() < drawerSize.lengthSq() * 0.8) {
                        if (!itemsInside.includes(target)) {
                            itemsInside.push(target);
                        }
                    }
                }
            }
        });

        itemsInside.forEach(item => {
            drawer.attach(item);
            console.log('Đã gắn', item.name, 'vào trong tủ', drawer.name);
        });
    }

    return roomModel;
}

/**
* Tính toán dữ liệu tường (walls) cho một model phòng.
* Trả về mảng wallsData để có thể cache lại.
*/
function buildWallsData(roomModel) {
    const wallsData = [];

    // 1. Tìm và lưu các bức tường
    roomModel.traverse((child) => {
        if (child.name.startsWith('Wall')) {
            const box = new THREE.Box3().setFromObject(child);
            const center = box.getCenter(new THREE.Vector3());
            wallsData.push({
                box: box,
                center: center,
                items: [{
                    mesh: child,
                    originalY: child.position.y,
                    targetY: child.position.y
                }],
                isInitialized: false
            });
        }
    });

    let sofaBoxes = [];

    // Lưu object trong sofa
    roomModel.children.forEach(child => {
        if (child.name.toLowerCase().includes('sofa')) {
            const box = new THREE.Box3().setFromObject(child);
            if (!box.isEmpty()) sofaBoxes.push(box);
        }
    });

    // 2. Tìm các object nằm sát tường (tranh, cửa, kệ, rèm...) và ghép chung vào tường đó
    roomModel.children.forEach((child) => {
        if (child.name.startsWith('Wall') || child.name.toLowerCase().includes('floor') || child.name.startsWith('F_')) return;
        const box = new THREE.Box3().setFromObject(child);
        if (box.isEmpty()) return;

        const center = box.getCenter(new THREE.Vector3());

        // Bỏ qua object trong sofa
        if (sofaBoxes.some(sofaBox => sofaBox.containsPoint(center))) return;

        let closestWall = null;
        let minDistance = Infinity;

        wallsData.forEach(wall => {
            const dist = wall.box.distanceToPoint(center);
            if (dist < minDistance) {
                minDistance = dist;
                closestWall = wall;
            }
        });

        if (closestWall && minDistance < 2.5) {
            closestWall.items.push({
                mesh: child,
                originalY: child.position.y,
                targetY: child.position.y
            });
        }
    });

    return wallsData;
}

/**
* Đưa model đã cache vào scene, thiết lập transition, và khôi phục walls.
*/
function activateRoom(scene, newModel, cachedWallsData, transitionDirection) {
    scene.add(newModel);

    // Khôi phục walls từ cache — reset isInitialized để updateWalls hoạt động đúng
    walls = cachedWallsData.map(wall => ({
        ...wall,
        isInitialized: false
    }));

    // Thiết lập transition animation
    if (currentModel) {
        oldModel = currentModel;
        // Tách oldModel khỏi scene sau transition (không xóa khỏi cache)
        transitionData = {
            time: 0,
            direction: transitionDirection
        };
        newModel.position.x = 40 * transitionDirection;
        newModel.position.z = -40 * transitionDirection;
    } else {
        // Lần đầu tiên load (không có transition)
        newModel.position.set(0, 0, 0);
    }
    currentModel = newModel;
}

export function loadRoom(scene, roomUrl, transitionDirection = 1) {
    // Hủy transition cũ nếu đang chạy
    if (transitionData && oldModel) {
        if (oldModel.parent) oldModel.parent.remove(oldModel);
        if (currentModel) currentModel.position.set(0, 0, 0);
        oldModel = null;
        transitionData = null;
    }

    // --- KIỂM TRA CACHE ---
    if (roomCache.has(roomUrl)) {
        // Phòng đã được tải trước đó → lấy từ cache, giữ nguyên mọi trạng thái
        const cached = roomCache.get(roomUrl);
        console.log('[Cache HIT] Khôi phục phòng từ cache:', roomUrl);
        activateRoom(scene, cached.model, cached.wallsData, transitionDirection);
        return;
    }

    // --- TẢI MỚI TỪ GLB ---
    console.log('[Cache MISS] Đang tải phòng mới:', roomUrl);
    const loader = new GLTFLoader();
    loader.load(
        roomUrl,
        function (gltf) {
            // Xử lý model lần đầu (gộp group, gắn ngăn kéo, mở cửa...)
            const newModel = processNewRoom(scene, gltf, roomUrl);

            // Tính toán dữ liệu tường
            const wallsData = buildWallsData(newModel);

            // Lưu vào cache
            roomCache.set(roomUrl, { model: newModel, wallsData: wallsData });
            console.log('[Cache SET] Đã cache phòng:', roomUrl);

            // Kích hoạt phòng (thêm vào scene + transition)
            activateRoom(scene, newModel, wallsData, transitionDirection);

            console.log('Model loaded successfully! Walls found:', walls.length);
        },
        undefined,
        function (error) {
            console.error('An error happened while loading the model:', error);
        }
    );
}

export function updateWalls(camera) {
    if (walls.length === 0) return;

    // Tính khoảng cách từ mỗi tường đến camera
    walls.forEach(wall => {
        wall.distance = wall.center.distanceToSquared(camera.position);
    });

    // Sắp xếp tường theo khoảng cách (từ gần nhất đến xa nhất)
    const sortedWalls = [...walls].sort((a, b) => a.distance - b.distance);

    // 2 tường gần nhất sẽ được nhấc lên, các tường kia giữ nguyên
    sortedWalls.forEach((wall, index) => {
        const targetOffset = (index < 2) ? 50 : 0; // Tường gần đưa lên cao 50 đơn vị

        wall.items.forEach(item => {
            item.targetY = item.originalY + targetOffset;
            if (!wall.isInitialized) {
                // Đặt vị trí lập tức ở lần đầu tiên để không thấy tường bay lên
                item.mesh.position.y = item.targetY;
            } else {
                // LERP để di chuyển mượt mà
                item.mesh.position.y += (item.targetY - item.mesh.position.y) * 0.1;
            }
        });
        wall.isInitialized = true;
    });
}
