/**
 * Player de animação baseado em GIF (um único arquivo .gif por animação).
 *
 * Por que a troca: o formato anterior carregava várias dezenas de imagens
 * separadas por animação (uma por quadro) e precisava de um "relógio" manual
 * em JS pra saber qual quadro mostrar a cada momento. Isso gerava muitas
 * requisições HTTP só pra essa animação e ficava frágil: bastava faltar um
 * quadro, ou a numeração vir errada, pra animação travar ou "pular".
 * Spritesheet (todos os quadros numa imagem só) já tinha sido tentado antes e
 * também deu problema, porque exige que todo quadro tenha exatamente a mesma
 * largura numa única fileira — qualquer quadro fora do padrão faz a imagem
 * "vazar" um pedaço do quadro errado.
 *
 * Um .gif resolve os dois problemas ao mesmo tempo: é um arquivo só (uma
 * requisição), e quem cuida da ordem e do tempo de cada quadro é o próprio
 * navegador — não tem como desalinhar. O único cuidado é exportar o .gif já
 * no tamanho/qualidade que vai aparecer na tela, já que ele não pode ser
 * redimensionado quadro a quadro como as imagens separadas eram.
 *
 * Estrutura de arquivos esperada (um .gif por animação — sem mais pastas):
 *   static/img/mascote/parado.gif
 *   static/img/mascote/acerto.gif
 *   static/img/mascote/erro.gif
 *
 * Uso manual (mascote, que troca de animação em tempo real — hoje o único
 * ponto do projeto que usa este player):
 *   const player = window.ReAlimentaSprites.criarAnimacaoQuadros(elemento, "/static/img/mascote/parado");
 *   player.trocarPasta("/static/img/mascote/acerto"); // troca de gif e reinicia do quadro 1
 *
 * Uso automático (para qualquer elemento que precise de uma animação fixa,
 * sem trocar de estado — nenhum elemento do projeto usa isso no momento,
 * já que o pódio do ranking voltou a usar ícones estáticos):
 *   <div data-sprite-base="/static/img/alguma-coisa"></div>
 *   (sprites.js inicia sozinho ao carregar a página)
 *
 * Os nomes das funções (criarAnimacaoQuadros/trocarPasta) e o atributo
 * data-sprite-base foram mantidos como estavam de propósito, para não
 * precisar mexer no quiz.js: por dentro, agora eles só apontam o
 * background-image pro arquivo "<base>.gif", sem nenhum passo a passo
 * manual de quadros.
 */
(function (window, document) {
    "use strict";

    /** Monta o caminho do .gif a partir da base (sem extensão). */
    function caminhoDoGif(base) {
        return base.replace(/\/+$/, "") + ".gif";
    }

    function marcarComoVazio(elemento, vazio) {
        if (!elemento) return;
        elemento.classList.toggle("sprite-vazio", vazio);
    }

    /**
     * @param {HTMLElement} elemento elemento que vai exibir a animação (via background-image)
     * @param {string} baseInicial caminho da animação SEM ".gif" no final (ex: ".../mascote/parado")
     */
    function criarAnimacaoQuadros(elemento, baseInicial) {
        let baseAtual = null;

        function desenhar(url) {
            if (!elemento) return;
            elemento.style.backgroundImage = url ? "url('" + url + "')" : "none";
        }

        /** Troca para outra animação (outro .gif) e reinicia a partir do 1º quadro. */
        function trocarPasta(novaBase) {
            if (!novaBase || baseAtual === novaBase) return;
            baseAtual = novaBase;

            const url = caminhoDoGif(novaBase);
            const teste = new Image();
            teste.addEventListener("load", function () {
                marcarComoVazio(elemento, false);
            });
            teste.addEventListener("error", function () {
                marcarComoVazio(elemento, true);
                console.warn(
                    "[ReAlimentaSprites] gif não encontrado: " + url +
                    " — confira se o arquivo \"" + url + "\" existe."
                );
            });
            teste.src = url;

            // Limpa antes de aplicar a nova url: alguns navegadores não reiniciam a
            // animação do .gif do quadro 1 se o valor do background-image não mudar
            // de fato entre um "frame" de renderização e outro.
            desenhar("");
            window.requestAnimationFrame(function () {
                desenhar(url);
            });
        }

        trocarPasta(baseInicial);

        return {
            trocarPasta: trocarPasta,
        };
    }

    function autoIniciar() {
        document.querySelectorAll("[data-sprite-base]").forEach(function (el) {
            if (el._spriteAnim) return;
            const base = el.getAttribute("data-sprite-base");
            if (!base) return;
            el._spriteAnim = criarAnimacaoQuadros(el, base);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", autoIniciar);
    } else {
        autoIniciar();
    }

    window.ReAlimentaSprites = {
        criarAnimacaoQuadros: criarAnimacaoQuadros,
    };
})(window, document);
