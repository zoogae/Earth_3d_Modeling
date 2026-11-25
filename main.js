"use strict";

// 1. WebGL 초기화
const canvas = document.getElementById("gl");
const statusEl = document.getElementById("status");

const gl = canvas.getContext("webgl", {
    antialias: true,
    alpha: false
});

if (!gl) {
    throw new Error("WebGL을 사용할 수 없습니다.");
}

// 2. Vertex Shader
const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;

uniform mat4 uMVP;
uniform mat4 uModel;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUV;

void main() {
    vec4 world = uModel * vec4(aPosition, 1.0);

    vWorldPosition = world.xyz;

    vNormal = normalize(
        mat3(uModel) * aNormal
    );

    vUV = aUV;

    gl_Position = uMVP * vec4(aPosition, 1.0);
}
`;

// 3. Fragment Shader

const FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D uTexture;
uniform vec3 uSunDirection;
uniform vec3 uEye;
uniform float uLightMode;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUV;

void main() {

    vec3 albedo = texture2D(
        uTexture, vUV
    ).rgb;

    vec3 N = normalize(vNormal);
    vec3 L = normalize(uSunDirection);
    vec3 V = normalize(uEye - vWorldPosition);

    float ndotl = max(dot(N, L), 0.0);

    // 조명 모드별 주변광
    float ambient;

    if (uLightMode < 0.5) {
        // 기본: 전체 지구가 밝게 보이는 모드
        ambient = 0.48;
    } else {
        // 태양 조명 강조 모드
        ambient = 0.17;
    }

    // 태양 방향에 따른 확산광
    float diffuse = 0.68 * ndotl;

    // 대륙과 바다의 색상 유지
    vec3 color = albedo * (ambient + diffuse);

    // 바다 반사광
    float ocean = step(
        albedo.r * 1.35,
        albedo.b
    );

    vec3 H = normalize(L + V);

    float spec = pow(
        max(dot(N, H), 0.0),
        80.0
    );

    spec *= ocean * ndotl * 0.15;

    color += vec3(
        spec * 0.65,
        spec * 0.8,
        spec
    );

    // 톤 매핑
    color = color / (color + vec3(0.7));

    // 감마 보정
    color = pow(color, vec3(0.85));

    gl_FragColor = vec4(color, 1.0);
}
`;


// 4. Shader 컴파일
function compileShader(type, source) {

    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(
        shader, gl.COMPILE_STATUS
    )) {
        throw new Error(
            gl.getShaderInfoLog(shader)
        );
    }

    return shader;
}

const program = gl.createProgram();

gl.attachShader(
    program,
    compileShader(gl.VERTEX_SHADER, VERTEX_SHADER)
);

gl.attachShader(
    program,
    compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
);

gl.linkProgram(program);

if (!gl.getProgramParameter(
    program, gl.LINK_STATUS
)) {
    throw new Error(
        gl.getProgramInfoLog(program)
    );
}

gl.useProgram(program);

// 5. Shader 변수 위치
const loc = {};

for (const name of [
    "aPosition",
    "aNormal",
    "aUV"
]) {
    loc[name] = gl.getAttribLocation(program, name);
}

for (const name of [
    "uMVP",
    "uModel",
    "uSunDirection",
    "uEye",
    "uTexture",
    "uLightMode"
]) {
    loc[name] = gl.getUniformLocation(program, name);
}


// 6. 행렬 연산
// 4x4 행렬 곱셈
function mul(a, b) {
    const out = new Float32Array(16);

    for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
            for (let k = 0; k < 4; k++) {
                out[c * 4 + r] +=
                    a[k * 4 + r] * b[c * 4 + k];
            }
        }
    }

    return out;
}

// 단위 행렬
function identity() {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}

// X축 회전
function rx(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([
        1, 0, 0, 0,
        0, c, s, 0,
        0, -s, c, 0,
        0, 0, 0, 1
    ]);
}

// Y축 회전
function ry(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1
    ]);
}

// Z축 회전
function rz(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([
        c, s, 0, 0,
        -s, c, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}

// 원근 투영 행렬
function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);

    const out = new Float32Array(16);

    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = 2 * far * near / (near - far);

    return out;
}

// 카메라 Z축 이동
function translate(z) {
    const out = identity();
    out[14] = z;
    return out;
}

// Quaternion + Arcball 회전
// Quaternion 형식: [x, y, z, w]
function quatNormalize(q) {
    const len = Math.hypot(q[0], q[1], q[2], q[3]);

    if (len < 1e-8) return [0, 0, 0, 1];

    return q.map(v => v / len);
}

// Quaternion 곱셈: a * b
function quatMultiply(a, b) {
    const [ax, ay, az, aw] = a;
    const [bx, by, bz, bw] = b;

    return [
         aw * bx + ax * bw + ay * bz - az * by,
         aw * by - ax * bz + ay * bw + az * bx,
         aw * bz + ax * by - ay * bx + az * bw,
         aw * bw - ax * bx - ay * by - az * bz
    ];
}

// Quaternion 4x4 회전 행렬로 변환
function quatToMatrix(q) {
    const [x, y, z, w] = quatNormalize(q);

    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;

    return new Float32Array([
        1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy), 0,
        2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx), 0,
        2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy), 0,
        0, 0, 0, 1
    ]);
}

function projectArcball(clientX, clientY) {

    const rect = canvas.getBoundingClientRect();

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const radius = Math.max(
         1,
         Math.min(rect.width, rect.height)
         * 0.5 / Math.tan(Math.PI / 8)
         / zoom
    );

    let x = (clientX - cx) / radius;
    let y = (cy - clientY) / radius;

    const d2 = x * x + y * y;

    let z;

    if (d2 <= 1) {
        z = Math.sqrt(1 - d2);
    } else {
        const inv = 1 / Math.sqrt(d2);
        x *= inv;
        y *= inv;
        z = 0;
    }

    return [x, y, z];
}

//벡터 기반 회전 계산
function quatFromVectors(a, b) {

    const cross = [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];

    const dot = Math.max(-1, Math.min(1,
        a[0] * b[0] +
        a[1] * b[1] +
        a[2] * b[2]
    ));

    // 벡터 처리
    if (dot < -0.999999) {
         let axis = Math.abs(a[0]) < 0.9
            ? [0, -a[2], a[1]]
            : [-a[1], a[0], 0];

        const len = Math.hypot(...axis);
        axis = axis.map(v => v / len);

        return [...axis, 0];
    }

    return quatNormalize([
        cross[0],
        cross[1],
        cross[2],
        1 + dot
    ]);
}


// 7. 이미지 로딩
function loadImage(path) {
    return new Promise((resolve, reject) => {

        const image = new Image();

        image.onload = () => resolve(image);

        image.onerror = () => reject(
            new Error(path + " 로딩 실패")
        );

        image.src = path;
    });
}

// 이미지를 픽셀 데이터로 변환
function pixels(image) {

    const canvas = document.createElement("canvas");

    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext("2d", {
        willReadFrequently: true
    });

    ctx.drawImage(image, 0, 0);

    return ctx.getImageData(
        0, 0, canvas.width, canvas.height
    );
}


// 8. 지형 높이 추출
function sampleHeight(image, u, v) {

    const x = Math.min(
        image.width - 1,
        Math.max(0, Math.round(u * (image.width - 1)))
    );

    const y = Math.min(
        image.height - 1,
        Math.max(0, Math.round(
            (1 - v) * (image.height - 1)
        ))
    );

    const index = (y * image.width + x) * 4;

    const r = image.data[index];
    const g = image.data[index + 1];
    const b = image.data[index + 2];

    return (
        0.2126 * r +
        0.7152 * g +
        0.0722 * b
    ) / 255;
}


// 9. 지구 mesh 생성
function makeSphere(heightImage) {

    const LAT = 120;
    const LON = 240;

    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    const baseRadius = 1.0;

    const amplitude = 0.006;

    for (let j = 0; j <= LAT; j++) {

        const v = j / LAT;
        const lat = (v - 0.5) * Math.PI;

        for (let i = 0; i <= LON; i++) {

            const u = i / LON;
            const lon = (u - 0.5) * 2 * Math.PI;

            // 위도, 경도를 3D 좌표로 변환
            const nx =
                Math.cos(lat) * Math.cos(lon);

            const ny = Math.sin(lat);

            const nz =
                Math.cos(lat) * Math.sin(lon);

            // 지형 밝기값 추출
            const relief = heightImage
                ? sampleHeight(heightImage, u, v)
                : 0;

            // 정점 반지름 조정
            const radius =
                baseRadius + amplitude * relief;

            // 정점 위치
            positions.push(
                radius * nx,
                radius * ny,
                radius * nz
            );

            // 부드러운 표면 법선
            normals.push(nx, ny, nz);

            // 텍스처 좌표
            uvs.push(u, v);
        }
    }

    // 삼각형 Mesh 연결
    for (let j = 0; j < LAT; j++) {
        for (let i = 0; i < LON; i++) {

            const a = j * (LON + 1) + i;
            const b = a + LON + 1;

            indices.push(
                a, a + 1, b,
                a + 1, b + 1, b
            );
        }
    }

    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        uvs: new Float32Array(uvs),
        indices: new Uint16Array(indices)
    };
}

// 10. GPU 버퍼 생성
function bufferAttrib(data, attribute, size) {

    const buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    gl.bufferData(
        gl.ARRAY_BUFFER,
        data,
        gl.STATIC_DRAW
    );

    gl.enableVertexAttribArray(attribute);

    gl.vertexAttribPointer(
        attribute,
        size,
        gl.FLOAT,
        false,
        0,
        0
    );

    return buffer;
}

// 11. NASA 이미지가 없을 때 임시 텍스처
function fallbackTexture() {

    const canvas = document.createElement("canvas");

    canvas.width = 1024;
    canvas.height = 512;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0b2956";
    ctx.fillRect(0, 0, 1024, 512);

    ctx.fillStyle = "#537952";

    const polygons = [
        [[80,100],[210,60],[300,130],[250,230],[160,220]],
        [[310,260],[420,240],[405,340],[360,465],[330,390]],
        [[480,110],[680,70],[830,130],[870,250],[690,270]],
        [[570,260],[690,280],[660,440],[550,390]],
        [[830,310],[950,310],[985,390],[865,420]]
    ];

    for (const polygon of polygons) {

        ctx.beginPath();

        polygon.forEach(([x, y], i) => {
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.closePath();
        ctx.fill();
    }

    return canvas;
}

// 12. WebGL 텍스처 설정
function initTexture(image) {

    const texture = gl.createTexture();

    gl.activeTexture(gl.TEXTURE0);

    gl.bindTexture(
        gl.TEXTURE_2D,
        texture
    );

    gl.pixelStorei(
        gl.UNPACK_FLIP_Y_WEBGL,
        true
    );

    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
    );

    gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_S,
        gl.CLAMP_TO_EDGE
    );

    gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_T,
        gl.CLAMP_TO_EDGE
    );

    gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR
    );

    gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MAG_FILTER,
        gl.LINEAR
    );

    gl.uniform1i(loc.uTexture, 0);

    return texture;
}

// 13. 마우스 및 키보드 상호작용
let dragging = false;
let previousArcball = null;

// 지구 확대/축소 거리
let zoom = 3.05;

// 지구 자동 자전
let spin = 0;
let paused = false;

// 태양 방향 슬라이더 + 미니맵
let sunAngle = 0;

const sunSlider = document.getElementById("sunAngle");
const sunAngleValue = document.getElementById("sunAngleValue");

const miniMap = document.getElementById("miniMap");
const miniCtx = miniMap.getContext("2d");

//태양
function drawSun(ctx, x, y) {
    ctx.font = "34px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("☀️", x, y);
}

//지구
function drawMiniEarth(ctx, x, y) {
    ctx.font = "34px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🌎", x, y);
}

// 미니맵
function drawMiniMap() {
    const ctx = miniCtx;
    const w = miniMap.width;
    const h = miniMap.height;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#ececec";
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    const margin = 28;

    // 공전 궤도 
    const orbitA = w / 2 - margin;
    const orbitB = h * 0.27;
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.ellipse(
        cx, cy,
        orbitA, orbitB,
        0, 0, Math.PI * 2
    );
    ctx.stroke();

    drawSun(ctx, cx, cy);

    const orbitAngle =
        (sunAngle + 90) * Math.PI / 180;

    const earthX =
        cx + orbitA * Math.cos(orbitAngle);

    const earthY =
        cy + orbitB * Math.sin(orbitAngle);

    // 공전 지구
    drawMiniEarth(ctx, earthX, earthY);
}

sunSlider.addEventListener("input", (e) => {
    sunAngle = Number(e.target.value);
    sunAngleValue.textContent = sunAngle + "°";
    drawMiniMap();
});

drawMiniMap();

// 회전축과 각도로 Quaternion 생성
function quatAxisAngle(axis, angle) {
    const half = angle / 2;
    const s = Math.sin(half);

    return [
        axis[0] * s,
        axis[1] * s,
        axis[2] * s,
        Math.cos(half)
    ];
}

// 초기 관찰 방향
function initialOrientation() {
    const qY = quatAxisAngle([0, 1, 0], -0.5);
    const qX = quatAxisAngle([1, 0, 0], 0.27);

    return quatNormalize(quatMultiply(qY, qX));
}

let earthOrientation = initialOrientation();

// 마우스 드래그
canvas.addEventListener("pointerdown", (e) => {

    if (e.pointerType === "mouse" && e.button !== 0) {
        return;
    }

    dragging = true;

    previousArcball = projectArcball(
        e.clientX,
        e.clientY
    );

    canvas.setPointerCapture(e.pointerId);
});

// 마우스 드래그 회전
canvas.addEventListener("pointermove", (e) => {

    if (!dragging || !previousArcball) return;

    const currentArcball = projectArcball(
        e.clientX,
        e.clientY
    );

    const deltaQ = quatFromVectors(
        currentArcball,
        previousArcball
    );

    earthOrientation = quatNormalize(
        quatMultiply(deltaQ, earthOrientation)
    );
    previousArcball = currentArcball;
});

// 마우스 드래그 종료
function stopDragging() {
    dragging = false;
    previousArcball = null;
}

canvas.addEventListener("pointerup", stopDragging);
canvas.addEventListener("pointercancel", stopDragging);
canvas.addEventListener("lostpointercapture", stopDragging);

// 마우스 휠 확대/축소
canvas.addEventListener("wheel", (e) => {

    e.preventDefault();

    zoom = Math.max(
        1.8,
        Math.min(
            7.0,
            zoom * Math.exp(e.deltaY * 0.001)
        )
    );

}, { passive: false });

// 키보드 조작
window.addEventListener("keydown", (e) => {

    // Space: 자동 자전 일시정지
    if (e.code === "Space") {
        e.preventDefault();

        if (!e.repeat) {
            paused = !paused;
        }
    }

    // R: 관찰 방향 초기화
    if (e.code === "KeyR") {
        earthOrientation = initialOrientation();
        zoom = 3.05;
    }
});

// 14. Canvas 크기 조정
function resize() {

    const d = Math.min(
        window.devicePixelRatio || 1,
        2
    );

    const width = Math.max(
        1, Math.round(canvas.clientWidth * d)
    );

    const height = Math.max(
        1, Math.round(canvas.clientHeight * d)
    );

    if (
        canvas.width !== width ||
        canvas.height !== height
    ) {
        canvas.width = width;
        canvas.height = height;
    }

    gl.viewport(0, 0, width, height);
}

// 15. 렌더링
function run(mesh, texture) {

    bufferAttrib(
        mesh.positions,
        loc.aPosition,
        3
    );

    bufferAttrib(
        mesh.normals,
        loc.aNormal,
        3
    );

    bufferAttrib(
        mesh.uvs,
        loc.aUV,
        2
    );

    // 삼각형 인덱스
    const indexBuffer = gl.createBuffer();

    gl.bindBuffer(
        gl.ELEMENT_ARRAY_BUFFER,
        indexBuffer
    );

    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        mesh.indices,
        gl.STATIC_DRAW
    );

    gl.enable(gl.DEPTH_TEST);

    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    gl.clearColor(
        0.009,
        0.019,
        0.042,
        1.0
    );

    let previous = 0;

    // 애니메이션 루프
    function render(ms) {

        resize();

        // 프레임 간 경과 시간
        const dt = Math.min(
            0.05,
            (ms - previous) / 1000 || 0
        );

        previous = ms;

        // 드래그 중 자동 자전 정지
        if (!paused && !dragging) {
            spin += dt * 0.12;
        }

        gl.clear(
            gl.COLOR_BUFFER_BIT |
            gl.DEPTH_BUFFER_BIT
        );

        // 1. Arcball 회전
        const arcballMatrix = quatToMatrix(earthOrientation);

        // 2. 지구 자전축 기울기
        const tilt = 23.4 * Math.PI / 180;
        const tiltMatrix = rz(tilt);

        // 3. 자동 자전
        const spinMatrix = ry(spin);

        // 4. 최종 모델 행렬
        const model = mul(
            arcballMatrix,
            mul(
                tiltMatrix,
                spinMatrix
            )
        );

        // 카메라 행렬
        const view = translate(-zoom);

        // 원근 투영 행렬
        const projection = perspective(
            45 * Math.PI / 180,
            canvas.width / canvas.height,
            0.1,
            40
        );

        // Model-View-Projection
        const mvp = mul(
            projection,
            mul(view, model)
        );

        // Shader에 행렬 전달
        gl.uniformMatrix4fv(
            loc.uModel,
            false,
            model
        );

        gl.uniformMatrix4fv(
            loc.uMVP,
            false,
            mvp
        );
        
        const angle = sunAngle * Math.PI / 180;

        // 태양 상대적 방향 계산
        const sunX = Math.sin(angle);
        const sunY = 0.25;
        const sunZ = Math.cos(angle);

        // Fragment Shader에 태양 방향 전달
        gl.uniform3f(
            loc.uSunDirection,
            sunX,
            sunY,
            sunZ
        );

        // 현재 조명 모드 전달
        gl.uniform1f(
            loc.uLightMode,
            1.0
        );

        // 카메라 위치
        gl.uniform3f(
            loc.uEye,
            0,
            0,
            zoom
        );

        // 지구 렌더링
        gl.drawElements(
            gl.TRIANGLES,
            mesh.indices.length,
            gl.UNSIGNED_SHORT,
            0
        );

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

// 16.초기 실행
Promise.allSettled([

    loadImage("assets/earth_day.png"),

    loadImage("assets/earth_relief.jpg")

]).then(([day, relief]) => {

    const hasDay = day.status === "fulfilled";

    const hasRelief =
        relief.status === "fulfilled";

    // 위성 텍스처 생성
    const texture = initTexture(
        hasDay
            ? day.value
            : fallbackTexture()
    );

    // 고도 이미지 읽기
    const terrain = hasRelief
        ? pixels(relief.value)
        : null;

    // 지구 메시 생성
    const sphere = makeSphere(terrain);

    // WebGL 렌더링 시작
    run(sphere, texture);

    // 로딩 상태 표시
    if (hasDay && hasRelief) {

        statusEl.textContent =
            "NASA 위성 텍스처 + 지형 영상 적용";

    } else if (hasDay) {

        statusEl.textContent =
            "위성 텍스처 적용 / 지형 영상 없음";

    } else {

        statusEl.textContent =
            "위성 이미지 없음: 임시 지도 표시 중";
    }
});
