import { RenderVertexSource, RenderFragmentSource } from "./shaders/renderShaders.js";
import { TracerVertexSource, TracerFragmentSource } from "./shaders/tracerShaders.js";
import { mat4, vec3, vec4 } from "./gl-matrix/index.js";

let gl: WebGLRenderingContext;
let then: number;
let sampleCount: number = 0;

let distance = 2.5;
let eye: vec3 = vec3.fromValues(0, 0, distance);
let angleX: number = 0;
let angleY: number = 0;

let light: vec3 = vec3.fromValues(0.4, 0.5, -0.6);
let sphere1 = {
    sphereCenter: vec3.fromValues(0.25, 0.25, 0),
    sphereRadius: 0.1
}

let sphere2 = {
    sphereCenter: vec3.fromValues(0, -0.75, 0),
    sphereRadius: 0.25
}

let up: vec3 = vec3.fromValues(0, 1, 0);

let screen00: vec4 = vec4.fromValues(-1, -1, 0, 1);
let screen01: vec4 = vec4.fromValues(-1, +1, 0, 1);
let screen10: vec4 = vec4.fromValues(+1, -1, 0, 1);
let screen11: vec4 = vec4.fromValues(+1, +1, 0, 1);

const registerControls = (canvas: HTMLCanvasElement, eye: vec3) => {
    const keyDownHandler = (event: KeyboardEvent) => {
        if (event.key === 'ArrowUp') {
            distance -= 0.1;
            sampleCount = 0;
        } else if (event.key === 'ArrowDown') {
            distance += 0.1;
            sampleCount = 0;
        }
    }

    let isClicked = false;
    const movementSpeed = 0.01;
    const zoomSpeed = 0.01;

    const moveHandler = (e: MouseEvent) => {
        if (isClicked) {
            let xMove = e.movementX * movementSpeed;
            let yMove = e.movementY * movementSpeed;

            angleX -= xMove;
            angleX %= 2 * Math.PI;

            angleY += yMove;
            if (angleY > Math.PI / 2) {
                angleY = Math.PI / 2
            } else if (angleY < -Math.PI / 2) {
                angleY = -Math.PI / 2;
            }

            sampleCount = 0;
        }
    }

    const mousewheelHandler = (e: WheelEvent) => {
        distance -= zoomSpeed * e.deltaY;
        sampleCount = 0;
    }

    document.addEventListener('keydown', keyDownHandler, false);
    canvas.addEventListener('mousedown', e => { isClicked = true; }, false);
    canvas.addEventListener('mouseup', e => { isClicked = false; }, false);
    canvas.addEventListener('mousemove', moveHandler, false);
    canvas.addEventListener('wheel', mousewheelHandler, false);
}

function main() {
    const canvas: HTMLCanvasElement | null = document.querySelector("#glCanvas");
    if (canvas == null) {
        alert("Couldn't find canvas element.");
        return;
    }
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    console.log("Starting main function.");

    const glMaybeNull: WebGLRenderingContext | null = canvas.getContext("webgl");
    if (glMaybeNull == null) {
        alert("Unable to initialize WebGL context. Your browser or machine may not support it.");
        return;
    }
    gl = glMaybeNull;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    let width: number = canvas.clientWidth;
    let height: number = canvas.clientHeight;

    let aspectRatio: number = width / height;
    let projectionMatrix: mat4 = mat4.perspective(mat4.create(), Math.PI * 55 / 180, aspectRatio, 0.1, 100);

    let vertices: number[] = [
        -1, -1,
        -1, +1,
        +1, -1,
        +1, +1
    ];

    let vertexBuffer: WebGLBuffer | null = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    // create FrameBuffer
    let frameBuffer: WebGLFramebuffer | null = gl.createFramebuffer();

    let type = gl.getExtension('OES_texture_float') ? gl.FLOAT : gl.UNSIGNED_BYTE;
    let textures: (WebGLTexture | null)[] = [];
    for (let i = 0; i < 2; i++) {
        textures.push(gl.createTexture());
        gl.bindTexture(gl.TEXTURE_2D, textures[i]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    let ceilingTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, ceilingTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 255, 255]));
    let image = new Image();
    image.src = "../assets/checkerboard.png";
    image.addEventListener('load', () => {
        console.log("image loaded");
        gl.bindTexture(gl.TEXTURE_2D, ceilingTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.bindTexture(gl.TEXTURE_2D, null);
    });

    let triangleVertex1 = [-1 / 4, 0, -1 / (4 * Math.sqrt(3))];
    let triangleVertex2 = [1 / 4, 0, -1 / (4 * Math.sqrt(3))];
    let triangleVertex3 = [0, 0, 1 / (2 * Math.sqrt(3))];
    let triangleVertex4 = [0, 1 / Math.sqrt(6), 0];
    let triangleVertices: Float32Array = new Float32Array(([] as number[]).concat(
        triangleVertex3, triangleVertex2, triangleVertex1,
        triangleVertex1, triangleVertex2, triangleVertex4,
        triangleVertex1, triangleVertex4, triangleVertex3,
        triangleVertex2, triangleVertex3, triangleVertex4
    ));

    // create render shader
    let renderProgram = initShaderProgram(gl, RenderVertexSource, RenderFragmentSource);
    if (renderProgram == null) {
        alert("Could not compile render program");
        return;
    }
    let renderVertexAttribute = gl.getAttribLocation(renderProgram, 'vertex');
    gl.enableVertexAttribArray(renderVertexAttribute);

    // create tracer shader
    let tracerProgram = initShaderProgram(gl, TracerVertexSource, TracerFragmentSource(width, height));
    if (tracerProgram == null) {
        alert("Could not compile tracer program");
        return;
    }
    let tracerVertexAttribute = gl.getAttribLocation(tracerProgram, 'vertex');
    gl.enableVertexAttribArray(tracerVertexAttribute);

    const programInfo = {
        tracerProgram: {
            program: tracerProgram,
            attribLocations: {
                vertex: gl.getAttribLocation(tracerProgram, 'vertex')
            },
            uniformLocations: {
                eye: gl.getUniformLocation(tracerProgram, 'eye'),
                ray00: gl.getUniformLocation(tracerProgram, 'ray00'),
                ray01: gl.getUniformLocation(tracerProgram, 'ray01'),
                ray10: gl.getUniformLocation(tracerProgram, 'ray10'),
                ray11: gl.getUniformLocation(tracerProgram, 'ray11'),
                textureWeight: gl.getUniformLocation(tracerProgram, 'textureWeight'),
                timeSinceStart: gl.getUniformLocation(tracerProgram, 'timeSinceStart'),
                texture: gl.getUniformLocation(tracerProgram, 'texture'),
                ceilingTexture: gl.getUniformLocation(tracerProgram, 'ceilingTexture'),
                light: gl.getUniformLocation(tracerProgram, 'light'),
                sphere1Center: gl.getUniformLocation(tracerProgram, 'sphere1Center'),
                sphere1Radius: gl.getUniformLocation(tracerProgram, 'sphere1Radius'),
                sphere2Center: gl.getUniformLocation(tracerProgram, 'sphere2Center'),
                sphere2Radius: gl.getUniformLocation(tracerProgram, 'sphere2Radius'),
                triangleVertices: gl.getUniformLocation(tracerProgram, 'triangleVertices')
            }
        },
        renderProgram: {
            program: renderProgram,
            attribLocations: {
                vertex: gl.getAttribLocation(renderProgram, 'vertex'),
                texture: gl.getUniformLocation(renderProgram, 'texture')
            }
        }
    }

    gl.useProgram(programInfo.tracerProgram.program);
    gl.uniform3fv(programInfo.tracerProgram.uniformLocations.eye, eye);
    gl.uniform3fv(programInfo.tracerProgram.uniformLocations.light, light);
    gl.uniform3fv(programInfo.tracerProgram.uniformLocations.sphere1Center, sphere1.sphereCenter);
    gl.uniform1f(programInfo.tracerProgram.uniformLocations.sphere1Radius, sphere1.sphereRadius);
    gl.uniform3fv(programInfo.tracerProgram.uniformLocations.sphere2Center, sphere2.sphereCenter);
    gl.uniform1f(programInfo.tracerProgram.uniformLocations.sphere2Radius, sphere2.sphereRadius);

    gl.uniform1i(programInfo.tracerProgram.uniformLocations.texture, 0);
    gl.uniform1i(programInfo.tracerProgram.uniformLocations.ceilingTexture, 1);

    gl.uniform1fv(programInfo.tracerProgram.uniformLocations.triangleVertices, triangleVertices);

    registerControls(canvas, eye);

    function render(now: number) {
        now *= 0.1;
        const deltaTime = now - then;
        then = now;

        gl.clearColor(0.15, 0.15, 0.15, 1.0);
        gl.clearDepth(1.0);
        gl.clear(gl?.COLOR_BUFFER_BIT | gl?.DEPTH_BUFFER_BIT);

        gl.useProgram(programInfo.tracerProgram.program);
        gl.uniform1f(programInfo.tracerProgram.uniformLocations.timeSinceStart, now);

        eye[0] = distance * Math.sin(angleX) * Math.cos(angleY);
        eye[1] = distance * Math.sin(angleY);
        eye[2] = distance * Math.cos(angleX) * Math.cos(angleY);
        gl.uniform3fv(programInfo.tracerProgram.uniformLocations.eye, eye);

        let viewMatrix: mat4 = mat4.lookAt(mat4.create(), eye, vec3.fromValues(0, 0, 0), up);
        let viewProjectionMatrix: mat4 = mat4.multiply(mat4.create(), projectionMatrix, viewMatrix);

        let jitter: vec3 = vec3.scale(vec3.create(), vec3.fromValues(Math.random() * 2 - 1, Math.random() * 2 - 1, 0), 1 / 5000)
        let inverse: mat4 = mat4.invert(
            mat4.create(),
            mat4.translate(mat4.create(), viewProjectionMatrix, jitter)
        );

        let ray00_i1: vec4 = vec4.transformMat4(vec4.create(), screen00, inverse);
        let ray01_i1: vec4 = vec4.transformMat4(vec4.create(), screen01, inverse);
        let ray10_i1: vec4 = vec4.transformMat4(vec4.create(), screen10, inverse);
        let ray11_i1: vec4 = vec4.transformMat4(vec4.create(), screen11, inverse);

        let ray00_i2: vec4 = vec4.scale(vec4.create(), ray00_i1, 1 / ray00_i1[3]);
        let ray01_i2: vec4 = vec4.scale(vec4.create(), ray01_i1, 1 / ray01_i1[3]);
        let ray10_i2: vec4 = vec4.scale(vec4.create(), ray10_i1, 1 / ray10_i1[3]);
        let ray11_i2: vec4 = vec4.scale(vec4.create(), ray11_i1, 1 / ray11_i1[3]);

        let ray00: vec3 = vec3.subtract(vec3.create(), vec3.fromValues(ray00_i2[0], ray00_i2[1], ray00_i2[2]), eye)
        let ray01: vec3 = vec3.subtract(vec3.create(), vec3.fromValues(ray01_i2[0], ray01_i2[1], ray01_i2[2]), eye)
        let ray10: vec3 = vec3.subtract(vec3.create(), vec3.fromValues(ray10_i2[0], ray10_i2[1], ray10_i2[2]), eye)
        let ray11: vec3 = vec3.subtract(vec3.create(), vec3.fromValues(ray11_i2[0], ray11_i2[1], ray11_i2[2]), eye)

        gl.uniform3fv(programInfo.tracerProgram.uniformLocations.ray00, ray00);
        gl.uniform3fv(programInfo.tracerProgram.uniformLocations.ray01, ray01);
        gl.uniform3fv(programInfo.tracerProgram.uniformLocations.ray10, ray10);
        gl.uniform3fv(programInfo.tracerProgram.uniformLocations.ray11, ray11);

        let textureWeight: number = sampleCount / (sampleCount + 1);
        gl.uniform1f(programInfo.tracerProgram.uniformLocations.textureWeight, textureWeight);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, ceilingTexture);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures[0]);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures[1], 0);
        gl.vertexAttribPointer(programInfo.tracerProgram.attribLocations.vertex, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        textures.reverse();

        gl.useProgram(programInfo.renderProgram.program);
        gl.bindTexture(gl.TEXTURE_2D, textures[0]);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(programInfo.renderProgram.attribLocations.vertex, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        sampleCount++;

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

function initShaderProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLShader | null {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const shaderProgram = gl.createProgram();
    if (shaderProgram == null || vertexShader == null || fragmentShader == null) {
        return null;
    }
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to link the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }
    return shaderProgram;
}



function loadShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (shader == null) {
        alert('Could not initialze shader of type: ' + type);
        return null;
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('Error encountered during shader compiling: ' + gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

window.onload = main;