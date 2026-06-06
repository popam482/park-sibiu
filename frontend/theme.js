(function () {
    const storageKey = "parkSibiuTheme";

    function getStoredTheme() {
        try {
            return localStorage.getItem(storageKey);
        } catch (error) {
            return null;
        }
    }

    function storeTheme(theme) {
        try {
            localStorage.setItem(storageKey, theme);
        } catch (error) {
            // Theme storage is optional; the visual state can still apply for this page.
        }
    }

    function applyTheme(theme, shouldStore) {
        const activeTheme = theme === "dark" ? "dark" : "light";
        const isDark = activeTheme === "dark";

        document.documentElement.dataset.theme = activeTheme;

        if (document.body) {
            document.body.classList.toggle("dark-theme", isDark);
            document.body.classList.toggle("light-theme", !isDark);
        }

        if (shouldStore) {
            storeTheme(activeTheme);
        }

        const toggle = document.getElementById("darkModeToggle");
        if (toggle) {
            toggle.checked = isDark;
        }
    }

    window.applyParkSibiuTheme = function (theme) {
        applyTheme(theme, true);
    };

    applyTheme(getStoredTheme() || "light", false);

    document.addEventListener("DOMContentLoaded", function () {
        applyTheme(getStoredTheme() || "light", false);

        const toggle = document.getElementById("darkModeToggle");
        if (toggle) {
            toggle.addEventListener("change", function () {
                applyTheme(toggle.checked ? "dark" : "light", true);
            });
        }
    });
})();
