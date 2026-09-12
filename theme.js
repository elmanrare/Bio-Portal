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

  const forcedTheme = "dark"; // Change this to "light" if you want to force light mode
  setTheme(forcedTheme);

  window.themeController = {
    getTheme,
    setTheme,
    toggleTheme
  };
})();