(function () {
    "use strict";

    const LETRAS = ["A", "B", "C", "D", "E", "F"];

    const elNumeroPergunta = document.getElementById("numero-pergunta");
    const elTempoRestante = document.getElementById("tempo-restante");
    const elBarraTempo = document.getElementById("barra-tempo");
    const elEnunciado = document.getElementById("enunciado");
    const elAlternativas = document.getElementById("alternativas");
    const elPontuacaoAtual = document.getElementById("pontuacao-atual");

    const elTelaPergunta = document.getElementById("tela-pergunta");
    const elFeedbackAcerto = document.getElementById("feedback-acerto");
    const elFeedbackErro = document.getElementById("feedback-erro");

    const elPontosGanhos = document.getElementById("pontos-ganhos");
    const elBonusTempo = document.getElementById("bonus-tempo");
    const elDicaAcerto = document.getElementById("dica-acerto");
    const elExplicacaoErro = document.getElementById("explicacao-erro");
    const elTextoRespostaCorreta = document.getElementById("texto-resposta-correta");
    const elDicaErro = document.getElementById("dica-erro");

    let tempoRestanteLocal = CONFIG.tempoTotalPartida;
    let intervaloTimer = null;
    let respondida = false;
    let enviando = false;
    let redirecionando = false;

    function som(nome) {
        if (window.ReAlimentaAudio && window.ReAlimentaAudio.sfx[nome]) {
            window.ReAlimentaAudio.sfx[nome]();
        }
    }

    function pararTimer() {
        if (intervaloTimer) {
            clearInterval(intervaloTimer);
            intervaloTimer = null;
        }
    }

    function atualizarVisualTempo() {
        elTempoRestante.textContent = tempoRestanteLocal + "s";
        const percentual = Math.max(0, (tempoRestanteLocal / CONFIG.tempoTotalPartida) * 100);
        elBarraTempo.style.width = percentual + "%";

        const critico = tempoRestanteLocal <= 10;
        elTempoRestante.classList.toggle("tempo-critico", critico);
        elBarraTempo.classList.toggle("tempo-critico", critico);
    }

    function iniciarTimer(segundosIniciais) {
        pararTimer();
        tempoRestanteLocal = segundosIniciais;
        atualizarVisualTempo();

        intervaloTimer = setInterval(function () {
            tempoRestanteLocal -= 1;
            if (tempoRestanteLocal <= 0) {
                tempoRestanteLocal = 0;
                atualizarVisualTempo();
                pararTimer();
                notificarTempoEsgotado();
                return;
            }
            if (tempoRestanteLocal <= 10) {
                som("tick");
            }
            atualizarVisualTempo();
        }, 1000);
    }

    function notificarTempoEsgotado() {
        if (redirecionando) return;
        fetch("/quiz/tempo-esgotado", { method: "POST" })
            .then(function (resp) { return resp.json(); })
            .then(function (data) {
                if (data.tempo_esgotado && data.redirect) {
                    som("fimDeJogo");
                    redirecionando = true;
                    window.location.href = data.redirect;
                    return;
                }
                // Diferença de arredondamento entre o relógio local e o servidor: tenta de novo em seguida.
                window.setTimeout(notificarTempoEsgotado, 250);
            })
            .catch(function (err) {
                console.error(err);
                window.setTimeout(notificarTempoEsgotado, 500);
            });
    }

    function esconderFeedbacks() {
        elFeedbackAcerto.classList.add("d-none");
        elFeedbackErro.classList.add("d-none");
        elTelaPergunta.classList.remove("d-none");
    }

    function carregarPergunta() {
        respondida = false;
        enviando = false;
        esconderFeedbacks();
        document.querySelectorAll("[data-proxima]").forEach(function (btn) {
            btn.disabled = false;
        });
        elEnunciado.textContent = "Carregando pergunta...";
        elAlternativas.innerHTML = "";

        fetch("/quiz/estado")
            .then(function (resp) {
                if (!resp.ok) throw new Error("Erro ao buscar estado do quiz");
                return resp.json();
            })
            .then(function (data) {
                if (data.redirect) {
                    som("fimDeJogo");
                    redirecionando = true;
                    window.location.href = data.redirect;
                    return;
                }
                if (data.erro) {
                    window.location.href = "/";
                    return;
                }

                const numeroFormatado = String(data.numero).padStart(2, "0");
                const totalFormatado = String(data.total).padStart(2, "0");
                elNumeroPergunta.textContent = "PERGUNTA " + numeroFormatado + "/" + totalFormatado;
                elEnunciado.textContent = data.enunciado;
                elPontuacaoAtual.textContent = data.pontuacao_atual;

                elAlternativas.innerHTML = "";
                data.alternativas.forEach(function (alt, indice) {
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "quiz-alternative";
                    btn.setAttribute("data-id", alt.id);

                    const letra = document.createElement("span");
                    letra.className = "alternative-letra";
                    letra.textContent = LETRAS[indice] || "?";

                    const texto = document.createElement("span");
                    texto.textContent = alt.texto;

                    btn.appendChild(letra);
                    btn.appendChild(texto);

                    btn.addEventListener("click", function () {
                        if (respondida || enviando) return;
                        enviarResposta(alt.id);
                    });

                    elAlternativas.appendChild(btn);
                });

                iniciarTimer(data.tempo_restante);
            })
            .catch(function (err) {
                console.error(err);
            });
    }

    function enviarResposta(alternativaId) {
        if (respondida || enviando) return;
        enviando = true;
        respondida = true;
        pararTimer();

        fetch("/quiz/responder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ alternativa_id: alternativaId }),
        })
            .then(function (resp) {
                if (!resp.ok) throw new Error("Erro ao enviar resposta");
                return resp.json();
            })
            .then(function (data) {
                if (data.tempo_esgotado && data.redirect) {
                    som("fimDeJogo");
                    redirecionando = true;
                    window.location.href = data.redirect;
                    return;
                }
                som(data.acertou ? "acerto" : "erro");
                mostrarFeedback(data, alternativaId);
                elPontuacaoAtual.textContent = data.pontuacao_total;
                tempoRestanteLocal = data.tempo_restante;
                atualizarVisualTempo();
            })
            .catch(function (err) {
                console.error(err);
                enviando = false;
            });
    }

    function mostrarFeedback(data, idEscolhido) {
        const botoes = elAlternativas.querySelectorAll(".quiz-alternative");
        botoes.forEach(function (btn) {
            btn.disabled = true;
            const idBtn = Number(btn.getAttribute("data-id"));

            if (idBtn === data.alternativa_correta.id) {
                btn.classList.add("correta");
            } else if (idBtn === Number(idEscolhido) && !data.acertou) {
                btn.classList.add("incorreta");
            }
        });

        elTelaPergunta.classList.add("d-none");

        if (data.acertou) {
            elPontosGanhos.textContent = "+" + data.pontos_ganhos + " PONTOS";
            elDicaAcerto.textContent = data.dica_sustentavel;
            elFeedbackAcerto.classList.remove("d-none");

            if (data.bonus_tempo && data.bonus_tempo > 0) {
                elBonusTempo.textContent = "+" + data.bonus_tempo.toFixed(1) + "s DE BÔNUS POR RAPIDEZ";
                elBonusTempo.classList.remove("d-none");
            } else {
                elBonusTempo.classList.add("d-none");
            }
        } else {
            elExplicacaoErro.textContent = data.feedback_escolhida || "";
            elTextoRespostaCorreta.textContent = data.alternativa_correta.texto;
            elDicaErro.textContent = "Dica: " + data.dica_sustentavel;
            elFeedbackErro.classList.remove("d-none");
        }
    }

    let enviandoProxima = false;

    function irParaProxima() {
        if (enviandoProxima) return;
        enviandoProxima = true;

        document.querySelectorAll("[data-proxima]").forEach(function (btn) {
            btn.disabled = true;
        });

        fetch("/quiz/proxima", { method: "POST" })
            .then(function (resp) { return resp.json(); })
            .then(function (data) {
                if (data.erro) {
                    console.error(data.erro);
                    enviandoProxima = false;
                    document.querySelectorAll("[data-proxima]").forEach(function (btn) {
                        btn.disabled = false;
                    });
                    return;
                }
                if (data.finalizada) {
                    som("fimDeJogo");
                    redirecionando = true;
                    window.location.href = data.redirect;
                    return;
                }
                som("proxima");
                enviandoProxima = false;
                carregarPergunta();
            })
            .catch(function (err) {
                console.error(err);
                enviandoProxima = false;
                document.querySelectorAll("[data-proxima]").forEach(function (btn) {
                    btn.disabled = false;
                });
            });
    }

    document.querySelectorAll("[data-proxima]").forEach(function (btn) {
        btn.addEventListener("click", irParaProxima);
    });

    document.addEventListener("DOMContentLoaded", carregarPergunta);
})();
