const registerControls = (eye: vec3) => {

    const rad = 0.1;
    const keyDownHandler = (event: KeyboardEvent) => {
        if (event.key === 'ArrowUp') {
            eye[2] -= 0.1;
        } else if (event.key === 'ArrowDown') {
            eye[2] += 0.1;
        }
    }

    document.addEventListener('keydown', keyDownHandler, false);
}