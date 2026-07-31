const startConfetti = () => {
    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    Object.assign(canvas.style, {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: '9999'
    });
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#f00', '#0f0', '#00f', '#ff0', '#0ff', '#f0f'];

    function Piece() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height - canvas.height;
        this.w = Math.random() * 10 + 5;
        this.h = Math.random() * 10 + 5;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.vy = Math.random() * 5 + 2;
        this.rot = Math.random() * 360;
        this.rotSpeed = Math.random() * 10 - 5;
    }

    Piece.prototype.update = function () {
        this.y += this.vy;
        this.rot += this.rotSpeed;
        if (this.y > canvas.height) this.y = -10;
    };

    Piece.prototype.draw = function () {
        ctx.fillStyle = this.color;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot * Math.PI / 180);
        ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
        ctx.restore();
    };

    for (let i = 0; i < 200; i++) pieces.push(new Piece());

    function loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(loop);
    }
    loop();
};

window.startConfetti = startConfetti;
