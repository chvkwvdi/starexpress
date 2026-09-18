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
    const serviceRates = { land: 2.4, air: 6.8, sea: 1.7 };
    const distanceMultipliers = { local: 1, regional: 1.45, international: 2.25 };
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
    backTop?.classList.toggle("show", window.scrollY > 600);
});

backTop?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
});
