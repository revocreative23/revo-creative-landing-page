// =========================================================================
// i18n — Internationalization (EN default, ID for Indonesian browsers)
// Static HTML is in Indonesian; engine swaps to English when needed.
// Selection is sticky via localStorage; auto-detect runs on first visit only.
// =========================================================================
const I18N = (() => {
  const STORAGE_KEY = "revo_lang";
  const SUPPORTED = ["en", "id"];
  const DEFAULT_LANG = "en";
  let currentLang = null;
  let dictionary = null;

  const detectInitialLang = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
    const browser = (navigator.language || "").toLowerCase();
    if (browser.startsWith("id")) return "id";
    return DEFAULT_LANG;
  };

  const resolveKey = (obj, path) =>
    path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);

  const applyAll = (dict) => {
    // Text content via data-i18n="key.path"
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const value = resolveKey(dict, el.getAttribute("data-i18n"));
      if (typeof value === "string") {
        if (el.hasAttribute("data-i18n-html")) el.innerHTML = value;
        else el.textContent = value;
      }
    });
    // Attribute translations via data-i18n-attr="attrName:key.path"
    // e.g. data-i18n-attr="placeholder:contact.form.email"
    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.getAttribute("data-i18n-attr").split("|").forEach((entry) => {
        const [attr, key] = entry.split(":");
        if (!attr || !key) return;
        const value = resolveKey(dict, key.trim());
        if (typeof value === "string") el.setAttribute(attr.trim(), value);
      });
    });
    // <html lang>
    document.documentElement.lang = currentLang;
  };

  const updateSwitcherUI = () => {
    document.querySelectorAll(".lang-switch [data-lang]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === currentLang);
      btn.setAttribute("aria-pressed", btn.dataset.lang === currentLang ? "true" : "false");
    });
  };

  const load = async (lang) => {
    try {
      const res = await fetch(`i18n/${lang}.json`, { cache: "no-cache" });
      if (!res.ok) throw new Error(`Failed to load ${lang}.json`);
      return await res.json();
    } catch (err) {
      console.warn("[i18n] failed to load", lang, err);
      return null;
    }
  };

  const setLang = async (lang) => {
    if (!SUPPORTED.includes(lang)) return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    updateSwitcherUI();
    // Static HTML is in Indonesian; only fetch+apply when switching to non-ID.
    // For ID we still try to load so any data-i18n="key" without static fallback works.
    dictionary = await load(lang);
    if (dictionary) applyAll(dictionary);
  };

  const init = () => {
    currentLang = detectInitialLang();
    updateSwitcherUI();
    // Wire up switcher
    document.querySelectorAll(".lang-switch [data-lang]").forEach((btn) => {
      btn.addEventListener("click", () => setLang(btn.dataset.lang));
    });
    // Apply translations (skip fetch if EN is default but static is ID — we still need EN dict)
    setLang(currentLang);
  };

  return { init, setLang, get current() { return currentLang; } };
})();

I18N.init();

// Navbar — scroll state (transparent dark → solid white once scrolled past hero)
const navbarEl = document.querySelector(".navbar");
if (navbarEl) {
  const SCROLL_THRESHOLD = 80;
  const updateNavbarState = () => {
    if (window.scrollY > SCROLL_THRESHOLD) {
      navbarEl.classList.add("scrolled");
    } else {
      navbarEl.classList.remove("scrolled");
    }
  };
  window.addEventListener("scroll", updateNavbarState, { passive: true });
  updateNavbarState();
}

// Navbar — mobile toggle
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    navToggle.classList.toggle("active");
    navLinks.classList.toggle("open");
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navToggle.classList.remove("active");
      navLinks.classList.remove("open");
    });
  });
}

// Highlight active nav link based on page
const navAnchors = document.querySelectorAll(".nav-links a");
const path = window.location.pathname.split("/").pop() || "index.html";
navAnchors.forEach((a) => {
  const href = a.getAttribute("href");
  if (!href) return;
  if (href === path || (path === "" && href === "index.html")) {
    a.classList.add("active");
  }
});

// Reveal on scroll
const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && revealItems.length) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealItems.forEach((el) => io.observe(el));
}

// Portfolio filter
const filters = document.querySelectorAll(".filter-pill");
const portfolioItems = document.querySelectorAll(".portfolio-card");

filters.forEach((pill) => {
  pill.addEventListener("click", () => {
    filters.forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    const cat = pill.dataset.filter;
    portfolioItems.forEach((card) => {
      const cardCat = card.dataset.category;
      if (cat === "all" || cardCat === cat) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });
  });
});

// Contact form (front-end only stub)
const contactForm = document.querySelector(".contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const success = contactForm.querySelector(".form-success");
    if (success) {
      success.classList.add("show");
      contactForm.reset();
      setTimeout(() => success.classList.remove("show"), 5000);
    }
  });
}

// Products carousel — auto-rotating
const productsCarousel = document.querySelector(".products-carousel");
if (productsCarousel) {
  const track = productsCarousel.querySelector(".products-track");
  const slides = productsCarousel.querySelectorAll(".product-slide");
  const dots = productsCarousel.querySelectorAll(".carousel-dot");
  const prevBtn = productsCarousel.querySelector(".carousel-arrow.prev");
  const nextBtn = productsCarousel.querySelector(".carousel-arrow.next");
  const total = slides.length;
  const ROTATE_MS = 5000;
  let current = 0;
  let timer = null;

  const goTo = (index) => {
    current = (index + total) % total;
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle("active", i === current));
  };

  const next = () => goTo(current + 1);
  const prev = () => goTo(current - 1);

  const start = () => {
    stop();
    timer = setInterval(next, ROTATE_MS);
  };
  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  nextBtn && nextBtn.addEventListener("click", () => { next(); start(); });
  prevBtn && prevBtn.addEventListener("click", () => { prev(); start(); });
  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      goTo(parseInt(dot.dataset.slide, 10));
      start();
    });
  });

  // Pause on hover (desktop)
  productsCarousel.addEventListener("mouseenter", stop);
  productsCarousel.addEventListener("mouseleave", start);

  // Pause when tab not visible — avoids drift
  document.addEventListener("visibilitychange", () => {
    document.hidden ? stop() : start();
  });

  // Touch swipe (mobile)
  let touchStartX = 0;
  track.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
    stop();
  }, { passive: true });
  track.addEventListener("touchend", (e) => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(diff) > 40) diff > 0 ? prev() : next();
    start();
  }, { passive: true });

  start();
}

// Back-to-top floating button
const backToTopBtn = document.querySelector(".back-to-top");
if (backToTopBtn) {
  const SHOW_AFTER = 400;
  const updateBackToTopState = () => {
    if (window.scrollY > SHOW_AFTER) {
      backToTopBtn.classList.add("visible");
    } else {
      backToTopBtn.classList.remove("visible");
    }
  };
  window.addEventListener("scroll", updateBackToTopState, { passive: true });
  updateBackToTopState();

  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// Year in footer
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
