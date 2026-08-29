/* ==========================================================================
   ReAlimenta — Áudio (trilha sonora + efeitos sonoros)

   Todos os sons são sintetizados em tempo real via Web Audio API (osciladores
   simples, estilo 8-bit). Não depende de nenhum arquivo de áudio externo,
   então funciona offline e sem custo de licenciamento.

   Preferência de mudo é salva em localStorage e vale para todas as páginas
   (o navegador exige interação do usuário para liberar áudio, então a
   trilha só começa a tocar após o primeiro clique/toque na página).
   ========================================================================== */

(function (window) {
    "use strict";

    const CHAVE_MUDO = "realimenta_audio_mudo";

    let ctx = null;
    let masterGain = null;
    let musicaGain = null;
    let sfxGain = null;
    let musicaAgendada = false;
    let musicaTimeoutId = null;
    let proximoPassoEm = 0;
    let passoAtual = 0;

    function estaMudo() {
        try {
            return window.localStorage.getItem(CHAVE_MUDO) === "1";
        } catch (e) {
            return false;
        }
    }

    function salvarMudo(mudo) {
        try {
            window.localStorage.setItem(CHAVE_MUDO, mudo ? "1" : "0");
        } catch (e) {
            /* localStorage indisponível: apenas ignora, o mudo vale só para esta aba */
        }
    }

    function garantirContexto() {
        if (ctx) return ctx;
        const AudioContextClasse = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClasse) return null;

        ctx = new AudioContextClasse();
        masterGain = ctx.createGain();
        masterGain.gain.value = estaMudo() ? 0 : 1;
        masterGain.connect(ctx.destination);

        musicaGain = ctx.createGain();
        musicaGain.gain.value = 0.11;
        musicaGain.connect(masterGain);

        sfxGain = ctx.createGain();
        sfxGain.gain.value = 0.22;
        sfxGain.connect(masterGain);

        return ctx;
    }

    /**
     * Toca um "blip" simples estilo 8-bit.
     * @param {number} freq frequência inicial em Hz
     * @param {number} duracao duração em segundos
     * @param {OscillatorType} tipo tipo de onda
     * @param {object} opts { freqFinal, volume, atraso }
     */
    function beep(freq, duracao, tipo, opts) {
        if (!ctx || estaMudo()) return;
        opts = opts || {};
        const inicio = ctx.currentTime + (opts.atraso || 0);

        const osc = ctx.createOscillator();
        const ganho = ctx.createGain();
        osc.type = tipo || "square";
        osc.frequency.setValueAtTime(freq, inicio);

        if (opts.freqFinal) {
            osc.frequency.exponentialRampToValueAtTime(
                Math.max(20, opts.freqFinal),
                inicio + duracao
            );
        }

        const vol = opts.volume !== undefined ? opts.volume : 0.5;
        ganho.gain.setValueAtTime(0.0001, inicio);
        ganho.gain.exponentialRampToValueAtTime(vol, inicio + 0.015);
        ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);

        osc.connect(ganho);
        ganho.connect(sfxGain);

        osc.start(inicio);
        osc.stop(inicio + duracao + 0.02);
    }

    const sfx = {
        clique: function () {
            beep(520, 0.07, "square", { volume: 0.35 });
        },
        hover: function () {
            beep(720, 0.035, "square", { volume: 0.12 });
        },
        selecionar: function () {
            beep(440, 0.09, "triangle", { freqFinal: 660, volume: 0.3 });
        },
        acerto: function () {
            if (!ctx || estaMudo()) return;
            [523.25, 659.25, 783.99, 1046.5].forEach(function (freq, i) {
                beep(freq, 0.16, "square", { volume: 0.32, atraso: i * 0.075 });
            });
        },
        erro: function () {
            if (!ctx || estaMudo()) return;
            beep(220, 0.28, "sawtooth", { freqFinal: 90, volume: 0.32 });
        },
        proxima: function () {
            beep(300, 0.06, "square", { freqFinal: 460, volume: 0.28 });
        },
        tick: function () {
            beep(880, 0.045, "square", { volume: 0.12 });
        },
        fimDeJogo: function () {
            if (!ctx || estaMudo()) return;
            [392, 523.25, 659.25, 523.25, 783.99].forEach(function (freq, i) {
                beep(freq, 0.2, "triangle", { volume: 0.34, atraso: i * 0.13 });
            });
        },
        jogar: function () {
            if (!ctx || estaMudo()) return;
            [392, 523.25, 659.25].forEach(function (freq, i) {
                beep(freq, 0.11, "square", { volume: 0.3, atraso: i * 0.06 });
            });
        },
    };

    /* ---------------------------------------------------------------------
       Trilha sonora: um loop curto de arpejo em 8 passos, agendado com
       precisão via AudioContext.currentTime (técnica de "lookahead scheduler").
       ------------------------------------------------------------------- */

    const ESCALA_MUSICA = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 246.94];
    const BPM_MUSICA = 108;
    const DURACAO_PASSO = 60 / BPM_MUSICA / 2;

    function agendarPasso() {
        if (!ctx) return;

        while (proximoPassoEm < ctx.currentTime + 0.15) {
            const freq = ESCALA_MUSICA[passoAtual % ESCALA_MUSICA.length];
            const acentuado = passoAtual % 4 === 0;

            if (!estaMudo()) {
                const osc = ctx.createOscillator();
                const ganho = ctx.createGain();
                osc.type = "triangle";
                osc.frequency.setValueAtTime(freq, proximoPassoEm);

                const vol = acentuado ? 0.5 : 0.3;
                ganho.gain.setValueAtTime(0.0001, proximoPassoEm);
                ganho.gain.exponentialRampToValueAtTime(vol, proximoPassoEm + 0.02);
                ganho.gain.exponentialRampToValueAtTime(
                    0.0001,
                    proximoPassoEm + DURACAO_PASSO * 0.9
                );

                osc.connect(ganho);
                ganho.connect(musicaGain);
                osc.start(proximoPassoEm);
                osc.stop(proximoPassoEm + DURACAO_PASSO);

                // um baixo simples uma oitava abaixo a cada 4 passos
                if (acentuado) {
                    const oscBaixo = ctx.createOscillator();
                    const ganhoBaixo = ctx.createGain();
                    oscBaixo.type = "square";
                    oscBaixo.frequency.setValueAtTime(freq / 4, proximoPassoEm);
                    ganhoBaixo.gain.setValueAtTime(0.0001, proximoPassoEm);
                    ganhoBaixo.gain.exponentialRampToValueAtTime(0.22, proximoPassoEm + 0.02);
                    ganhoBaixo.gain.exponentialRampToValueAtTime(
                        0.0001,
                        proximoPassoEm + DURACAO_PASSO * 3.6
                    );
                    oscBaixo.connect(ganhoBaixo);
                    ganhoBaixo.connect(musicaGain);
                    oscBaixo.start(proximoPassoEm);
                    oscBaixo.stop(proximoPassoEm + DURACAO_PASSO * 4);
                }
            }

            proximoPassoEm += DURACAO_PASSO;
            passoAtual += 1;
        }

        musicaTimeoutId = window.setTimeout(agendarPasso, 100);
    }

    function iniciarMusica() {
        if (!ctx || musicaAgendada) return;
        musicaAgendada = true;
        proximoPassoEm = ctx.currentTime + 0.05;
        passoAtual = 0;
        agendarPasso();
    }

    function pararMusica() {
        musicaAgendada = false;
        if (musicaTimeoutId) {
            window.clearTimeout(musicaTimeoutId);
            musicaTimeoutId = null;
        }
    }

    function aplicarEstadoMudo() {
        const mudo = estaMudo();
        if (masterGain) {
            masterGain.gain.setTargetAtTime(mudo ? 0 : 1, ctx.currentTime, 0.05);
        }
        document.querySelectorAll("[data-botao-mudo]").forEach(function (btn) {
            btn.classList.toggle("audio-mudo", mudo);
            btn.setAttribute("aria-pressed", mudo ? "true" : "false");
            btn.title = mudo ? "Ativar som" : "Silenciar som";
        });
    }

    function alternarMudo() {
        const novoEstado = !estaMudo();
        salvarMudo(novoEstado);
        aplicarEstadoMudo();
        if (!novoEstado) {
            sfx.clique();
        }
    }

    function ativarAoInteragir() {
        const c = garantirContexto();
        if (c && c.state === "suspended") {
            c.resume();
        }
        iniciarMusica();
    }

    function inicializar() {
        aplicarEstadoMudo();

        document.querySelectorAll("[data-botao-mudo]").forEach(function (btn) {
            btn.addEventListener("click", alternarMudo);
        });

        // sons de clique/hover em botões e alternativas (delegação de evento)
        document.addEventListener("click", function (ev) {
            const alvo = ev.target.closest(
                ".btn-neon, .quiz-alternative, [data-som-clique]"
            );
            if (alvo && !alvo.closest("[data-botao-mudo]")) {
                sfx.clique();
            }
        });

        document.addEventListener(
            "mouseover",
            function (ev) {
                const alvo = ev.target.closest(".btn-neon, [data-som-clique]");
                if (alvo && !alvo.closest("[data-botao-mudo]")) {
                    sfx.hover();
                }
            },
            { passive: true }
        );

        const iniciar = function () {
            ativarAoInteragir();
            document.removeEventListener("click", iniciar);
            document.removeEventListener("touchstart", iniciar);
            document.removeEventListener("keydown", iniciar);
        };
        document.addEventListener("click", iniciar);
        document.addEventListener("touchstart", iniciar, { passive: true });
        document.addEventListener("keydown", iniciar);

        // Tenta iniciar a trilha imediatamente ao carregar a página, sem
        // esperar por um novo clique "aleatório". Quando a navegação até
        // aqui partiu de um clique (ex.: botão "Próxima pergunta"), a maioria
        // dos navegadores permite retomar o áudio de imediato porque essa
        // ativação do usuário "atravessa" a navegação. Se o navegador ainda
        // assim bloquear (contexto continua suspenso), os listeners acima
        // ficam como reserva e iniciam tudo no primeiro toque/clique/tecla.
        const c = garantirContexto();
        if (c) {
            const tentarRetomar = c.resume ? c.resume() : Promise.resolve();
            Promise.resolve(tentarRetomar)
                .then(function () {
                    if (c.state === "running") {
                        iniciarMusica();
                    }
                })
                .catch(function () {
                    /* navegador bloqueou: aguarda interação via listeners acima */
                });
        }

        document.addEventListener("visibilitychange", function () {
            if (!ctx) return;
            if (document.hidden) {
                pararMusica();
            } else if (!estaMudo()) {
                iniciarMusica();
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", inicializar);
    } else {
        inicializar();
    }

    window.ReAlimentaAudio = {
        sfx: sfx,
        estaMudo: estaMudo,
        alternarMudo: alternarMudo,
    };
})(window);
