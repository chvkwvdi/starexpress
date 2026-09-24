const mobileMenu = document.getElementById("mobileMenu");
const nav = document.getElementById("nav");

document.querySelectorAll('img').forEach(image => {
    image.loading = 'eager';
    image.decoding = 'async';
});

if (mobileMenu && nav) {
    mobileMenu.addEventListener("click", () => {
        nav.classList.toggle("show");
        const icon = mobileMenu.querySelector("i");
        icon.classList.toggle("fa-bars");
        icon.classList.toggle("fa-xmark");
    });

    nav.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => nav.classList.remove("show"));
    });
}

/* Tracking form - keeps the same tracking URL structure as the original page */
const trackingForm = document.getElementById("trackingForm");

if (trackingForm) {
    trackingForm.addEventListener("submit", event => {
        event.preventDefault();

        const code = document.getElementById("trackingCode").value.trim();

        if (!code) return;

        window.location.href =
            "tracking.html?tracking=" +
            encodeURIComponent(code);
    });
}

/* Shipping estimate calculator */
const quoteCalculator = document.getElementById('quoteCalculator');
const quoteResult = document.getElementById('quoteResult');

function calculateQuote() {
    const serviceRates = { land: 20.4, air: 60.8, sea: 18.5 };
    const distanceMultipliers = { local: 1, regional: 21.5, international: 13.5 };
    const weight = Math.max(Number(document.getElementById('quoteWeight')?.value) || 1, 1);
    const service = document.getElementById('quoteService')?.value || 'land';
    const distance = document.getElementById('quoteDistance')?.value || 'local';
    const estimate = Math.max(18, Math.round(weight * serviceRates[service] * distanceMultipliers[distance] + 12));
    if (quoteResult) {
        quoteResult.classList.add('is-updated');
        quoteResult.querySelector('strong').textContent = `$${estimate.toLocaleString()}`;
        setTimeout(() => quoteResult.classList.remove('is-updated'), 350);
    }
}

quoteCalculator?.addEventListener('submit', event => {
    event.preventDefault();
    calculateQuote();
});

quoteCalculator?.querySelectorAll('select, input').forEach(field => {
    field.addEventListener('change', calculateQuote);
    field.addEventListener('input', calculateQuote);
});

calculateQuote();

/* Hero image slider */
const heroSlides = document.querySelectorAll(".hero-slide");
const heroDots = document.querySelectorAll(".hero-dot");
const heroPrev = document.querySelector(".hero-prev");
const heroNext = document.querySelector(".hero-next");
let currentHero = 0;
let heroTimer;

function showHero(index) {
    if (!heroSlides.length) return;

    currentHero = (index + heroSlides.length) % heroSlides.length;

    heroSlides.forEach((slide, i) => {
        slide.classList.toggle("active", i === currentHero);
    });

    heroDots.forEach((dot, i) => {
        dot.classList.toggle("active", i === currentHero);
    });
}

function startHeroAutoPlay() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => showHero(currentHero + 1), 5500);
}

heroDots.forEach(dot => {
    dot.addEventListener("click", () => {
        showHero(Number(dot.dataset.slide));
        startHeroAutoPlay();
    });
});

heroPrev?.addEventListener("click", () => {
    showHero(currentHero - 1);
    startHeroAutoPlay();
});

heroNext?.addEventListener("click", () => {
    showHero(currentHero + 1);
    startHeroAutoPlay();
});

startHeroAutoPlay();

/* Scroll reveal */
const revealItems = document.querySelectorAll(".reveal");

const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12 });

revealItems.forEach(item => revealObserver.observe(item));

/* Animated counters */
const counters = document.querySelectorAll(".counter");

const counterObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const counter = entry.target;
        const target = Number(counter.dataset.target);
        const duration = 1500;
        const start = performance.now();

        function animate(time) {
            const progress = Math.min((time - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            counter.textContent =
                Math.floor(target * eased).toLocaleString();

            if (progress < 1) requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);
        counterObserver.unobserve(counter);
    });
}, { threshold: 0.6 });

counters.forEach(counter => counterObserver.observe(counter));

/* Testimonials */
const testimonials = document.querySelectorAll(".testimonial");
const testimonialPrev = document.querySelector(".testimonial-btn.prev");
const testimonialNext = document.querySelector(".testimonial-btn.next");
let testimonialIndex = 0;

function showTestimonial(index) {
    if (!testimonials.length) return;

    testimonialIndex =
        (index + testimonials.length) % testimonials.length;

    testimonials.forEach((item, i) => {
        item.classList.toggle("active", i === testimonialIndex);
    });
}

testimonialPrev?.addEventListener("click", () => {
    showTestimonial(testimonialIndex - 1);
});

testimonialNext?.addEventListener("click", () => {
    showTestimonial(testimonialIndex + 1);
});

setInterval(() => {
    showTestimonial(testimonialIndex + 1);
}, 7000);

/* FAQ accordion */
document.querySelectorAll(".faq-item button").forEach(button => {
    button.addEventListener("click", () => {
        const item = button.parentElement;

        document.querySelectorAll(".faq-item").forEach(other => {
            if (other !== item) other.classList.remove("open");
        });

        item.classList.toggle("open");

        const icon = button.querySelector("i");
        icon.classList.toggle("fa-plus");
        icon.classList.toggle("fa-minus");
    });
});

/* Back-to-top button */
const backTop = document.getElementById("backTop");

window.addEventListener("scroll", () => {
    backTop?.classList.toggle("show", window.scrollY > 550);
});

backTop?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
});
document.addEventListener('DOMContentLoaded', () => {
    // Since Node.js serves the page, an empty string routes requests cleanly to the same server
    const BACKEND_URL = '';

    const adminLinks = document.querySelectorAll('a[href="/admin-dashboard"], a[href="/admin"]');

    adminLinks.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();

            try {
                const checkRes = await fetch(`${BACKEND_URL}/admin-dashboard`, { 
                    method: 'GET', 
                    credentials: 'include',
                    redirect: 'follow' 
                });
                if (checkRes.ok && checkRes.url.includes('admin')) {
                    window.location.href = `${BACKEND_URL}/admin-dashboard`;
                    return;
                }
            } catch (err) {}

            showAdminModal();
        });
    });

    function showAdminModal() {
        const existing = document.getElementById('custom-admin-modal');
        if (existing) existing.remove();

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'custom-admin-modal';
        modalOverlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.75); display: grid; place-items: center;
            z-index: 99999; backdrop-filter: blur(4px);
        `;

        modalOverlay.innerHTML = `
            <div style="background: #151c24; padding: 35px; border-radius: 10px; width: 100%; max-width: 380px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); border-top: 4px solid #e32626; text-align: center; color: #fff; font-family: 'Segoe UI', Tahoma, sans-serif; box-sizing: border-box;">
                <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 22px;">Admin Portal Access</h3>
                <p style="color: #9aa8b5; font-size: 13px; margin-bottom: 20px;">Enter your backend password to proceed.</p>
                <form id="admin-modal-form">
                    <input type="password" id="admin-password-input" placeholder="Enter Password" required autofocus
                        style="width: 100%; height: 46px; border: 1px solid #28333f; background: #0b0f15; color: #fff; padding: 0 15px; border-radius: 6px; margin-bottom: 15px; outline: none; font-size: 15px; box-sizing: border-box;">
                    <button type="submit"
                        style="width: 100%; height: 46px; background: #e32626; color: #fff; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 15px;">
                        Authenticate
                    </button>
                </form>
                <button id="admin-modal-close" style="background: transparent; border: none; color: #788796; margin-top: 15px; cursor: pointer; font-size: 13px;">Cancel</button>
            </div>
        `;

        document.body.appendChild(modalOverlay);
        const passwordInput = document.getElementById('admin-password-input');
        passwordInput.focus();

        document.getElementById('admin-modal-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = passwordInput.value;

            try {
                const res = await fetch(`${BACKEND_URL}/admin-login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ password })
                });

                const data = await res.json();
                if (data.success) {
                    window.location.href = `${BACKEND_URL}/admin-dashboard`;
                } else {
                    alert(data.message || 'Incorrect Password!');
                    passwordInput.value = '';
                    passwordInput.focus();
                }
            } catch (err) {
                alert('Connection error: Could not reach the server.');
            }
        });

        document.getElementById('admin-modal-close').addEventListener('click', () => modalOverlay.remove());
        modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) modalOverlay.remove(); });
    }
});