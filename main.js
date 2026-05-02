import * as THREE from 'three';
import { setupScene, cameraParams, updateWalls, loadRoom, updateTransition, isTransitioning } from './scene.js';
import { initControls, setControlsEnabled } from './control.js';

const { scene, camera, renderer } = setupScene();

let currentRoom = 'main_room';

// ====== LOGIC MÀN HÌNH BẮT ĐẦU ======
function startGame() {
    loadRoom(scene, '/models/main_room.glb');
    initControls(camera, cameraParams);
}

// Vị trí nút "Bắt đầu" trong ảnh gốc (tính theo tỉ lệ 0–1)
const BTN_LEFT = 0.370; // % từ trái
const BTN_TOP = 0.770; // % từ trên
const BTN_WIDTH = 0.285; // % chiều rộng ảnh
const BTN_HEIGHT = 0.105; // % chiều cao ảnh

const startScreen = document.getElementById('start-screen');
const startBgImg = document.getElementById('start-bg-img');
const startClickZone = document.getElementById('start-click-zone');

function positionClickZone() {
    if (!startBgImg || !startClickZone) return;
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const iw = startBgImg.naturalWidth || 1920;
    const ih = startBgImg.naturalHeight || 1080;

    // Tính scale & offset khi object-fit: contain
    const scale = Math.min(sw / iw, sh / ih);
    const rw = iw * scale;  // chiều rộng ảnh sau render
    const rh = ih * scale;  // chiều cao ảnh sau render
    const offX = (sw - rw) / 2;
    const offY = (sh - rh) / 2;

    startClickZone.style.left = (offX + BTN_LEFT * rw) + 'px';
    startClickZone.style.top = (offY + BTN_TOP * rh) + 'px';
    startClickZone.style.width = (BTN_WIDTH * rw) + 'px';
    startClickZone.style.height = (BTN_HEIGHT * rh) + 'px';
}

if (startScreen && startBgImg && startClickZone) {
    // Định vị sau khi ảnh load (có naturalWidth/Height)
    startBgImg.addEventListener('load', positionClickZone);
    window.addEventListener('resize', positionClickZone);
    // Nếu ảnh đã cache và load rồi
    if (startBgImg.complete && startBgImg.naturalWidth) positionClickZone();

    startClickZone.addEventListener('click', () => {
        startScreen.style.opacity = '0';
        startScreen.style.pointerEvents = 'none';
        startGame();
        setTimeout(() => {
            if (startScreen.parentNode) startScreen.parentNode.removeChild(startScreen);
        }, 1300);
    });
} else {
    // Fallback nếu không có start screen
    startGame();
}



// --- BẢNG PHÂN LOẠI VẬT PHẨM (gom các object 3D cùng loại) ---
// Các object có cùng itemType sẽ xếp chồng trong 1 ô inventory
const ITEM_TYPE_MAP = {
    'Cube014_Merged': 'book1',
    'Cube015_Merged': 'book1',
    'Cube074_Merged': 'book1',
    'Cube075_Merged': 'book1',
    'Cube011_Merged': 'book2',
    'Cube090_Merged': 'book2',
    'Cube091_Merged': 'book2',
    'Cube092_Merged': 'book2',
};

function getItemType(objectName) {
    return ITEM_TYPE_MAP[objectName] || objectName;
}

// Kiểm tra xem object hoặc tổ tiên của nó có phải là kệ sách không
function isBookshelf(obj) {
    while (obj) {
        const name = obj.name ? obj.name.toLowerCase() : '';
        if (name.includes('shelf002') || name.includes('shelf003')) return true;
        obj = obj.parent;
    }
    return false;
}

// Kiểm tra xếp sách giải đố
function checkShelfPuzzleAndOpenDoors() {
    const expectedShelfPattern = {
        0: [],
        1: ['book1'],
        2: ['book2', 'book1'],
        3: ['book2', 'book2'],
        4: [],
        5: ['book1', 'book2', 'book1']
    };

    let isSolved = true;
    for (let r = 0; r < 6; r++) {
        const expected = expectedShelfPattern[r];
        for (let i = 0; i < 9; i++) {
            const c = 11 - i;
            const bookObj = bookshelfGrid[r][c];
            const expectedType = i < expected.length ? expected[i] : null;

            if (expectedType === null) {
                if (bookObj !== null) {
                    isSolved = false; break;
                }
            } else {
                if (bookObj === null) {
                    isSolved = false; break;
                }
                const actualType = getItemType(bookObj.userData.originalItemName);
                if (actualType !== expectedType) {
                    isSolved = false; break;
                }
            }
        }
        if (!isSolved) break;
    }

    if (isSolved) {
        showObjectName("Các quyển sách đã được sắp xếp chính xác! Cửa tủ đang mở...");

        // Xóa laptop khỏi túi đồ
        const laptopSlotImg = document.querySelector('.slot img[data-item-name*="" i], .slot img[data-item-name*="Cube013" i]');
        if (laptopSlotImg) {
            const laptopSlot = laptopSlotImg.parentElement;
            laptopSlot.removeChild(laptopSlotImg);
            laptopSlot.title = '';
            laptopSlot.classList.remove('selected');
        }

        scene.traverse(child => {
            if (!child.name) return;
            const nameLowerCase = child.name.toLowerCase();
            const nameNorm = nameLowerCase.replace(/[_ \.]/g, ''); // Xóa khoảng trắng, dấu chấm, gạch dưới

            // Tìm door right 002 và door left 002
            if (nameNorm.includes('door') && nameNorm.includes('right') && nameNorm.includes('002')) {
                // Gắn tay nắm vào cửa trước khi mở (tương tự như door001)
                if (!child.userData.hasAttachedHandles) {
                    child.userData.hasAttachedHandles = true;
                    const doorBox = new THREE.Box3().setFromObject(child);
                    doorBox.expandByScalar(0.3);
                    scene.traverse((c) => {
                        if (c.isMesh && c.name.toLowerCase().includes('mesh') && c !== child) {
                            if (doorBox.containsPoint(new THREE.Box3().setFromObject(c).getCenter(new THREE.Vector3()))) {
                                child.attach(c);
                            }
                        }
                    });
                }
                if (!child.userData.isOpen) toggleDoor(child, 1);

            } else if (nameNorm.includes('door') && nameNorm.includes('left') && nameNorm.includes('002')) {
                if (!child.userData.hasAttachedHandles) {
                    child.userData.hasAttachedHandles = true;
                    const doorBox = new THREE.Box3().setFromObject(child);
                    doorBox.expandByScalar(0.3);
                    scene.traverse((c) => {
                        if (c.isMesh && c.name.toLowerCase().includes('mesh') && c !== child) {
                            if (doorBox.containsPoint(new THREE.Box3().setFromObject(c).getCenter(new THREE.Vector3()))) {
                                child.attach(c);
                            }
                        }
                    });
                }
                if (!child.userData.isOpen) toggleDoor(child, -1);
            }
        });
    }
}

// --- TƯƠNG TÁC ĐỒ VẬT (RAYCASTING) ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hideTimeout;
let sewingSofaRotated = false; // Đánh dấu đã xoay sewing sofa chưa (chỉ xoay 1 lần)

// Cache bản sao 3D của vật phẩm đã nhặt để xem lại bất kỳ lúc nào (không phụ thuộc phòng hiện tại)
const pickedItemCache = new Map();

window.addEventListener('mouseup', (event) => {
    // Bỏ qua click nếu người dùng đang bấm vào khung túi đồ
    if (event.target.closest('#inventory-container')) return;

    // Bỏ qua click nếu đang mở laptop UI
    const laptopUI = document.getElementById('laptop-ui');
    if (laptopUI && laptopUI.style.display !== 'none') return;

    // Bỏ qua click nếu đang xem giấy
    const paperOverlay = document.getElementById('paper-overlay');
    if (paperOverlay && paperOverlay.style.display !== 'none') return;

    if (isTransitioning()) return;

    // Chuyển đổi tọa độ chuột sang NDC (-1 đến +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Cập nhật tia ray
    raycaster.setFromCamera(mouse, camera);

    // Tìm các điểm giao cắt
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (isViewingTV) {
        if (intersects.length > 0 && intersects[0].object === tvKeypadPlane) {
            // Xử lý click keypad
            const uv = intersects[0].uv;
            // uv.y đi từ dưới lên trên, tuỳ vào cách tạo plane (thường 0 ở dưới, 1 ở trên)
            // CanvasTexture mặc định flipY = false, toạ độ 0,0 là góc trên cùng bên trái canvas.
            const w = tvKeypadCanvas.width;
            const h = tvKeypadCanvas.height;
            const cx = uv.x * w;
            const cy = (1 - uv.y) * h;

            const btnW = 360;
            const btnH = 240;
            const gapX = 80;
            const gapY = 60;
            const startX = (w - (2 * btnW + gapX)) / 2;
            const startY = 440;

            const keys = [
                ['1', '2'],
                ['3', '4'],
                ['5', '6'],
                ['7', '8'],
                ['9', '0'],
                ['<-', '->']
            ];

            let clickedKey = null;
            for (let row = 0; row < keys.length; row++) {
                for (let col = 0; col < keys[row].length; col++) {
                    const btnX = startX + col * (btnW + gapX);
                    const btnY = startY + row * (btnH + gapY);
                    if (cx >= btnX && cx <= btnX + btnW && cy >= btnY && cy <= btnY + btnH) {
                        clickedKey = keys[row][col];
                        break;
                    }
                }
                if (clickedKey) break;
            }

            if (clickedKey) {
                if (clickedKey === '<-') {
                    currentTVInput = currentTVInput.slice(0, -1);
                } else if (clickedKey === '->') {
                    console.log("Submit TV code: " + currentTVInput);
                    if (currentTVInput === '14823') {
                        showObjectName("Đúng mật khẩu TV!");
                        // Remap UV của cube084_2 để ảnh fill đúng khít màn hình
                        if (tvScreenMesh) {
                            const geo = tvScreenMesh.geometry;
                            geo.computeBoundingBox();
                            const bbox = geo.boundingBox;
                            const size = bbox.getSize(new THREE.Vector3());
                            const posAttr = geo.attributes.position;
                            const uvAttr = geo.attributes.uv;

                            // Xác định 2 trục tạo thành mặt phẳng màn hình
                            // (trục có range nhỏ nhất là pháp tuyến, bỏ qua)
                            let uAxis, vAxis, uMin, uRange, vMin, vRange;
                            if (size.x <= size.y && size.x <= size.z) {
                                uAxis = 'z'; vAxis = 'y';
                                uMin = bbox.min.z; uRange = size.z;
                                vMin = bbox.min.y; vRange = size.y;
                            } else if (size.y <= size.x && size.y <= size.z) {
                                uAxis = 'x'; vAxis = 'z';
                                uMin = bbox.min.x; uRange = size.x;
                                vMin = bbox.min.z; vRange = size.z;
                            } else {
                                uAxis = 'x'; vAxis = 'y';
                                uMin = bbox.min.x; uRange = size.x;
                                vMin = bbox.min.y; vRange = size.y;
                            }

                            // Ghi đè UV để phủ [0,1]×[0,1] đều trên toàn bộ mặt màn hình
                            for (let i = 0; i < posAttr.count; i++) {
                                const uVal = (posAttr[uAxis === 'x' ? 'getX' : uAxis === 'y' ? 'getY' : 'getZ'](i) - uMin) / uRange;
                                const vVal = (posAttr[vAxis === 'x' ? 'getX' : vAxis === 'y' ? 'getY' : 'getZ'](i) - vMin) / vRange;
                                uvAttr.setXY(i, uVal, vVal);
                            }
                            uvAttr.needsUpdate = true;

                            tvPassTexture.flipY = true;
                            tvScreenMesh.material.map = tvPassTexture;
                            tvScreenMesh.material.needsUpdate = true;
                        }
                        // Ẩn bảng nhập mật khẩu vĩnh viễn
                        tvUnlocked = true;
                        if (tvKeypadPlane) tvKeypadPlane.visible = false;
                        // Xóa paper khỏi túi đồ
                        const paperSlotImg = document.querySelector('.slot img[data-item-name*="paper" i], .slot img[data-item-name*="Paper" i]');
                        if (paperSlotImg) {
                            const paperSlot = paperSlotImg.parentElement;
                            paperSlot.removeChild(paperSlotImg);
                            paperSlot.title = '';
                            paperSlot.classList.remove('selected');
                        }
                    } else {
                        showObjectName("Mã TV sai!");
                    }
                    currentTVInput = "";
                } else {
                    if (currentTVInput.length < 5) currentTVInput += clickedKey;
                }
                drawTVKeypad(currentTVInput);
            }
            return;
        } else {
            // Thoát chế độ TV
            isViewingTV = false;
            setControlsEnabled(true);
            camera.position.copy(tvOriginalCameraPosition);
            camera.rotation.copy(tvOriginalCameraRotation);
            if (tvKeypadPlane) tvKeypadPlane.visible = false;
            // Khôi phục zoom về mặc định
            const aspect = window.innerWidth / window.innerHeight;
            const d = 12.5;
            camera.left = -d * aspect;
            camera.right = d * aspect;
            camera.top = d;
            camera.bottom = -d;
            camera.updateProjectionMatrix();
            return;
        }
    }

    if (isViewingCabinet) {
        let actionDone = false;

        if (intersects.length > 0) {
            let hoveredObject = intersects[0].object;
            if (hoveredObject.parent && hoveredObject.parent.name.includes('_Merged')) {
                hoveredObject = hoveredObject.parent;
            }
            const nameLowerCase = hoveredObject.name ? hoveredObject.name.toLowerCase() : '';

            const isCabinetArea = nameLowerCase.includes('cube022') || nameLowerCase.includes('cabinet') || nameLowerCase.includes('tray') || nameLowerCase.includes('key001') || nameLowerCase.includes('paper') || nameLowerCase.includes('cube091');

            if (isCabinetArea) {
                actionDone = true; // Giữ view nếu click trong khu vực tủ

                if (nameLowerCase.includes('key001') || nameLowerCase.includes('paper') || nameLowerCase.includes('cube091')) {
                    if (hoveredObject.visible !== false) {
                        if (!pickedItemCache.has(hoveredObject.name)) {
                            pickedItemCache.set(hoveredObject.name, hoveredObject.clone());
                        }
                        addToInventory(hoveredObject);
                        hoveredObject.visible = false;
                        showObjectName("Đã nhặt đồ vật!");
                    }
                } else if (nameLowerCase.includes('cube022')) {
                    toggleDrawer(hoveredObject, 'z', 0.6);
                }
            }
        }

        if (actionDone) {
            return;
        }

        // Thoát chế độ xem tủ
        isViewingCabinet = false;
        setControlsEnabled(true);
        camera.position.copy(cabinetOriginalCameraPosition);
        camera.rotation.copy(cabinetOriginalCameraRotation);
        const aspect = window.innerWidth / window.innerHeight;
        const d = 12.5;
        camera.left = -d * aspect;
        camera.right = d * aspect;
        camera.top = d;
        camera.bottom = -d;
        camera.updateProjectionMatrix();
        return;
    }

    if (isViewingKitchen) {
        let actionDone = false;

        if (intersects.length > 0) {
            let hoveredObject = intersects[0].object;
            if (hoveredObject.parent && hoveredObject.parent.name.includes('_Merged')) {
                hoveredObject = hoveredObject.parent;
            }
            const nameLowerCase = hoveredObject.name ? hoveredObject.name.toLowerCase() : '';

            const isKitchenArea = nameLowerCase.includes('cooking_stove') || (nameLowerCase.includes('top') && !nameLowerCase.includes('laptop')) || nameLowerCase.includes('cutting_board') || nameLowerCase.includes('sink_franke_booleanbox') || nameLowerCase.includes('knife');

            if (isKitchenArea) {
                actionDone = true; // Giữ view nếu click trong khu bếp

                if (nameLowerCase.includes('knife')) {
                    if (hoveredObject.visible !== false) {
                        if (!pickedItemCache.has(hoveredObject.name)) {
                            pickedItemCache.set(hoveredObject.name, hoveredObject.clone());
                        }
                        addToInventory(hoveredObject);
                        hoveredObject.visible = false;
                        showObjectName("Đã nhặt đồ vật!");
                    }
                }
            } else if (nameLowerCase.includes('cube090')) {
                // Nhặt cube090_merged
                if (hoveredObject.visible !== false) {
                    if (!pickedItemCache.has(hoveredObject.name)) {
                        pickedItemCache.set(hoveredObject.name, hoveredObject.clone());
                    }
                    addToInventory(hoveredObject);
                    hoveredObject.visible = false;
                    showObjectName("Đã nhặt đồ vật!");
                    actionDone = true; // Giữ nguyên chế độ xem sau khi nhặt
                }
            }
        }

        if (actionDone) {
            return;
        }

        // Thoát chế độ xem bếp
        isViewingKitchen = false;
        setControlsEnabled(true);
        camera.position.copy(kitchenOriginalCameraPosition);
        camera.rotation.copy(kitchenOriginalCameraRotation);
        const aspect = window.innerWidth / window.innerHeight;
        const d = 12.5;
        camera.left = -d * aspect;
        camera.right = d * aspect;
        camera.top = d;
        camera.bottom = -d;
        camera.updateProjectionMatrix();
        return;
    }

    if (isViewingSewingSofa) {
        let actionDone = false;

        if (intersects.length > 0) {
            let hoveredObject = intersects[0].object;
            if (hoveredObject.parent && hoveredObject.parent.name.includes('_Merged')) {
                hoveredObject = hoveredObject.parent;
            }
            const nameLowerCase = hoveredObject.name ? hoveredObject.name.toLowerCase() : '';

            // Nếu click trúng sofa
            if (nameLowerCase.includes('sewing sofa') || nameLowerCase.includes('sewing_sofa') || nameLowerCase.includes('sewingsofa')) {
                actionDone = true; // Luôn giữ chế độ xem nếu click trúng sô pha

                if (sewingSofaRotated) {
                    showObjectName("Đã cắt rồi!");
                } else {
                    const selectedSlotImg = document.querySelector('.slot.selected img');
                    if (selectedSlotImg && selectedSlotImg.dataset.itemName.toLowerCase().includes('knife')) {
                        if (hoveredObject.userData.originalRotation === undefined) {
                            hoveredObject.userData.originalRotation = hoveredObject.rotation.clone();
                        }

                        hoveredObject.userData.targetRotation = hoveredObject.userData.originalRotation.clone();
                        hoveredObject.userData.targetRotation.y += Math.PI;

                        if (!animatingDoors.includes(hoveredObject)) {
                            animatingDoors.push(hoveredObject);
                        }

                        sewingSofaRotated = true;
                        showObjectName("Đã cắt sofa!");

                        const slot = selectedSlotImg.parentElement;
                        slot.removeChild(selectedSlotImg);
                        slot.title = '';
                        slot.classList.remove('selected');
                    } else {
                        showObjectName("Cần dao để cắt!");
                    }
                }
            } else if (nameLowerCase.includes('cube074')) {
                // Nhặt cube074_merged
                if (hoveredObject.visible !== false) {
                    if (!pickedItemCache.has(hoveredObject.name)) {
                        pickedItemCache.set(hoveredObject.name, hoveredObject.clone());
                    }
                    addToInventory(hoveredObject);
                    hoveredObject.visible = false;
                    showObjectName("Đã nhặt đồ vật!");
                    actionDone = true; // Giữ nguyên chế độ xem sau khi nhặt
                }
            }
        }

        if (actionDone) {
            return;
        }

        // Thoát chế độ xem sofa
        isViewingSewingSofa = false;
        setControlsEnabled(true);
        camera.position.copy(sofaOriginalCameraPosition);
        camera.rotation.copy(sofaOriginalCameraRotation);
        const aspect = window.innerWidth / window.innerHeight;
        const d = 12.5;
        camera.left = -d * aspect;
        camera.right = d * aspect;
        camera.top = d;
        camera.bottom = -d;
        camera.updateProjectionMatrix();
        return;
    }

    if (isViewingShelf) {
        let actionDone = false;
        let shelfHitPoint = null;
        let targetShelfName = "";

        // 1. NHẬN DIỆN CLICK (TRÚNG MESH HOẶC TRÚNG VÙNG TRỐNG TRONG KỆ)
        if (intersects.length > 0) {
            let clickedObject = intersects[0].object;
            // Tìm lên các object cha để lấy Group sách nếu click trúng mesh con
            let obj = clickedObject;
            while (obj) {
                if (obj.userData.isPlaced) {
                    clickedObject = obj;
                    break;
                }
                obj = obj.parent;
            }
            if (clickedObject.userData.isPlaced) {
                clickedObject = obj;
            }

            // Kiểm tra nhặt chìa khóa key002
            let keyObj = null;
            for (let i = 0; i < intersects.length; i++) {
                let currObj = intersects[i].object;
                while (currObj) {
                    if (currObj.name && (currObj.name.toLowerCase().includes('key002') || currObj.name.toLowerCase().includes('key.002'))) {
                        keyObj = currObj;
                        break;
                    }
                    currObj = currObj.parent;
                }
                if (keyObj) break;
            }
            
            if (keyObj && keyObj.visible !== false) {
                if (!pickedItemCache.has(keyObj.name)) {
                    pickedItemCache.set(keyObj.name, keyObj.clone());
                }
                addToInventory(keyObj);
                keyObj.visible = false;
                showObjectName("Đã nhặt chìa khóa!");
                return; // Giữ nguyên chế độ xem kệ sách
            }
            if (clickedObject.userData.isPlaced) {
                // Clear from grid
                for (let r = 0; r < 6; r++) {
                    for (let c = 0; c < 12; c++) {
                        if (bookshelfGrid[r][c] === clickedObject) {
                            bookshelfGrid[r][c] = null;
                            break;
                        }
                    }
                }
                const originalName = clickedObject.userData.originalItemName;
                if (pickedItemCache.has(originalName)) {
                    addToInventory(pickedItemCache.get(originalName));
                }
                if (clickedObject.parent) {
                    clickedObject.parent.remove(clickedObject);
                }
                showObjectName("Đã nhặt đồ vật!");
                checkShelfPuzzleAndOpenDoors(); // Kiểm tra giải đố sau khi nhặt sách
                return;
            }

            if (isBookshelf(clickedObject)) {
                actionDone = true;
                shelfHitPoint = intersects[0].point;
                // Tìm tên kệ
                let shelfObj = clickedObject;
                while (shelfObj && !shelfObj.name.toLowerCase().includes('shelf')) shelfObj = shelfObj.parent;
                targetShelfName = shelfObj ? shelfObj.name.toLowerCase() : "";
            }
        }

        // Nếu hụt mesh, kiểm tra xem có hụt vào "khoảng không" giữa các ngăn kệ không
        if (!shelfHitPoint) {
            const hitPoint2 = new THREE.Vector3();
            const hitPoint3 = new THREE.Vector3();
            const hit2 = raycaster.ray.intersectBox(shelf002Box, hitPoint2);
            const hit3 = raycaster.ray.intersectBox(shelf003Box, hitPoint3);

            if (hit2) {
                actionDone = true;
                shelfHitPoint = hitPoint2;
                targetShelfName = "shelf002";
            } else if (hit3) {
                actionDone = true;
                shelfHitPoint = hitPoint3;
                targetShelfName = "shelf003";
            }
        }

        // 2. XỬ LÝ XẾP SÁCH NẾU ĐÃ XÁC ĐỊNH ĐƯỢC VÙNG CLICK
        if (shelfHitPoint && targetShelfName) {
            let targetShelfObj = null;
            scene.traverse(child => {
                if (child.name && child.name.toLowerCase().replace(/[_ \.]/g, '') === targetShelfName.replace(/[_ \.]/g, '')) {
                    targetShelfObj = child;
                }
            });
            const selectedSlotImg = document.querySelector('.slot.selected img');
            if (selectedSlotImg) {
                const itemName = selectedSlotImg.dataset.itemName;
                const itemType = getItemType(itemName);

                if (ITEM_TYPE_MAP[itemName]) {
                    // TÌM HÀNG DỰA TRÊN TỌA ĐỘ Y
                    let targetRows = targetShelfName.includes('shelf002') ? [0, 1, 2] : [3, 4, 5];
                    let closestRowId = -1;
                    let minHeightDist = Infinity;

                    targetRows.forEach(rowId => {
                        const config = window.shelfFramesConfig[rowId];
                        const distY = Math.abs(shelfHitPoint.y - config.y);
                        if (distY < minHeightDist) {
                            minHeightDist = distY;
                            closestRowId = rowId;
                        }
                    });

                    const config = window.shelfFramesConfig[closestRowId];

                    // TÌM Ô TRỐNG TRONG HÀNG
                    // Xếp từ phải sang trái (quyển 1 sát mặt phải, các quyển sau kề bên trái)
                    // Offset 3 ô đầu (0,1,2) để tránh đè lên sách có sẵn trong model GLB
                    let availableCol = -1;
                    for (let c = 11; c >= 3; c--) {
                        if (bookshelfGrid[closestRowId][c] === null) {
                            availableCol = c;
                            break;
                        }
                    }

                    if (availableCol !== -1) {
                        const slotWidth = config.w / 12;
                        const bookSpacing = slotWidth * 0.45; // Giảm khoảng cách giữa các sách
                        const fillDir = config.fillDir || 1;

                        let bookPos = new THREE.Vector3(config.x, config.y, config.z);
                        bookPos.y -= config.h / 2;
                        bookPos.y += 0.5; // Nhích lên một chút để không lún vào gỗ

                        const bookIndexFromRight = 11 - availableCol;

                        if (config.isXAxis) {
                            const rightEdge = config.x + (fillDir * config.w / 2);
                            bookPos.x = rightEdge - fillDir * (slotWidth / 2 + bookIndexFromRight * bookSpacing);
                        } else {
                            const backEdge = config.z + (fillDir * config.d / 2);
                            bookPos.z = backEdge - fillDir * (slotWidth / 2 + bookIndexFromRight * bookSpacing);
                        }

                        if (pickedItemCache.has(itemName)) {
                            const newBook = pickedItemCache.get(itemName).clone();
                            newBook.position.copy(bookPos);

                            // CHỈNH LẠI KÍCH THƯỚC (Scale lên để khớp với kệ)
                            newBook.scale.set(2.2, 2.2, 2.2);

                            // XOAY DỰNG ĐỨNG CHUẨN (Rotate X 90 deg và Z 90 deg để khớp spine)
                            newBook.rotation.set(Math.PI / 2, config.isXAxis ? 0 : Math.PI / 2, Math.PI / 2);

                            newBook.userData.isPlaced = true;
                            newBook.userData.originalItemName = itemName;
                            newBook.visible = true;

                            scene.add(newBook); // Thêm vào scene để cập nhật matrix thế giới
                            if (targetShelfObj) {
                                targetShelfObj.attach(newBook); // Gắn làm con của kệ sách, tự động tính toán lại local position
                            }

                            bookshelfGrid[closestRowId][availableCol] = newBook;
                            showObjectName("Đã xếp sách vào vị trí!");
                            checkShelfPuzzleAndOpenDoors(); // Kiểm tra giải đố sau khi đặt sách

                            // Cập nhật Inventory
                            const slot = selectedSlotImg.parentElement;
                            let qty = parseInt(slot.dataset.qty || '1', 10);
                            if (qty > 1) {
                                qty--;
                                slot.dataset.qty = qty;
                                slot.querySelector('.qty-badge').textContent = qty;
                            } else {
                                slot.removeChild(selectedSlotImg);
                                const badge = slot.querySelector('.qty-badge');
                                if (badge) slot.removeChild(badge);
                                slot.title = '';
                                slot.classList.remove('selected');
                            }
                        }
                    } else {
                        showObjectName("Ngăn này đã đầy sách!");
                    }
                }
            }
        }

        if (actionDone) return;

        // Thoát chế độ xem kệ sách
        isViewingShelf = false;
        if (shelfHighlightGroup.parent) scene.remove(shelfHighlightGroup); // Khung xếp sách
        setControlsEnabled(true);
        camera.position.copy(shelfOriginalCameraPosition);
        camera.rotation.copy(shelfOriginalCameraRotation);
        const aspect = window.innerWidth / window.innerHeight;
        const d = 12.5;
        camera.left = -d * aspect;
        camera.right = d * aspect;
        camera.top = d;
        camera.bottom = -d;
        camera.updateProjectionMatrix();
        return;
    }

    // --- KIỂM TRA CHUYỂN PHÒNG VỚI DOOR004 VÀ PLANCE001 ---
    let door004Clicked = false;
    let plance001TransitionClicked = false;
    scene.traverse((child) => {
        const lowerName = child.name ? child.name.toLowerCase() : '';
        if (lowerName.includes('door004') || lowerName.includes('door.004')) {
            const box = new THREE.Box3().setFromObject(child);
            const boxIntersection = raycaster.ray.intersectBox(box, new THREE.Vector3());
            if (boxIntersection) {
                const distanceToBox = raycaster.ray.origin.distanceTo(boxIntersection);
                // Nếu không bị cản bởi object nào, hoặc Box của cửa nằm gần hơn/cùng khoảng cách với object bị click
                if (intersects.length === 0 || distanceToBox <= intersects[0].distance + 0.5) {
                    door004Clicked = true;
                }
            }
        }

        if (lowerName.includes('plance001') || lowerName.includes('plane001') || lowerName === 'door.001') {
            if (child.userData.isOpen && child.userData.originalBox) {
                const boxIntersection = raycaster.ray.intersectBox(child.userData.originalBox, new THREE.Vector3());
                if (boxIntersection) {
                    const distanceToBox = raycaster.ray.origin.distanceTo(boxIntersection);
                    if (intersects.length === 0 || distanceToBox <= intersects[0].distance + 0.5) {
                        plance001TransitionClicked = true;
                    }
                }
            }
        }
    });

    if (door004Clicked) {
        if (currentRoom === 'main_room') {
            loadRoom(scene, '/models/kitchen.glb', 1);
            currentRoom = 'kitchen';
            showObjectName("Phòng ăn");
        } else if (currentRoom === 'kitchen') {
            loadRoom(scene, '/models/main_room.glb', -1);
            currentRoom = 'main_room';
            showObjectName("Phòng khách");
        }
        return;
    }

    if (plance001TransitionClicked) {
        if (currentRoom === 'main_room') {
            loadRoom(scene, '/models/bed_room.glb', 1);
            currentRoom = 'bed_room';
            showObjectName("Phòng ngủ");
        } else if (currentRoom === 'bed_room') {
            loadRoom(scene, '/models/main_room.glb', -1);
            currentRoom = 'main_room';
            showObjectName("Phòng khách");
        }
        return;
    }

    if (intersects.length > 0) {
        let clickedObject = intersects[0].object;

        // Nếu object là một phần của Group đã gộp, ta lấy Group đó làm đối tượng chính
        if (clickedObject.parent && clickedObject.parent.name.includes('_Merged')) {
            clickedObject = clickedObject.parent;
        }

        // Bỏ qua tường và sàn nhà, chỉ quan tâm đồ vật
        const nameLowerCase = clickedObject.name.toLowerCase();
        if (nameLowerCase.includes('wall') || nameLowerCase.includes('floor') || nameLowerCase.includes('room')) {
            return;
        }

        // --- XỬ LÝ NHẶT VẬT PHẨM ---
        // Khi bấm vào đồ vật có thể nhặt và nó chưa bị ẩn
        if ((clickedObject.name === 'Cube011_Merged' || clickedObject.name === 'Cube074_Merged' || clickedObject.name === 'Cube091_Merged' || clickedObject.name === 'Cube014_Merged' || clickedObject.name === 'Cube015_Merged' || clickedObject.name === 'Cube092_Merged' || clickedObject.name === 'Cube075_Merged' || clickedObject.name === 'Cube090_Merged'
            || nameLowerCase.includes('paper') || clickedObject.name === 'Cube013_Merged'
            || nameLowerCase.includes('sumtag_tv_remote_control')) && clickedObject.visible !== false) {

            if (clickedObject.userData.isPlaced) {
                // Chỉ cho phép nhặt lại sách khi đang ở chế độ zoom vào kệ sách
                return;
            }

            // 0. Cache bản sao 3D để xem lại sau (trước khi ẩn)
            if (!pickedItemCache.has(clickedObject.name)) {
                pickedItemCache.set(clickedObject.name, clickedObject.clone());
            }
            // 1. Thêm vào túi đồ bằng cách chụp ảnh vật thể
            addToInventory(clickedObject);
            // 2. Làm biến mất khỏi phòng 3D
            clickedObject.visible = false;
            // 3. Hiện thông báo
            showObjectName("Đã nhặt đồ vật!");
            return;
        }

        // --- XỬ LÝ MỞ KHÓA VÀ CHUYỂN PHÒNG VỚI PLANCE001 ---
        if (nameLowerCase.includes('plance001') || nameLowerCase.includes('plane001')) {
            // Phòng ngủ: cửa luôn mở tự do, không cần chìa khóa
            if (currentRoom === 'bed_room') {
                loadRoom(scene, '/models/main_room.glb', -1);
                currentRoom = 'main_room';
                showObjectName("Phòng khách");
                return;
            }

            // Phòng khách: cửa đã mở rồi thì click để sang phòng ngủ
            if (clickedObject.userData.isOpen) {
                loadRoom(scene, '/models/bed_room.glb', 1);
                currentRoom = 'bed_room';
                showObjectName("Phòng ngủ");
                return;
            }

            // Phòng khách: cửa chưa mở, cần chìa khóa để mở khóa
            const selectedSlotImg = document.querySelector('.slot.selected img');
            const selectedItemName = selectedSlotImg ? selectedSlotImg.dataset.itemName.toLowerCase() : '';

            if (selectedSlotImg && (selectedItemName.includes('key001') || selectedItemName.includes('key002'))) {
                // Gắn các tay nắm cửa (các cylinder) nằm sát cửa vào cửa để xoay cùng
                const doorBox = new THREE.Box3().setFromObject(clickedObject);
                doorBox.expandByScalar(0.5); // Mở rộng bounding box ra một chút

                scene.traverse((child) => {
                    if (child.isMesh && child.name.toLowerCase().includes('cylinder') && child !== clickedObject) {

                        const childBox = new THREE.Box3().setFromObject(child);
                        const center = childBox.getCenter(new THREE.Vector3());

                        // Nếu tay nắm cửa nằm trong không gian của cửa
                        if (doorBox.containsPoint(center)) {
                            clickedObject.attach(child);
                            console.log('Đã gắn', child.name, 'vào', clickedObject.name);
                        }
                    }
                });

                toggleDoor(clickedObject, 1);

                const slot = selectedSlotImg.parentElement;
                slot.removeChild(selectedSlotImg);
                slot.title = '';
                slot.classList.remove('selected');

                if (selectedItemName.includes('key002')) {
                    // key002: mở cửa rồi kết thúc game bằng video end.mp4
                    showObjectName("Đã mở khóa!");
                    setTimeout(() => {
                        // Bước 1: Fade màn hình về đen
                        let blackOverlay = document.getElementById('black-fade-overlay');
                        if (!blackOverlay) {
                            blackOverlay = document.createElement('div');
                            blackOverlay.id = 'black-fade-overlay';
                            blackOverlay.style.cssText = `
                                position: fixed;
                                top: 0; left: 0;
                                width: 100vw; height: 100vh;
                                background: #000;
                                z-index: 99999;
                                opacity: 0;
                                transition: opacity 1.5s ease;
                                pointer-events: none;
                            `;
                            document.body.appendChild(blackOverlay);
                        }

                        // Trigger fade to black
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                blackOverlay.style.opacity = '1';
                            });
                        });

                        // Bước 2: Khi màn đen hoàn tất → thêm video bên dưới, rồi fade-out lớp đen
                        setTimeout(() => {
                            let endOverlay = document.getElementById('end-game-overlay');
                            if (!endOverlay) {
                                endOverlay = document.createElement('div');
                                endOverlay.id = 'end-game-overlay';
                                endOverlay.style.cssText = `
                                    position: fixed;
                                    top: 0; left: 0;
                                    width: 100vw; height: 100vh;
                                    background: #000;
                                    z-index: 99998;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    opacity: 1;
                                `;

                                const video = document.createElement('video');
                                video.src = '/end.mp4';
                                video.style.cssText = `
                                    width: 100%;
                                    height: 100%;
                                    object-fit: contain;
                                    display: block;
                                `;
                                video.autoplay = true;
                                video.controls = false;
                                video.playsInline = true;

                                endOverlay.appendChild(video);
                                // Chèn video overlay vào trước blackOverlay để nó nằm bên dưới
                                document.body.insertBefore(endOverlay, blackOverlay);

                                video.play().catch(err => console.error('Video play error:', err));

                                // Khi video kết thúc: hiện màn hình "Đã thoát ra ngoài" + nút Chơi lại
                                video.addEventListener('ended', () => {
                                    // Tạo overlay kết quả
                                    const resultOverlay = document.createElement('div');
                                    resultOverlay.style.cssText = `
                                        position: fixed;
                                        top: 0; left: 0;
                                        width: 100vw; height: 100vh;
                                        background: rgba(0, 0, 0, 0.82);
                                        z-index: 100000;
                                        display: flex;
                                        flex-direction: column;
                                        align-items: center;
                                        justify-content: center;
                                        gap: 40px;
                                        opacity: 0;
                                        transition: opacity 1s ease;
                                        font-family: 'Inter', sans-serif;
                                    `;

                                    // Text kết quả
                                    const resultText = document.createElement('div');
                                    resultText.textContent = 'Đã thoát ra ngoài!';
                                    resultText.style.cssText = `
                                        font-size: clamp(36px, 6vw, 80px);
                                        font-weight: 700;
                                        color: #fff;
                                        letter-spacing: 4px;
                                        text-align: center;
                                    `;

                                    // Nút chơi lại
                                    const replayBtn = document.createElement('button');
                                    replayBtn.textContent = '↺  Chơi lại';
                                    replayBtn.style.cssText = `
                                        padding: 18px 64px;
                                        font-size: 20px;
                                        font-weight: 700;
                                        font-family: 'Inter', sans-serif;
                                        letter-spacing: 3px;
                                        color: #fff;
                                        background: rgba(255, 255, 255, 0.12);
                                        border: 2px solid rgba(255, 255, 255, 0.55);
                                        border-radius: 50px;
                                        cursor: pointer;
                                        backdrop-filter: blur(12px);
                                        -webkit-backdrop-filter: blur(12px);
                                        box-shadow: 0 0 40px rgba(255,255,255,0.15), inset 0 1px 0 rgba(255,255,255,0.2);
                                        transition: all 0.3s ease;
                                        outline: none;
                                    `;
                                    replayBtn.addEventListener('mouseover', () => {
                                        replayBtn.style.background = 'rgba(255,255,255,0.24)';
                                        replayBtn.style.borderColor = '#fff';
                                        replayBtn.style.transform = 'scale(1.07)';
                                        replayBtn.style.boxShadow = '0 0 60px rgba(255,255,255,0.3), inset 0 1px 0 rgba(255,255,255,0.3)';
                                    });
                                    replayBtn.addEventListener('mouseout', () => {
                                        replayBtn.style.background = 'rgba(255,255,255,0.12)';
                                        replayBtn.style.borderColor = 'rgba(255,255,255,0.55)';
                                        replayBtn.style.transform = 'scale(1)';
                                        replayBtn.style.boxShadow = '0 0 40px rgba(255,255,255,0.15), inset 0 1px 0 rgba(255,255,255,0.2)';
                                    });
                                    replayBtn.addEventListener('click', () => {
                                        window.location.reload();
                                    });

                                    resultOverlay.appendChild(resultText);
                                    resultOverlay.appendChild(replayBtn);
                                    document.body.appendChild(resultOverlay);

                                    // Fade in màn hình kết quả
                                    requestAnimationFrame(() => {
                                        requestAnimationFrame(() => {
                                            resultOverlay.style.opacity = '1';
                                        });
                                    });
                                });

                                // Fade-out lớp đen để lộ video (màn hình sáng dần từ đen ra video)
                                requestAnimationFrame(() => {
                                    requestAnimationFrame(() => {
                                        blackOverlay.style.transition = 'opacity 1s ease';
                                        blackOverlay.style.opacity = '0';
                                        // Xóa lớp đen sau khi fade-out xong
                                        setTimeout(() => {
                                            if (blackOverlay.parentNode) blackOverlay.parentNode.removeChild(blackOverlay);
                                        }, 1100);
                                    });
                                });
                            }
                        }, 1500); // Đợi fade-to-black xong (1.5s transition)
                    }, 500); // Đợi cửa mở xong rồi mới bắt đầu fade
                } else {
                    showObjectName("Đã mở khóa!");
                }
            } else {
                showObjectName("Cửa khóa, cần chìa khóa!");
            }
            return;
        }

        // --- XỬ LÝ MỞ CỬA DOOR RIGHT001 ---
        if (nameLowerCase.includes('door right001') || nameLowerCase.includes('door_right001') || nameLowerCase.includes('door right.001')) {
            toggleDoor(clickedObject, 1); // Góc xoay dương
            return;
        }

        // --- XỬ LÝ MỞ CỬA DOOR LEFT001 ---
        if (nameLowerCase.includes('door left001') || nameLowerCase.includes('door_left001') || nameLowerCase.includes('door left.001')) {
            // Cánh bên trái thường xoay ngược chiều so với cánh bên phải để cùng mở ra ngoài
            toggleDoor(clickedObject, -1);
            return;
        }

        // --- XỬ LÝ MỞ CÁNH TỦ QUẦN ÁO ---
        // Tên gốc có thể chứa dấu _ hoặc space, nên chuẩn hóa để so sánh
        const nameNormalized = nameLowerCase.replace(/[_ ]/g, '');
        if (nameNormalized === 'mesh1' || nameNormalized === 'mesh0011') {
            // Gắn tay nắm tủ (cylinder) vào cánh cửa lần đầu tiên để chúng xoay cùng
            if (clickedObject.userData.isOpen === undefined) {
                const doorBox = new THREE.Box3().setFromObject(clickedObject);
                doorBox.expandByScalar(0.3);

                scene.traverse((child) => {
                    if (child.isMesh && child.name.toLowerCase().includes('mesh') && child !== clickedObject) {

                        const childCenter = new THREE.Box3().setFromObject(child).getCenter(new THREE.Vector3());
                        if (doorBox.containsPoint(childCenter)) {
                            clickedObject.attach(child);
                            console.log('Đã gắn tay nắm', child.name, 'vào cánh tủ', clickedObject.name);
                        }
                    }
                });
            }

            const direction = nameNormalized === 'mesh1' ? -1 : 1;
            console.log(direction === -1 ? 'Mở cánh trái tủ:' : 'Mở cánh phải tủ:', clickedObject.name);
            toggleDoor(clickedObject, direction);
            return;
        }

        // --- XỬ LÝ CLICK TỦ (CABINET) ---
        const isCabinetClick = nameLowerCase.includes('cube022') || nameLowerCase.includes('cabinet') || nameLowerCase.includes('tray') || nameLowerCase.includes('key001');
        if (isCabinetClick) {
            isViewingCabinet = true;
            cabinetOriginalCameraPosition.copy(camera.position);
            cabinetOriginalCameraRotation.copy(camera.rotation);

            let centerObject = clickedObject;
            scene.traverse((child) => {
                if (child.name && child.name.toLowerCase().includes('cube022')) {
                    centerObject = child;
                }
            });

            const cabinetBox = new THREE.Box3().setFromObject(centerObject);
            const cabinetCenter = cabinetBox.getCenter(new THREE.Vector3());
            const cabinetSize = cabinetBox.getSize(new THREE.Vector3());

            // Tính hướng trực diện (cố định luôn nhìn từ một hướng)
            // Nếu bị nhìn vào hông hoặc mặt sau tủ, bạn có thể đổi thành (0, 0, -1), (-1, 0, 0) hoặc (0, 0, 1)
            let normal = new THREE.Vector3(0, 0, 1);

            const distance = Math.max(cabinetSize.x, cabinetSize.y, cabinetSize.z) * 1.5 + 3;

            cabinetTargetCameraPosition.copy(cabinetCenter).add(normal.multiplyScalar(distance));
            cabinetTargetCenter.copy(cabinetCenter);

            // Nâng góc nhìn lên một chút nhìn xuống ngăn kéo
            cabinetTargetCameraPosition.y += 6;
            cabinetTargetCameraPosition.x += -1;

            setControlsEnabled(false);
            showObjectName("Đang xem tủ!");

            const zoomAspect = window.innerWidth / window.innerHeight;
            const dZoom = 3.5; // Mở rộng góc nhìn để bao quát tủ
            camera.left = -dZoom * zoomAspect;
            camera.right = dZoom * zoomAspect;
            camera.top = dZoom;
            camera.bottom = -dZoom;
            camera.updateProjectionMatrix();
            return;
        }

        // Vô hiệu hóa hoàn toàn tương tác trực tiếp với door002
        if (nameLowerCase.includes('door002') || nameLowerCase.includes('door.002')) {
            return;
        }

        // --- XỬ LÝ CLICK KHU BẾP ---
        const isKitchenClick = nameLowerCase.includes('cooking_stove') || (nameLowerCase.includes('top') && !nameLowerCase.includes('laptop')) || nameLowerCase.includes('cutting_board') || nameLowerCase.includes('sink_franke_booleanbox') || nameLowerCase.includes('knife');
        if (isKitchenClick) {
            isViewingKitchen = true;
            kitchenOriginalCameraPosition.copy(camera.position);
            kitchenOriginalCameraRotation.copy(camera.rotation);

            let centerObject = clickedObject;
            scene.traverse((child) => {
                if (child.name && child.name.toLowerCase().includes('knife') && child.visible !== false) {
                    centerObject = child;
                }
            });

            const kitchenBox = new THREE.Box3().setFromObject(centerObject);
            const kitchenCenter = kitchenBox.getCenter(new THREE.Vector3());
            const kitchenSize = kitchenBox.getSize(new THREE.Vector3());

            // Tính hướng trực diện (cố định luôn nhìn từ một hướng)
            let normal = new THREE.Vector3(0.5, 0, 1);

            const distance = Math.max(kitchenSize.x, kitchenSize.y, kitchenSize.z) * 1.5 + 4.8;

            kitchenTargetCameraPosition.copy(kitchenCenter).add(normal.multiplyScalar(distance));
            kitchenTargetCenter.copy(kitchenCenter);

            // Nâng góc nhìn lên một chút nhìn xuống dao
            kitchenTargetCameraPosition.y += 5;
            kitchenTargetCameraPosition.x += 1;

            setControlsEnabled(false);
            showObjectName("Đang xem khu bếp!");

            const zoomAspect = window.innerWidth / window.innerHeight;
            const dZoom = 5.0; // Tăng giá trị để nhìn bao quát hơn (zoom out)
            camera.left = -dZoom * zoomAspect;
            camera.right = dZoom * zoomAspect;
            camera.top = dZoom;
            camera.bottom = -dZoom;
            camera.updateProjectionMatrix();
            return;
        }

        // --- XỬ LÝ CLICK SEWING SOFA ---
        if (nameLowerCase.includes('sewing sofa') || nameLowerCase.includes('sewing_sofa') || nameLowerCase.includes('sewingsofa')) {
            isViewingSewingSofa = true;
            sofaOriginalCameraPosition.copy(camera.position);
            sofaOriginalCameraRotation.copy(camera.rotation);

            // Tính trung tâm sofa
            const sofaBox = new THREE.Box3().setFromObject(clickedObject);
            const sofaCenter = sofaBox.getCenter(new THREE.Vector3());
            const sofaSize = sofaBox.getSize(new THREE.Vector3());

            // Tính hướng trực diện (cố định luôn nhìn từ một hướng như trong ảnh)
            // Hướng (0, 0, 1) thường là nhìn từ trước ra tường sau (phía cửa sổ). 
            // Nếu bị ngược, bạn có thể đổi thành (0, 0, -1), (1, 0, 0) hoặc (-1, 0, 0)
            let normal = new THREE.Vector3(1, 0, 0);

            const distance = Math.max(sofaSize.x, sofaSize.y, sofaSize.z) * 1.5;

            sofaTargetCameraPosition.copy(sofaCenter).add(normal.multiplyScalar(distance));
            sofaTargetCenter.copy(sofaCenter);

            // Nâng góc nhìn lên một chút
            sofaTargetCameraPosition.y += sofaSize.y * 0.3;

            setControlsEnabled(false);
            showObjectName("Đang xem ghế sô pha!");

            const zoomAspect = window.innerWidth / window.innerHeight;
            const dZoom = 4.0;
            camera.left = -dZoom * zoomAspect;
            camera.right = dZoom * zoomAspect;
            camera.top = dZoom;
            camera.bottom = -dZoom;
            camera.updateProjectionMatrix();
            return;
        }

        // --- XỬ LÝ DÙNG ĐIỀU KHIỂN BẬT TV ---
        if (nameLowerCase.includes('cube084_2') || nameLowerCase.includes('cube084.002')) {
            const selectedSlotImg = document.querySelector('.slot.selected img');
            if (selectedSlotImg && selectedSlotImg.dataset.itemName.toLowerCase().includes('sumtag_tv_remote_control')) {
                if (!isViewingTV) {
                    isViewingTV = true;
                    // Lưu lại vị trí/góc quay cũ
                    tvOriginalCameraPosition.copy(camera.position);
                    tvOriginalCameraRotation.copy(camera.rotation);

                    // Tính trung tâm màn hình TV
                    const tvBox = new THREE.Box3().setFromObject(clickedObject);
                    const tvCenter = tvBox.getCenter(new THREE.Vector3());
                    const tvSize = tvBox.getSize(new THREE.Vector3());

                    // Áp dụng texture hiển thị
                    if (!tvScreenMesh) {
                        tvScreenMesh = clickedObject;
                        tvScreenMesh.material = new THREE.MeshBasicMaterial({
                            map: tvDisplayTexture,
                            color: 0xffffff
                        });
                    }

                    // Tính hướng trực diện (mặt phẳng tivi) dựa trên kích thước nhỏ nhất (độ dày)
                    let normal = new THREE.Vector3();
                    if (tvSize.x < tvSize.y && tvSize.x < tvSize.z) {
                        normal.set(Math.sign(camera.position.x - tvCenter.x), 0, 0);
                    } else if (tvSize.z < tvSize.x && tvSize.z < tvSize.y) {
                        normal.set(0, 0, Math.sign(camera.position.z - tvCenter.z));
                    } else {
                        normal.set(0, Math.sign(camera.position.y - tvCenter.y), 0);
                    }

                    // Tính hướng dịch chuyển camera: ta giả định đặt camera ra phía trước TV 1 khoảng bằng 1.5 lần max size
                    const distance = Math.max(tvSize.x, tvSize.y, tvSize.z) * 1.3 + 1;

                    // Tính đích đến của camera
                    tvTargetCameraPosition.copy(tvCenter).add(normal.multiplyScalar(distance));
                    tvTargetCenter.copy(tvCenter);

                    setControlsEnabled(false);

                    // Tạo bảng điều khiển số (keypad)
                    if (!tvKeypadPlane) {
                        // Tỷ lệ canvas 512x1200 → width:height = 1 : 2
                        const planeGeo = new THREE.PlaneGeometry(1, 2);
                        const planeMat = new THREE.MeshBasicMaterial({ map: tvKeypadTexture, side: THREE.DoubleSide });
                        tvKeypadPlane = new THREE.Mesh(planeGeo, planeMat);

                        // Dịch keypad sang trái TV xa hơn để không che màn hình
                        const crossVec = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
                        const keypadPos = tvCenter.clone().add(crossVec.multiplyScalar(-tvSize.x / 2 - 3)).add(normal.clone().multiplyScalar(distance * 0.1));

                        tvKeypadPlane.position.copy(keypadPos);
                        tvKeypadPlane.lookAt(tvTargetCameraPosition);
                        if (!tvUnlocked) scene.add(tvKeypadPlane); // Chỉ thêm vào scene khi chưa unlock
                        else tvKeypadPlane.visible = false;
                    } else {
                        // TV không di chuyển → giữ nguyên vị trí keypad, chỉ show/hide
                        if (!tvUnlocked) tvKeypadPlane.visible = true;
                    }

                    showObjectName("Đang xem TV!");

                    // Zoom in: thu hẹp frustum của OrthographicCamera (giữ nguyên vị trí camera)
                    const zoomAspect = window.innerWidth / window.innerHeight;
                    const dZoom = 2.8; // Nhỏ hơn 12.5 → phóng to tầm nhìn
                    camera.left = -dZoom * zoomAspect;
                    camera.right = dZoom * zoomAspect;
                    camera.top = dZoom;
                    camera.bottom = -dZoom;
                    camera.updateProjectionMatrix();
                }
                return;
            } else {
                showObjectName("Cần điều khiển để bật TV!");
                return;
            }
        }

        // --- XỬ LÝ XEM KỆ SÁCH (SHELF) ---
        const clickNormalizedName = nameLowerCase.replace(/[_ \.]/g, '');
        if (clickNormalizedName.includes('shelf002') || clickNormalizedName.includes('shelf003')) {
            if (!isViewingShelf) {
                isViewingShelf = true;
                shelfOriginalCameraPosition.copy(camera.position);
                shelfOriginalCameraRotation.copy(camera.rotation);

                // Tính trung tâm kệ sách (gộp cả shelf002 và shelf003)
                const combinedShelfBox = new THREE.Box3();
                let foundAnyShelf = false;

                shelf002Box.makeEmpty();
                shelf003Box.makeEmpty();

                scene.traverse((child) => {
                    if (child.isMesh && child.name) {
                        const childNameNorm = child.name.toLowerCase().replace(/[_ \.]/g, '');
                        if (childNameNorm.includes('door')) return; // Bỏ qua cửa để không làm sai bounding box

                        // Để chính xác, chỉ expand theo geometry của chính mesh này,
                        // tránh gọi expandByObject vì nó duyệt luôn cả các children (có thể chứa door)
                        if (childNameNorm.includes('shelf002') || childNameNorm.includes('shelf003')) {
                            child.geometry.computeBoundingBox();
                            const meshBox = child.geometry.boundingBox.clone();
                            meshBox.applyMatrix4(child.matrixWorld);

                            if (childNameNorm.includes('shelf002')) {
                                shelf002Box.expandByPoint(meshBox.min);
                                shelf002Box.expandByPoint(meshBox.max);
                                combinedShelfBox.expandByPoint(meshBox.min);
                                combinedShelfBox.expandByPoint(meshBox.max);
                            }
                            if (childNameNorm.includes('shelf003')) {
                                shelf003Box.expandByPoint(meshBox.min);
                                shelf003Box.expandByPoint(meshBox.max);
                                combinedShelfBox.expandByPoint(meshBox.min);
                                combinedShelfBox.expandByPoint(meshBox.max);
                            }
                            foundAnyShelf = true;
                        }
                    }
                });

                if (!foundAnyShelf) {
                    combinedShelfBox.setFromObject(clickedObject);
                }

                const shelfCenter = combinedShelfBox.getCenter(new THREE.Vector3());
                const shelfSize = combinedShelfBox.getSize(new THREE.Vector3());

                // Tính hướng trực diện (mặt phẳng kệ sách)
                let normal = new THREE.Vector3();
                if (shelfSize.x < shelfSize.y && shelfSize.x < shelfSize.z) {
                    normal.set(Math.sign(camera.position.x - shelfCenter.x), 0, 0);
                } else if (shelfSize.z < shelfSize.x && shelfSize.z < shelfSize.y) {
                    normal.set(0, 0, Math.sign(camera.position.z - shelfCenter.z));
                } else {
                    normal.set(0, Math.sign(camera.position.y - shelfCenter.y), 0);
                }
                currentShelfNormal.copy(normal);

                // TẠO CẤU HÌNH KHUNG THEO TỌA ĐỘ (CHỈ TẠO 1 LẦN)
                // Bạn có thể xóa mảng này và thay bằng dữ liệu tĩnh nếu muốn hoàn toàn loại bỏ mọi tính toán
                if (!window.shelfFramesConfig) {
                    const c2 = shelf002Box.getCenter(new THREE.Vector3());
                    const c3 = shelf003Box.getCenter(new THREE.Vector3());
                    const size2 = shelf002Box.getSize(new THREE.Vector3());

                    const isXAxis = size2.x > size2.z;
                    const w = isXAxis ? size2.x * 0.85 : size2.z * 0.85;
                    const d = isXAxis ? size2.z * 0.8 : size2.x * 0.8;
                    const h = size2.y * 0.2;

                    const startY = shelf002Box.min.y + size2.y * 0.44;
                    const shelfAreaHeight = size2.y * 0.52;

                    const isFacingPlusZ = camera.position.z > c2.z;
                    const isFacingPlusX = camera.position.x > c2.x;
                    // Xác định hướng xếp sách: Ta muốn xếp từ trái qua phải theo góc nhìn camera
                    // Với kệ trục X, nhìn từ +Z: Trái là -X, Phải là +X -> fillDir = 1
                    // Nếu nhìn từ -Z: Trái là +X, Phải là -X -> fillDir = -1
                    const fillDir = isXAxis ? (isFacingPlusZ ? 1 : -1) : (isFacingPlusX ? -1 : 1);

                    window.shelfFramesConfig = [];
                    // 3 hàng kệ trái
                    for (let r = 0; r < 3; r++) {
                        window.shelfFramesConfig.push({
                            id: r,
                            x: c2.x, y: startY + shelfAreaHeight * (r / 3) + h / 2, z: c2.z,
                            w: isXAxis ? w : d, h: h, d: isXAxis ? d : w,
                            isXAxis: isXAxis, fillDir: fillDir
                        });
                    }
                    // 3 hàng kệ phải
                    for (let r = 0; r < 3; r++) {
                        window.shelfFramesConfig.push({
                            id: r + 3,
                            x: c3.x, y: startY + shelfAreaHeight * (r / 3) + h / 2, z: c3.z,
                            w: isXAxis ? w : d, h: h, d: isXAxis ? d : w,
                            isXAxis: isXAxis, fillDir: fillDir
                        });
                    }
                }

                // --- Bỏ hiển thị khung, chỉ giữ lại logic tọa độ ---
                shelfHighlightGroup.clear();
                // scene.add(shelfHighlightGroup); // Đã xóa hiển thị khung theo yêu cầu 

                /*// --- Vẽ Khung Khu Vực Tương Tác Bằng Position ---
                shelfHighlightGroup.clear(); // Xóa khung cũ nếu có
                const highlightMaterial = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 });

                window.shelfFramesConfig.forEach(config => {
                    const geometry = new THREE.BoxGeometry(config.w, config.h, config.d);
                    const edges = new THREE.EdgesGeometry(geometry);
                    const line = new THREE.LineSegments(edges, highlightMaterial);
                    
                    // Vô hiệu hóa raycast cho khung, để click xuyên qua và chạm vào sách
                    line.raycast = function() {};

                    // Di chuyển khung hoàn toàn bằng position
                    line.position.set(config.x, config.y, config.z);

                    shelfHighlightGroup.add(line);
                });
                scene.add(shelfHighlightGroup); // Khung xếp sách // cmt đến đây */

                const distance = Math.max(shelfSize.x, shelfSize.y, shelfSize.z) * 1.5;

                shelfTargetCameraPosition.copy(shelfCenter).add(normal.multiplyScalar(distance));
                shelfTargetCenter.copy(shelfCenter);

                // Nâng góc nhìn lên cao hơn
                shelfTargetCameraPosition.y += shelfSize.y * 0.65;
                shelfTargetCenter.y += shelfSize.y * 0.2; // Vẫn nhìn vào phần giữa-trên của kệ sách

                const shiftX = 0.8; // Di chuyển camera sang trái 
                shelfTargetCameraPosition.x -= shiftX;
                shelfTargetCenter.x -= shiftX;

                const shiftY = 0.6; // Di chuyển camera lên trên
                shelfTargetCameraPosition.y -= shiftY;
                shelfTargetCenter.y -= shiftY;

                setControlsEnabled(false);
                showObjectName("Đang xem kệ sách!");

                const zoomAspect = window.innerWidth / window.innerHeight;
                const dZoom = 3.4; // Phóng to vừa phải
                camera.left = -dZoom * zoomAspect;
                camera.right = dZoom * zoomAspect;
                camera.top = dZoom;
                camera.bottom = -dZoom;
                camera.updateProjectionMatrix();
            }
            return;
        }

        showObjectName(clickedObject.name);
    }
});

window.addEventListener('mousemove', (event) => {
    // Bỏ qua nếu đang trỏ vào khung túi đồ
    if (event.target.closest('#inventory-container')) {
        document.body.style.cursor = 'default';
        return;
    }

    // Bỏ qua nếu đang mở laptop UI
    const laptopUI = document.getElementById('laptop-ui');
    if (laptopUI && laptopUI.style.display !== 'none') {
        document.body.style.cursor = 'default';
        return;
    }

    // Bỏ qua nếu đang xem giấy
    const paperOverlay = document.getElementById('paper-overlay');
    if (paperOverlay && paperOverlay.style.display !== 'none') {
        document.body.style.cursor = 'default';
        return;
    }

    if (isTransitioning()) {
        document.body.style.cursor = 'default';
        return;
    }

    // Chuyển đổi tọa độ chuột sang NDC (-1 đến +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Cập nhật tia ray
    raycaster.setFromCamera(mouse, camera);

    // Tìm các điểm giao cắt
    const intersects = raycaster.intersectObjects(scene.children, true);

    // --- KIỂM TRA CHUYỂN PHÒNG VỚI DOOR004 VÀ PLANCE001 ---
    let door004Hovered = false;
    let plance001TransitionHovered = false;
    scene.traverse((child) => {
        const lowerName = child.name ? child.name.toLowerCase() : '';
        if (lowerName.includes('door004') || lowerName.includes('door.004')) {
            const box = new THREE.Box3().setFromObject(child);
            const boxIntersection = raycaster.ray.intersectBox(box, new THREE.Vector3());
            if (boxIntersection) {
                const distanceToBox = raycaster.ray.origin.distanceTo(boxIntersection);
                if (intersects.length === 0 || distanceToBox <= intersects[0].distance + 0.5) {
                    door004Hovered = true;
                }
            }
        }

        if (lowerName.includes('plance001') || lowerName.includes('plane001') || lowerName === 'door.001') {
            if (child.userData.isOpen && child.userData.originalBox) {
                const boxIntersection = raycaster.ray.intersectBox(child.userData.originalBox, new THREE.Vector3());
                if (boxIntersection) {
                    const distanceToBox = raycaster.ray.origin.distanceTo(boxIntersection);
                    if (intersects.length === 0 || distanceToBox <= intersects[0].distance + 0.5) {
                        plance001TransitionHovered = true;
                    }
                }
            }
        }
    });

    if (door004Hovered || plance001TransitionHovered) {
        document.body.style.cursor = 'pointer';
        return;
    }

    if (intersects.length > 0) {
        let hoveredObject = intersects[0].object;

        // Nếu object là một phần của Group đã gộp, ta lấy Group đó làm đối tượng chính
        if (hoveredObject.parent && hoveredObject.parent.name.includes('_Merged')) {
            hoveredObject = hoveredObject.parent;
        }

        const nameLowerCase = hoveredObject.name.toLowerCase();

        // Bỏ qua tường, sàn, phòng và door002
        if (nameLowerCase.includes('wall') || nameLowerCase.includes('floor') || nameLowerCase.includes('room') || nameLowerCase.includes('door002') || nameLowerCase.includes('door.002')) {
            document.body.style.cursor = 'default';
            return;
        }

        // Kiểm tra các đồ vật có thể tương tác
        const isPickable = (hoveredObject.name === 'Cube011_Merged' || hoveredObject.name === 'Cube013_Merged' || hoveredObject.name === 'Cube074_Merged' || hoveredObject.name === 'Cube091_Merged' || hoveredObject.name === 'Cube014_Merged' || hoveredObject.name === 'Cube015_Merged' || hoveredObject.name === 'Cube092_Merged' || hoveredObject.name === 'Cube075_Merged' || hoveredObject.name === 'Cube090_Merged'
            || nameLowerCase.includes('key001') || nameLowerCase.includes('key002')
            || nameLowerCase.includes('paper') || nameLowerCase.includes('knife')
            || nameLowerCase.includes('sumtag_tv_remote_control'));
        const isDoorRight = (nameLowerCase.includes('door right001') || nameLowerCase.includes('door_right001') || nameLowerCase.includes('door right.001'));
        const isDoorLeft = (nameLowerCase.includes('door left001') || nameLowerCase.includes('door_left001') || nameLowerCase.includes('door left.001'));
        const isDrawer = nameLowerCase.includes('cube022');
        const isLockedDoor = nameLowerCase.includes('plance001') || nameLowerCase.includes('plane001');
        const hoverNormalized = nameLowerCase.replace(/[_ ]/g, '');
        const isCabinetDoor = (hoverNormalized === 'mesh1' || hoverNormalized === 'mesh0011');
        const isSewingSofa = (nameLowerCase.includes('sewing sofa') || nameLowerCase.includes('sewing_sofa') || nameLowerCase.includes('sewingsofa'));
        const hoverNormalizedName = nameLowerCase.replace(/[_ \.]/g, '');
        const isShelf = (hoverNormalizedName.includes('shelf002') || hoverNormalizedName.includes('shelf003'));
        const isTV = (nameLowerCase.includes('cube084_2') || nameLowerCase.includes('cube084.002'));
        let canInteractWithTV = false;
        if (isTV) {
            const selectedSlotImg = document.querySelector('.slot.selected img');
            if (selectedSlotImg && selectedSlotImg.dataset.itemName.toLowerCase().includes('sumtag_tv_remote_control')) {
                canInteractWithTV = true;
            }
        }

        if ((isPickable || isDoorRight || isDoorLeft || isDrawer || isLockedDoor || isCabinetDoor || isSewingSofa || isShelf || canInteractWithTV) && hoveredObject.visible !== false) {
            document.body.style.cursor = 'pointer';
            return;
        }
    }

    // Nếu không trúng vật thể nào tương tác được
    document.body.style.cursor = 'default';
});

function hasItemInInventory(namePart) {
    const items = document.querySelectorAll('.slot img');
    for (let img of items) {
        if (img.dataset.itemName && img.dataset.itemName.toLowerCase().includes(namePart.toLowerCase())) {
            return true;
        }
    }
    return false;
}

const animatingDoors = [];
const animatingDrawers = [];

function toggleDrawer(drawer, axis = 'z', distance = 0.6) {
    if (drawer.userData.isOpen === undefined) {
        drawer.userData.originalPosition = drawer.position.clone();
        drawer.userData.isOpen = false;
        // Tạo Bounding Box của ngăn kéo hiện tại
        const drawerBox = new THREE.Box3().setFromObject(drawer);
        drawerBox.expandByScalar(0.1); // Mở rộng nhẹ để đảm bảo bao trọn vật phẩm bên trong

        scene.traverse((child) => {
            // Nếu là vật phẩm mục tiêu, ta kiểm tra xem nó có nằm trong ngăn kéo này không
            if (child.name === 'Cube091_Merged') {
                const childCenter = new THREE.Vector3();
                new THREE.Box3().setFromObject(child).getCenter(childCenter);

                // Chỉ attach nếu tâm của vật phẩm thực sự nằm bên trong hộp của ngăn kéo
                if (drawerBox.containsPoint(childCenter)) {
                    drawer.attach(child);
                }
            }
        });
    }

    drawer.userData.isOpen = !drawer.userData.isOpen;

    if (drawer.userData.isOpen) {
        drawer.userData.targetPosition = drawer.userData.originalPosition.clone();
        drawer.userData.targetPosition[axis] += distance;
        showObjectName("Đã mở tủ!");
    } else {
        drawer.userData.targetPosition = drawer.userData.originalPosition.clone();
        showObjectName("Đã đóng tủ!");
    }

    if (!animatingDrawers.includes(drawer)) {
        animatingDrawers.push(drawer);
    }
}

function toggleDoor(door, direction = 1) {
    if (door.userData.isOpen === undefined) {
        door.userData.originalRotation = door.rotation.clone();
        door.userData.isOpen = false;
        door.userData.originalBox = new THREE.Box3().setFromObject(door); // Lưu lại không gian ban đầu của cửa
    }

    door.userData.isOpen = !door.userData.isOpen;

    if (door.userData.isOpen) {
        door.userData.targetRotation = door.userData.originalRotation.clone();
        // Xoay 90 độ (PI/2). Hướng xoay phụ thuộc vào tham số direction (1 hoặc -1)
        door.userData.targetRotation.y += (Math.PI / 2) * direction;
        showObjectName("Đã mở cửa!");
    } else {
        door.userData.targetRotation = door.userData.originalRotation.clone();
        showObjectName("Đã đóng cửa!");
    }

    if (!animatingDoors.includes(door)) {
        animatingDoors.push(door);
    }
}

let thumbRenderer;

// Hàm chụp ảnh 3D vật thể để làm icon
function generateThumbnail(object) {
    if (!thumbRenderer) {
        // Khởi tạo renderer phụ với nền trong suốt
        thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        thumbRenderer.setSize(256, 256);
    }

    const thumbScene = new THREE.Scene();

    // Ánh sáng cho studio chụp ảnh
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    thumbScene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(10, 10, 10);
    thumbScene.add(dirLight);

    // Bản sao của vật thể
    const clone = object.clone();
    clone.visible = true; // Chắc chắn nó hiển thị

    // Đưa vật thể về gốc tọa độ (0,0,0)
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Trừ đi vị trí tâm để dời object về giữa
    clone.position.sub(center);

    // Xoay nhẹ theo phong cách Isometric để dễ nhìn
    clone.rotation.x = Math.PI / 6;
    clone.rotation.y = -Math.PI / 4;

    thumbScene.add(clone);

    // Tính toán kích thước Camera bao trọn vật thể
    const maxDim = Math.max(size.x, size.y, size.z);
    const effectiveMax = maxDim > 0 ? maxDim : 1;

    // Dùng camera trực giao để ảnh không bị méo góc
    const thumbCamera = new THREE.OrthographicCamera(
        -effectiveMax * 0.8, effectiveMax * 0.8,
        effectiveMax * 0.8, -effectiveMax * 0.8,
        0.1, 1000
    );
    thumbCamera.position.set(0, 0, effectiveMax * 2);
    thumbCamera.lookAt(0, 0, 0);

    // Chụp lại thành ảnh PNG
    thumbRenderer.render(thumbScene, thumbCamera);
    return thumbRenderer.domElement.toDataURL("image/png");
}

let paperOverlayRenderer;

function showPaperOverlay(object) {
    let overlay = document.getElementById('paper-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'paper-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.cursor = 'pointer';
        overlay.style.flexDirection = 'column';

        const closeBtn = document.createElement('div');
        closeBtn.innerText = '(Nhả chuột bất kỳ đâu để đóng)';
        closeBtn.style.color = '#ccc';
        closeBtn.style.fontSize = '16px';
        closeBtn.style.marginBottom = '20px';
        closeBtn.style.fontFamily = 'Inter, sans-serif';
        overlay.appendChild(closeBtn);

        overlay.onmouseup = () => {
            overlay.style.display = 'none';
        };

        const img = document.createElement('img');
        img.id = 'paper-overlay-img';
        img.style.maxWidth = '90%';
        img.style.maxHeight = '80%';
        img.style.objectFit = 'contain';
        img.style.boxShadow = '0 10px 40px rgba(0,0,0,0.8)';
        img.style.borderRadius = '4px';

        overlay.appendChild(img);
        document.body.appendChild(overlay);
    }

    if (!paperOverlayRenderer) {
        paperOverlayRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        paperOverlayRenderer.setSize(1024, 1024); // Kích thước render độ nét cao
    }

    const scene = new THREE.Scene();
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.5); // Sáng mạnh để dễ đọc chữ
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 5, 10);
    scene.add(dirLight);

    const clone = object.clone();
    clone.visible = true;

    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Đưa giấy về tâm
    clone.position.sub(center);

    // Đặt mặt trước hướng về camera. Tờ giấy thường nằm bẹp ngang sàn (mặt phẳng XZ).
    // Xoay quanh trục X một góc 90 độ (PI/2) để nó đứng dựng lên nhìn thẳng vào camera.
    // Nếu tờ giấy bị ngược chữ, ta sẽ đổi chiều rotation sau.
    clone.rotation.set(Math.PI / 2, 0, 0);

    scene.add(clone);

    const maxDim = Math.max(size.x, size.y, size.z);
    const effectiveMax = maxDim > 0 ? maxDim : 1;

    // Dùng camera trực giao để giấy không bị méo phối cảnh
    const camera = new THREE.OrthographicCamera(
        -effectiveMax * 0.6, effectiveMax * 0.6,
        effectiveMax * 0.6, -effectiveMax * 0.6,
        0.1, 1000
    );
    camera.position.set(0, 0, effectiveMax * 2);
    camera.lookAt(0, 0, 0);

    paperOverlayRenderer.render(scene, camera);

    const img = document.getElementById('paper-overlay-img');
    img.src = paperOverlayRenderer.domElement.toDataURL("image/png");

    overlay.style.display = 'flex';
}

// --- LAPTOP HTML UI LOGIC ---
const laptopUI = document.getElementById('laptop-ui');
const laptopInput = document.getElementById('laptop-input');
const laptopMessageEl = document.getElementById('laptop-message');
const laptopSubmitBtn = document.getElementById('laptop-submit');
const keypadBtns = document.querySelectorAll('.keypad-btn');
const laptopUnlockedImg = document.getElementById('laptop-unlocked-img');
const laptopKeypadContainer = document.getElementById('laptop-keypad-container');

let htmlCurrentInput = "";
let isHtmlUnlocked = false;

// Đóng UI Laptop khi click ra ngoài
if (laptopUI) {
    laptopUI.addEventListener('mouseup', (e) => {
        if (e.target === laptopUI) {
            laptopUI.style.display = 'none';
        }
    });
}

// Xử lý các nút số (Fix lỗi click sai số)
keypadBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (isHtmlUnlocked) return;

        // SỬ DỤNG data-value ĐỂ LẤY GIÁ TRỊ CHÍNH XÁC, THAY VÌ DÙNG INDEX
        const val = btn.getAttribute('data-value');

        if (htmlCurrentInput.length < 6) {
            htmlCurrentInput += val;
            laptopInput.value = htmlCurrentInput; // Hiển thị số đang nhập
            laptopMessageEl.innerText = "ENTER PASSWORD"; // Xóa lỗi nếu đang hiển thị
            laptopMessageEl.style.color = "#ffffff";
        }
    });
});

// Xử lý nút Submit
if (laptopSubmitBtn) {
    laptopSubmitBtn.addEventListener('click', () => {
        if (isHtmlUnlocked) return;

        if (htmlCurrentInput === "110902") {
            isHtmlUnlocked = true;
            // Thành công: Ẩn bàn phím, hiện ảnh
            laptopKeypadContainer.style.display = 'none';
            laptopUnlockedImg.style.display = 'block';

            // Xóa remote khỏi túi đồ
            const remoteSlotImg = document.querySelector('.slot img[data-item-name*="remote" i], .slot img[data-item-name*="Remote" i]');
            if (remoteSlotImg) {
                const remoteSlot = remoteSlotImg.parentElement;
                remoteSlot.removeChild(remoteSlotImg);
                remoteSlot.title = '';
                remoteSlot.classList.remove('selected');
            }
        } else {
            // Lỗi: Reset toàn bộ mật khẩu
            htmlCurrentInput = "";
            laptopInput.value = "";
            laptopMessageEl.innerText = "Sai mật khẩu";
            laptopMessageEl.style.color = "#ff4444";
        }
    });
}
// --- KẾT THÚC LAPTOP HTML UI LOGIC ---



// --- KITCHEN VIEWING ---
let isViewingKitchen = false;
let kitchenOriginalCameraPosition = new THREE.Vector3();
let kitchenOriginalCameraRotation = new THREE.Euler();
let kitchenTargetCameraPosition = new THREE.Vector3();
let kitchenTargetCenter = new THREE.Vector3();

// --- CABINET VIEWING ---
let isViewingCabinet = false;
let cabinetOriginalCameraPosition = new THREE.Vector3();
let cabinetOriginalCameraRotation = new THREE.Euler();
let cabinetTargetCameraPosition = new THREE.Vector3();
let cabinetTargetCenter = new THREE.Vector3();

// --- SEWING SOFA VIEWING ---
let isViewingSewingSofa = false;
let sofaOriginalCameraPosition = new THREE.Vector3();
let sofaOriginalCameraRotation = new THREE.Euler();
let sofaTargetCameraPosition = new THREE.Vector3();
let sofaTargetCenter = new THREE.Vector3();

// --- SHELF VIEWING ---
let isViewingShelf = false;
let shelfOriginalCameraPosition = new THREE.Vector3();
let shelfOriginalCameraRotation = new THREE.Euler();
let shelfTargetCameraPosition = new THREE.Vector3();
let shelfTargetCenter = new THREE.Vector3();
const bookshelfGrid = Array(6).fill(null).map(() => Array(12).fill(null));
let shelf002Box = new THREE.Box3();
let shelf003Box = new THREE.Box3();
let currentShelfNormal = new THREE.Vector3();
let shelfHighlightGroup = new THREE.Group(); // Khung xếp sách

// --- TV SCREEN UI ---
let isViewingTV = false;
let tvOriginalCameraPosition = new THREE.Vector3();
let tvOriginalCameraRotation = new THREE.Euler();
let tvTargetCameraPosition = new THREE.Vector3();
let tvTargetCenter = new THREE.Vector3();
let tvKeypadPlane = null;
let tvScreenMesh = null;
let tvUnlocked = false; // True sau khi nhập đúng mật khẩu — ẩn keypad vĩnh viễn

let tvKeypadCanvas = document.createElement('canvas');
tvKeypadCanvas.width = 1024;  // 2x để tăng độ nét
tvKeypadCanvas.height = 2240; // 2x (logicâl 512×1120 × 2)
let tvKeypadCtx = tvKeypadCanvas.getContext('2d');
let tvKeypadTexture = new THREE.CanvasTexture(tvKeypadCanvas);

function drawTVKeypad(inputStr = "") {
    const ctx = tvKeypadCtx;
    const w = tvKeypadCanvas.width;
    const h = tvKeypadCanvas.height;

    // Background (canvas 512x1200)
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, w, h);

    // Screen for input at the top (2x resolution)
    ctx.fillStyle = '#111';
    ctx.fillRect(40, 40, w - 80, 300);
    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 120px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(inputStr, w - 80, 240);

    // Keypad layout (tất cả toạ độ được nhân 2 so với lôgic gốc — khớp canvas 1024x2240)
    const cols = 2;
    const btnW = 360;
    const btnH = 240;
    const gapX = 80;
    const gapY = 60;
    const startX = (w - (cols * btnW + gapX)) / 2;
    const startY = 440;

    const keys = [
        ['1', '2'],
        ['3', '4'],
        ['5', '6'],
        ['7', '8'],
        ['9', '0'],
        ['<-', '->']
    ];

    for (let row = 0; row < keys.length; row++) {
        for (let col = 0; col < keys[row].length; col++) {
            const btnX = startX + col * (btnW + gapX);
            const btnY = startY + row * (btnH + gapY);
            const key = keys[row][col];

            ctx.fillStyle = '#444';
            if (key === '<-') ctx.fillStyle = '#c33';
            if (key === '->') ctx.fillStyle = '#3c3';

            ctx.fillRect(btnX, btnY, btnW, btnH);
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 8;
            ctx.strokeRect(btnX, btnY, btnW, btnH);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 100px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(key, btnX + btnW / 2, btnY + btnH / 2);
        }
    }
    tvKeypadTexture.needsUpdate = true;
}

drawTVKeypad("");
let tvDisplayTexture = new THREE.TextureLoader().load('/models/tv_display_1.png');
let tvPassTexture = new THREE.TextureLoader().load('/models/tv_pass_lap.png'); // Texture khi nhập đúng mật khẩu
let currentTVInput = "";
// --- KẾT THÚC TV SCREEN UI ---

// Hàm đưa vật phẩm vào ô túi đồ (Inventory) — có hỗ trợ xếp chồng vật phẩm cùng loại
function addToInventory(object) {
    const itemName = object.name;
    const itemType = getItemType(itemName);

    // --- Kiểm tra xem đã có ô nào chứa vật phẩm cùng loại chưa ---
    const allSlots = document.querySelectorAll('.slot');
    for (const slot of allSlots) {
        const img = slot.querySelector('img');
        if (img && getItemType(img.dataset.itemName) === itemType) {
            // Đã có ô cùng loại → tăng số lượng
            let qty = parseInt(slot.dataset.qty || '1', 10);
            qty++;
            slot.dataset.qty = qty;

            // Cập nhật hoặc tạo badge số lượng
            let badge = slot.querySelector('.qty-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'qty-badge';
                slot.appendChild(badge);
            }
            badge.textContent = qty;

            return; // Không cần tạo ô mới
        }
    }

    // --- Không có ô cùng loại → tìm ô trống ---
    let firstEmptySlot = null;
    for (const slot of allSlots) {
        if (!slot.querySelector('img')) {
            firstEmptySlot = slot;
            break;
        }
    }

    if (firstEmptySlot) {
        // Tạo thẻ img và dùng ảnh chụp từ model 3D thực tế
        const itemImg = document.createElement('img');
        itemImg.src = generateThumbnail(object);

        // Làm sạch tên để làm tooltip
        let displayName = itemName.replace(/_/g, ' ').replace(/\.\d+$/, '').replace(' Merged', '');
        firstEmptySlot.title = displayName;

        // Lưu lại tên gốc để trả về
        itemImg.dataset.itemName = itemName;

        // Đánh dấu số lượng ban đầu = 1 (chưa hiện badge)
        firstEmptySlot.dataset.qty = '1';

        // Sự kiện nhả chuột vào ảnh để tương tác trong túi đồ
        itemImg.onmouseup = function (e) {
            e.stopPropagation();
            const targetName = this.dataset.itemName;

            // Nếu là giấy thì xem phóng to — dùng bản sao đã cache, hoạt động ở MỌI phòng
            if (targetName.toLowerCase().includes('paper')) {
                let viewObject = pickedItemCache.get(targetName);
                if (!viewObject) {
                    viewObject = scene.getObjectByName(targetName);
                }
                if (viewObject) {
                    showPaperOverlay(viewObject);
                }
                return;
            }

            // Nếu là laptop thì dùng UI HTML mới
            if (targetName.includes('Cube013_Merged')) {
                if (laptopUI) {
                    laptopUI.style.display = 'flex';
                }
                return;
            }

            // Chọn / bỏ chọn vật phẩm — hoạt động bất kể đang ở phòng nào
            const slots = document.querySelectorAll('.slot');
            const isCurrentlySelected = this.parentElement.classList.contains('selected');

            // Bỏ chọn tất cả các slot khác
            slots.forEach(s => s.classList.remove('selected'));

            if (!isCurrentlySelected) {
                // Chọn slot hiện tại nếu nó chưa được chọn
                this.parentElement.classList.add('selected');
                showObjectName("Đang chọn: " + this.parentElement.title);
            } else {
                // Bỏ chọn nếu nó đã được chọn trước đó
                showObjectName("Đã bỏ chọn: " + this.parentElement.title);
            }
        };

        firstEmptySlot.appendChild(itemImg);
    } else {
        showObjectName("Túi đồ đã đầy!");
    }
}

function showObjectName(name) {
    const notif = document.getElementById('object-notification');
    if (!notif) return;

    // Dọn dẹp tên object (thay _ bằng khoảng trắng, xóa các số .001 đằng sau do Blender tạo)
    let displayName = name.replace(/_/g, ' ').replace(/\.\d+$/, '');

    // Viết hoa chữ cái đầu tiên cho đẹp
    displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

    notif.innerText = displayName;
    notif.classList.add('show');

    // Tự động ẩn sau 2.5 giây
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
        notif.classList.remove('show');
    }, 2500);
}

// ------------------------------------

// Render loop
function render() {
    requestAnimationFrame(render);
    updateWalls(camera);
    updateTransition();

    // Xử lý animation cho cửa
    for (let i = animatingDoors.length - 1; i >= 0; i--) {
        const door = animatingDoors[i];
        if (door.userData.targetRotation) {
            door.rotation.y += (door.userData.targetRotation.y - door.rotation.y) * 0.1;

            if (Math.abs(door.rotation.y - door.userData.targetRotation.y) < 0.001) {
                door.rotation.y = door.userData.targetRotation.y;
                animatingDoors.splice(i, 1);
            }
        }
    }

    // Xử lý animation cho ngăn kéo
    for (let i = animatingDrawers.length - 1; i >= 0; i--) {
        const drawer = animatingDrawers[i];
        if (drawer.userData.targetPosition) {
            drawer.position.lerp(drawer.userData.targetPosition, 0.1);

            if (drawer.position.distanceTo(drawer.userData.targetPosition) < 0.001) {
                drawer.position.copy(drawer.userData.targetPosition);
                animatingDrawers.splice(i, 1);
            }
        }
    }

    if (isViewingTV) {
        camera.position.lerp(tvTargetCameraPosition, 0.1);
        camera.lookAt(tvTargetCenter);
    } else if (isViewingShelf) {
        camera.position.lerp(shelfTargetCameraPosition, 0.1);
        camera.lookAt(shelfTargetCenter);
    } else if (isViewingSewingSofa) {
        camera.position.lerp(sofaTargetCameraPosition, 0.1);
        camera.lookAt(sofaTargetCenter);
    } else if (isViewingKitchen) {
        camera.position.lerp(kitchenTargetCameraPosition, 0.1);
        camera.lookAt(kitchenTargetCenter);
    } else if (isViewingCabinet) {
        camera.position.lerp(cabinetTargetCameraPosition, 0.1);
        camera.lookAt(cabinetTargetCenter);
    }

    renderer.render(scene, camera);
}

// --- HỆ THỐNG NHẠC NỀN ---
const bgmAudio = document.getElementById('bgm-audio');
const musicToggleBtn = document.getElementById('music-toggle-btn');
let isMusicPlaying = false;
let userHasInteracted = false;

if (bgmAudio && musicToggleBtn) {
    // Trình duyệt yêu cầu người dùng phải tương tác web ít nhất 1 lần mới cho phát nhạc
    window.addEventListener('mousedown', () => {
        if (!userHasInteracted) {
            userHasInteracted = true;
            // Tự động phát nhạc ở lần click đầu tiên với âm lượng 50%
            bgmAudio.volume = 0.5;
            bgmAudio.play().then(() => {
                isMusicPlaying = true;
                musicToggleBtn.textContent = '🔊';
            }).catch(err => console.log('Không thể phát nhạc tự động:', err));
        }
    }, { once: true });

    musicToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Ngăn chặn sự kiện click lan xuống 3D
        if (isMusicPlaying) {
            bgmAudio.pause();
            isMusicPlaying = false;
            musicToggleBtn.textContent = '🔈';
        } else {
            bgmAudio.play();
            isMusicPlaying = true;
            musicToggleBtn.textContent = '🔊';
        }
    });
}

render();
