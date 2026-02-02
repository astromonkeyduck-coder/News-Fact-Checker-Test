const progressBar = document.getElementById("progress-bar");
const backToTop = document.getElementById("back-to-top");

const updateProgress = () => {
  const doc = document.documentElement;
  const scrollTop = doc.scrollTop || document.body.scrollTop;
  const scrollHeight = doc.scrollHeight - doc.clientHeight;
  const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;

  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }

  if (backToTop) {
    backToTop.classList.toggle("is-visible", scrollTop > 300);
  }
};

window.addEventListener("scroll", () => {
  window.requestAnimationFrame(updateProgress);
});

window.addEventListener("load", updateProgress);

if (backToTop) {
  backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

const searchInput = document.getElementById("post-search");
if (searchInput) {
  const cards = Array.from(document.querySelectorAll(".post-card"));
  searchInput.addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    cards.forEach((card) => {
      const text = card.textContent.toLowerCase();
      card.hidden = query.length > 0 && !text.includes(query);
    });
  });
}

const minionWave = document.getElementById("minionwave");
if (minionWave) {
  minionWave.classList.remove("is-animate");
  window.requestAnimationFrame(() => {
    minionWave.classList.add("is-animate");
  });
  minionWave.addEventListener("animationend", () => {
    minionWave.classList.remove("is-animate");
  });
}
