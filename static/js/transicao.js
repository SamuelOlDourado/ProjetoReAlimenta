/**
 * Transição de tela compartilhada por todas as páginas do ReAlimenta.
 *
 * Cada página precisa ter no <body>:
 *   <div class="transicao-tela" id="transicao-tela" aria-hidden="true"></div>
 *
 * Comportamento:
 * - Ao carregar qualquer página, a cortina preta (já visível, cobrindo tudo)
 *   se abre de cima para baixo, revelando o conteúdo ("transicao-abrindo").
 * - Ao clicar em qualquer link interno normal (<a href="...">), a cortina
 *   fecha começando no topo e descendo até cobrir a tela ("transicao-fechando")
 *   antes da navegação de fato acontecer.
 * - Páginas com fluxo próprio (ex: o formulário "JOGAR" do index, ou o
 *   carregamento de perguntas via AJAX no quiz) chamam manualmente
 *   window.ReAlimentaTransicao.fecharTelaEDepois(...) e
 *   window.ReAlimentaTransicao.abrirTela() nos momentos certos.
 */
(function (window, document) {
    "use strict";

    const DURACAO_MS = 480;

    function overlay() {
        return document.getElementById("transicao-tela");
    }

    function abrirTela() {
        const el = overlay();
        if (!el) return;
        el.classList.remove("transicao-fechando");
        // Garante que a cortina comece fechada (cobrindo tudo) antes de animar a abertura.
        el.style.transform = "scaleY(1)";
        // Força o navegador a "perceber" o estado acima antes de trocar de classe,
        // senão a transição para "abrindo" não roda.
        // eslint-disable-next-line no-unused-expressions
        el.offsetHeight;
        el.style.transform = "";
        el.classList.add("transicao-abrindo");
    }

    function fecharTelaEDepois(callback, duracaoMs) {
        const el = overlay();
        if (!el) {
            callback();
            return;
        }
        el.classList.remove("transicao-abrindo");
        el.style.transform = "";
        el.classList.add("transicao-fechando");
        window.setTimeout(callback, duracaoMs || DURACAO_MS);
    }

    function ehNavegacaoNormal(link, evento) {
        if (evento.defaultPrevented) return false;
        if (evento.button !== 0) return false;
        if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return false;
        if (link.target && link.target !== "" && link.target !== "_self") return false;
        if (link.hasAttribute("data-sem-transicao")) return false;
        if (link.hasAttribute("download")) return false;

        const href = link.getAttribute("href");
        if (!href || href.charAt(0) === "#") return false;
        if (href.indexOf("mailto:") === 0 || href.indexOf("tel:") === 0) return false;

        return true;
    }

    function iniciar() {
        // Ao abrir a página, a cortina (que começa cobrindo tudo) se abre de cima pra baixo.
        abrirTela();

        // Intercepta links internos normais para fechar a cortina antes de navegar.
        document.querySelectorAll("a[href]").forEach(function (link) {
            link.addEventListener("click", function (ev) {
                if (!ehNavegacaoNormal(link, ev)) return;
                ev.preventDefault();
                const destino = link.href;
                fecharTelaEDepois(function () {
                    window.location.href = destino;
                });
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }

    window.ReAlimentaTransicao = {
        abrirTela: abrirTela,
        fecharTelaEDepois: fecharTelaEDepois,
    };
})(window, document);
