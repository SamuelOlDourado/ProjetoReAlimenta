/**
 * Sistema de confete: quando o jogador acerta uma pergunta, algumas cópias de
 * um único PNG estático (confetti.png) caem do topo até o fim da página, em
 * posições horizontais diferentes, balançando bem de leve, criando a
 * sensação de "chuva de confete" em cascata.
 *
 * O confetti.png é uma cena cheia (512×512, fundo transparente, com vários
 * confetes/formas de cores diferentes espalhados dentro da própria imagem).
 * Cada cópia é exibida numa caixa quadrada (mesma proporção da imagem,
 * dimensionada em vmin - ou seja, em relação ao menor lado da tela), bem
 * menor que a tela inteira, pra não ficar "colada"/ampliada demais. O giro é
 * sutil e o instante em que cada cópia começa a cair tem um espaçamento
 * mínimo garantido em relação à anterior (ver ESPACAMENTO_ENTRE_COPIAS_MS),
 * pra elas não caírem grudadas. Quem cuida do movimento é a Web Animations
 * API — nada de calcular frame a frame na mão.
 *
 * Importante: a animação usa "fill: both", não só "forwards". Sem o "both",
 * enquanto uma cópia espera o próprio atraso (delay) pra começar a cair, o
 * navegador mostra o estilo padrão do elemento (ou seja, parado, visível, na
 * posição "crua" do CSS) em vez do primeiro quadro da animação (escondido
 * acima da tela) - é o que fazia uma cópia parecer "travada no meio da
 * tela" antes de só depois começar a descer.
 *
 * Uso: window.ReAlimentaConfete.estourar() dispara uma rajada de confete.
 * Precisa de um elemento no HTML pra servir de "camada":
 *   <div class="confete-camada" id="confete-camada"
 *        data-confete-imagem="/static/img/confetti.png" aria-hidden="true"></div>
 * (ver quiz.html — chamado automaticamente pelo quiz.js a cada acerto)
 */
(function (window, document) {
    "use strict";

    const SELETOR_CAMADA = "#confete-camada";
    const QUANTIDADE_PADRAO = 3;

    // Tamanho de cada cópia, em vmin (% do menor lado da tela) - bem menor
    // que a tela inteira.
    const TAMANHO_MIN_VMIN = 100;
    const TAMANHO_MAX_VMIN = 100;

    // Queda "rápida" (dura pouco), com um balanço bem sutil (bem menos
    // agressivo que um giro de verdade) e um espaçamento mínimo garantido
    // entre o início da queda de uma cópia e da próxima.
    const DURACAO_MIN_MS = 1300;
    const DURACAO_MAX_MS = 2000;
    const ANGULO_MAX_GRAUS = 8;
    const ESPACAMENTO_ENTRE_COPIAS_MS = 400;
    const VARIACAO_ESPACAMENTO_MS = 150;

    function aleatorioEntre(min, max) {
        return min + Math.random() * (max - min);
    }

    function prefereMenosMovimento() {
        return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }

    /**
     * @param {HTMLElement} camada
     * @param {string} caminhoImagem
     * @param {number} atrasoMs instante (em ms, a partir de agora) em que essa cópia começa a cair
     */
    function criarPeca(camada, caminhoImagem, atrasoMs) {
        const img = document.createElement("img");
        img.src = caminhoImagem;
        img.className = "confete-peca";
        img.alt = "";
        img.setAttribute("aria-hidden", "true");

        const tamanhoVmin = aleatorioEntre(TAMANHO_MIN_VMIN, TAMANHO_MAX_VMIN);
        // Posição horizontal sorteada (em % da largura da tela), com uma
        // margem de segurança nas bordas pra cópia não nascer cortada demais.
        const esquerdaPercentual = aleatorioEntre(0, 70);
        const duracaoMs = aleatorioEntre(DURACAO_MIN_MS, DURACAO_MAX_MS);
        const sentidoGiro = Math.random() < 0.5 ? -1 : 1;
        // Balanço leve em torno do "reto": começa quase sem inclinação e só
        // inclina um pouco mais durante a queda - nunca passa de
        // ANGULO_MAX_GRAUS no total, em nenhum dos dois sentidos.
        const anguloInicial = aleatorioEntre(-ANGULO_MAX_GRAUS / 2, ANGULO_MAX_GRAUS / 2);
        const anguloFinal = anguloInicial + sentidoGiro * aleatorioEntre(ANGULO_MAX_GRAUS / 4, ANGULO_MAX_GRAUS / 2);

        img.style.width = tamanhoVmin + "vmin";
        img.style.left = esquerdaPercentual + "%";

        camada.appendChild(img);

        // Translação vertical em "vh" (relativa à altura da TELA, não da
        // própria imagem): assim, mesmo com a caixa bem menor que a tela, a
        // queda sempre começa totalmente acima do topo e só termina
        // totalmente abaixo do fim da página.
        const animacao = img.animate(
            [
                { transform: "translateY(-120vh) rotate(" + anguloInicial + "deg)", opacity: 0 },
                { transform: "translateY(-100vh) rotate(" + anguloInicial + "deg)", opacity: 1, offset: 0.08 },
                { transform: "translateY(120vh) rotate(" + anguloFinal + "deg)", opacity: 1 },
            ],
            {
                duration: duracaoMs,
                delay: atrasoMs,
                easing: "cubic-bezier(0.3, 0.05, 0.4, 1)",
                fill: "both",
            }
        );

        animacao.addEventListener("finish", function () {
            img.remove();
        });
    }

    /** Dispara uma rajada de confete. Não faz nada se o jogador prefere menos
     * movimento na tela, ou se a camada/imagem ainda não estiver configurada. */
    function estourar(opcoes) {
        if (prefereMenosMovimento()) return;

        const camada = document.querySelector(SELETOR_CAMADA);
        if (!camada) return;

        const caminhoImagem = camada.getAttribute("data-confete-imagem");
        if (!caminhoImagem) {
            console.warn(
                "[ReAlimentaConfete] defina o atributo data-confete-imagem no elemento " + SELETOR_CAMADA
            );
            return;
        }

        const quantidade = (opcoes && opcoes.quantidade) || QUANTIDADE_PADRAO;
        for (let i = 0; i < quantidade; i++) {
            // Espaçamento garantido (i * ESPACAMENTO) + uma variação pequena,
            // pra não cair sempre no mesmo ritmo "robótico".
            const atrasoMs = i * ESPACAMENTO_ENTRE_COPIAS_MS + aleatorioEntre(0, VARIACAO_ESPACAMENTO_MS);
            criarPeca(camada, caminhoImagem, atrasoMs);
        }
    }

    window.ReAlimentaConfete = {
        estourar: estourar,
    };
})(window, document);
