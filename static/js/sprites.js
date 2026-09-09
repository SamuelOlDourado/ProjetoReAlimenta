/**
 * Player de animação por quadros individuais (24 imagens numeradas por animação).
 *
 * Por que não usar spritesheet: exigiria que todos os quadros tivessem exatamente
 * a mesma largura e estivessem em uma única fileira, o que é fácil de errar sem
 * querer (grade em vez de fileira, quadro faltando, etc.) e o resultado fica
 * "quebrado" (pedaços de quadros diferentes aparecendo juntos). Com arquivos
 * separados, cada quadro é uma imagem inteira e independente: não tem como dar
 * esse tipo de erro de alinhamento.
 *
 * Estrutura de pastas esperada (uma pasta por animação, com os 24 quadros dentro):
 *   static/img/mascote/parado/frame01.png ... frame24.png
 *   static/img/mascote/acerto/frame01.png ... frame24.png
 *   static/img/mascote/erro/frame01.png ... frame24.png
 *   static/img/ranking/top1/frame01.png ... frame24.png
 *   static/img/ranking/top2/frame01.png ... frame24.png
 *   static/img/ranking/top3/frame01.png ... frame24.png
 *
 * Uso manual (ex: mascote, que precisa trocar de animação em tempo real):
 *   const player = window.ReAlimentaSprites.criarAnimacaoQuadros(elemento, pasta);
 *   player.trocarPasta(outraPasta);
 *
 * Uso automático (ex: avatares do ranking, que nunca trocam de animação):
 *   <div data-sprite-base="/static/img/ranking/top1"></div>
 *   (sprites.js já inicia sozinho ao carregar a página)
 */
(function (window, document) {
    "use strict";

    function numeroComZeros(indice, digitos) {
        return String(indice + 1).padStart(digitos, "0");
    }

    function caminhoDoQuadro(pastaBase, indice, opcoes) {
        const base = pastaBase.replace(/\/+$/, "");
        const numero = numeroComZeros(indice, opcoes.digitos);
        return base + "/" + opcoes.prefixo + numero + "." + opcoes.extensao;
    }

    /**
     * @param {HTMLElement} elemento elemento que vai exibir a animação (via background-image)
     * @param {string} pastaInicial pasta com os 24 quadros dessa animação
     * @param {object} [opcoes]
     * @param {number} [opcoes.frames=24] quantidade de quadros
     * @param {number} [opcoes.fps=12] velocidade da animação
     * @param {string} [opcoes.prefixo="frame"] prefixo do nome do arquivo
     * @param {string} [opcoes.extensao="png"] extensão do arquivo
     * @param {number} [opcoes.digitos=2] dígitos do número (frame01 = 2 dígitos)
     */
    function criarAnimacaoQuadros(elemento, pastaInicial, opcoes) {
        opcoes = Object.assign(
            { frames: 24, fps: 12, prefixo: "frame", extensao: "png", digitos: 2 },
            opcoes || {}
        );

        let quadroAtual = 0;
        let intervaloId = null;
        let imagens = [];
        let pastaAtual = null;

        function desenharQuadroAtual() {
            const img = imagens[quadroAtual];
            if (!elemento || !img) return;
            elemento.style.backgroundImage = "url('" + img.src + "')";
        }

        function marcarComoVazio(vazio) {
            if (!elemento) return;
            elemento.classList.toggle("sprite-vazio", vazio);
        }

        function precarregarPasta(pasta) {
            const lista = [];
            for (let i = 0; i < opcoes.frames; i++) {
                const img = new Image();
                if (i === 0) {
                    // Usa só o 1º quadro para detectar se a pasta existe/tem imagem,
                    // evitando repetir o aviso 24 vezes.
                    img.addEventListener("load", function () {
                        marcarComoVazio(false);
                    });
                    img.addEventListener("error", function () {
                        marcarComoVazio(true);
                        console.warn(
                            "[ReAlimentaSprites] imagem não encontrada: " + img.src +
                            " — confira se a pasta \"" + pasta + "\" existe e contém " +
                            "frame01." + opcoes.extensao + " até frame" +
                            numeroComZeros(opcoes.frames - 1, opcoes.digitos) + "." + opcoes.extensao
                        );
                    });
                }
                img.src = caminhoDoQuadro(pasta, i, opcoes);
                lista.push(img);
            }
            return lista;
        }

        function tocar() {
            parar();
            intervaloId = window.setInterval(function () {
                quadroAtual = (quadroAtual + 1) % opcoes.frames;
                desenharQuadroAtual();
            }, 1000 / opcoes.fps);
        }

        function parar() {
            if (intervaloId) {
                window.clearInterval(intervaloId);
                intervaloId = null;
            }
        }

        /** Troca para outra animação (outra pasta de 24 quadros) e reinicia do quadro 1. */
        function trocarPasta(novaPasta) {
            if (pastaAtual === novaPasta) return;
            pastaAtual = novaPasta;
            quadroAtual = 0;
            imagens = precarregarPasta(novaPasta);
            desenharQuadroAtual();
            tocar();
        }

        trocarPasta(pastaInicial);

        return {
            trocarPasta: trocarPasta,
            parar: parar,
            tocar: tocar,
        };
    }

    function autoIniciar() {
        document.querySelectorAll("[data-sprite-base]").forEach(function (el) {
            if (el._spriteAnim) return;
            const pasta = el.getAttribute("data-sprite-base");
            if (!pasta) return;
            const opcoes = {
                frames: parseInt(el.getAttribute("data-sprite-frames"), 10) || 24,
                fps: parseInt(el.getAttribute("data-sprite-fps"), 10) || 12,
            };
            el._spriteAnim = criarAnimacaoQuadros(el, pasta, opcoes);
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
