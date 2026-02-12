const text = "Developed by ybhong1995";
let index = 0;
const element = document.getElementById('developerText');

// 페이드인
requestAnimationFrame(() => {
    requestAnimationFrame(() => {
        document.body.style.opacity = '1';
    });
});

function typeText() {
    if (index < text.length) {
        element.textContent += text[index];
        index++;
        setTimeout(typeText, 40);
    }
}

setTimeout(typeText, 2100);

// 페이드아웃 후 전환
setTimeout(() => {
    document.body.style.opacity = '0';
    setTimeout(() => {
        window.api.goToUpdate();
    }, 800);
}, 5600);