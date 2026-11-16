document.addEventListener("DOMContentLoaded", () => {
    const menuToggle = document.querySelector(".menu-toggle");
    const mobileMenu = document.querySelector(".mobile-menu");
    const menuOverlay = document.querySelector(".menu-overlay");
    const menuClose = document.querySelector(".menu-close");

    if (!menuToggle || !mobileMenu || !menuOverlay) return;

    const openMenu = () => {
        mobileMenu.classList.add("active");
        menuOverlay.classList.add("active");
        menuToggle.classList.add("active");
        menuToggle.setAttribute("aria-expanded", "true");
        menuToggle.setAttribute("aria-label", "Fechar menu");
        document.body.style.overflow = "hidden";
    };

    const closeMenu = () => {
        mobileMenu.classList.remove("active");
        menuOverlay.classList.remove("active");
        menuToggle.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Abrir menu");
        document.body.style.overflow = "";
    };

    menuToggle.addEventListener("click", () => {
        mobileMenu.classList.contains("active") ? closeMenu() : openMenu();
    });

    if (menuClose) menuClose.addEventListener("click", closeMenu);
    menuOverlay.addEventListener("click", closeMenu);

    mobileMenu.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeMenu();
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 992) closeMenu();
    });
});