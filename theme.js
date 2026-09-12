(() => {
  const storageKey = "elman-theme";

  function getTheme() {
    return document.documentElement.dataset.theme || "light";
  }

  function setTheme(theme) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    localStorage.setItem(storageKey, nextTheme);
    return nextTheme;
  }

  function toggleTheme() {
    return setTheme(getTheme() === "dark" ? "light" : "dark");
  }

  const defaultTheme = "dark"; // Initial theme used when the visitor has no saved preference
  const savedTheme = localStorage.getItem(storageKey);
  setTheme(savedTheme === "light" || savedTheme === "dark" ? savedTheme : defaultTheme);

  window.themeController = {
    getTheme,
    setTheme,
    toggleTheme
  };
})();
