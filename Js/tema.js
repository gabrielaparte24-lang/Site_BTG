(function () {
    var chave = "tema";
    var tema = null;
    try { tema = localStorage.getItem(chave); } catch (e) {}
    if (tema !== "claro" && tema !== "escuro") {
        tema = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "escuro" : "claro";
    }
    document.documentElement.setAttribute("data-tema", tema);

    window.temaAtual = function () { return document.documentElement.getAttribute("data-tema"); };
    window.rotuloTema = function () { return window.temaAtual() === "escuro" ? "☀ Modo claro" : "☾ Modo escuro"; };
    window.alternarTema = function () {
        var novo = window.temaAtual() === "escuro" ? "claro" : "escuro";
        document.documentElement.setAttribute("data-tema", novo);
        try { localStorage.setItem(chave, novo); } catch (e) {}
        return novo;
    };
})();
