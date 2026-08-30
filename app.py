import os
import time
import random
import html
import uuid
from pathlib import Path

from flask import Flask, render_template, request, session, redirect, url_for, jsonify
import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

# Carrega o .env sempre da pasta do app.py, não importa de onde o script é executado.
load_dotenv(Path(__file__).resolve().parent / ".env")

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY")

DATABASE_URL = os.environ.get("DATABASE_URL")

TOTAL_PERGUNTAS = 10
TEMPO_TOTAL_PARTIDA = 60  # segundos, para a partida inteira
TEMPO_REFERENCIA_RAPIDEZ = 14  # segundos: responder dentro desse tempo dá bônus
BONUS_MAXIMO_POR_ACERTO = 7  # segundos ganhos ao acertar instantaneamente (tempo_gasto ~ 0)
PONTOS_POR_ACERTO = 100
TAMANHO_MAX_APELIDO = 20


# ---------------------------------------------------------------------------
# Banco de dados
# ---------------------------------------------------------------------------

def get_conn():
    """Cria uma nova conexão com o PostgreSQL (Neon)."""
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL não configurada. Defina a variável de ambiente DATABASE_URL."
        )
    return psycopg.connect(DATABASE_URL, row_factory=dict_row, sslmode="require")


def init_db():
    """Cria as tabelas do ReAlimenta caso ainda não existam."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS perguntas (
                    id SERIAL PRIMARY KEY,
                    enunciado TEXT NOT NULL
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS alternativas (
                    id SERIAL PRIMARY KEY,
                    pergunta_id INTEGER NOT NULL REFERENCES perguntas(id) ON DELETE CASCADE,
                    texto TEXT NOT NULL,
                    correta BOOLEAN NOT NULL DEFAULT FALSE,
                    feedback TEXT NOT NULL
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS ranking (
                    id SERIAL PRIMARY KEY,
                    apelido VARCHAR(50) NOT NULL,
                    pontuacao INTEGER NOT NULL,
                    acertos INTEGER NOT NULL,
                    data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            )
            # Migração idempotente: garante que uma mesma partida nunca seja
            # gravada duas vezes no ranking (ex.: cliques repetidos em
            # "Próxima pergunta" na última pergunta geram requisições
            # concorrentes que, sem isso, criavam registros duplicados).
            cur.execute("ALTER TABLE ranking ADD COLUMN IF NOT EXISTS partida_id UUID;")
            cur.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_ranking_partida_id ON ranking(partida_id);"
            )
        conn.commit()


def seed_db():
    """Popula o banco com as perguntas iniciais, caso a tabela esteja vazia."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM perguntas;")
            total = cur.fetchone()["total"]
            if total > 0:
                return False

            script_path = os.path.join(os.path.dirname(__file__), "seed.sql")
            with open(script_path, "r", encoding="utf-8") as f:
                sql = f.read()

            # Sem parâmetros, o psycopg envia a string via protocolo simples,
            # que aceita múltiplas instruções separadas por ";" em uma chamada.
            cur.execute(sql)
        conn.commit()
    return True


@app.cli.command("init-db")
def init_db_command():
    """Comando: flask --app app init-db"""
    init_db()
    print("Tabelas 'perguntas', 'alternativas' e 'ranking' criadas/verificadas com sucesso.")


@app.cli.command("seed-db")
def seed_db_command():
    """Comando: flask --app app seed-db"""
    init_db()
    inserida = seed_db()
    if inserida:
        print("Perguntas iniciais inseridas com sucesso.")
    else:
        print("O banco já possui perguntas cadastradas; nada foi inserido.")


def _garantir_banco():
    """Garante que as tabelas existem antes de operações de leitura/escrita."""
    try:
        init_db()
    except Exception as e:
        app.logger.warning(f"Não foi possível garantir as tabelas: {e}")


# ---------------------------------------------------------------------------
# Lógica da partida
# ---------------------------------------------------------------------------

def sortear_ids_perguntas(quantidade=TOTAL_PERGUNTAS):
    """Sorteia apenas os IDs das perguntas (consulta leve, sem alternativas).

    Guardamos só os IDs na sessão (e não as perguntas inteiras) para o cookie
    de sessão não ultrapassar o limite de 4KB do navegador.
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id FROM perguntas ORDER BY random() LIMIT %s;
                """,
                (quantidade,),
            )
            return [row["id"] for row in cur.fetchall()]


def buscar_pergunta_por_id(pergunta_id):
    """Busca uma única pergunta + alternativas do banco, já embaralhadas."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    p.id AS pergunta_id,
                    p.enunciado,
                    a.id AS alternativa_id,
                    a.texto,
                    a.correta,
                    a.feedback
                FROM perguntas p
                JOIN alternativas a ON a.pergunta_id = p.id
                WHERE p.id = %s
                ORDER BY a.id;
                """,
                (pergunta_id,),
            )
            linhas = cur.fetchall()

    if not linhas:
        return None

    pergunta = {
        "id": pergunta_id,
        "enunciado": linhas[0]["enunciado"],
        "alternativas": [
            {
                "id": linha["alternativa_id"],
                "texto": linha["texto"],
                "correta": linha["correta"],
                "feedback": linha["feedback"],
            }
            for linha in linhas
        ],
    }
    random.shuffle(pergunta["alternativas"])
    return pergunta


def nova_partida(apelido):
    perguntas_ids = sortear_ids_perguntas(TOTAL_PERGUNTAS)
    if len(perguntas_ids) < TOTAL_PERGUNTAS:
        return False

    session["quiz"] = {
        "apelido": apelido,
        "perguntas_ids": perguntas_ids,
        "indice_atual": 0,
        "pontuacao": 0,
        "acertos": 0,
        "erros": 0,
        "tempo_restante": float(TEMPO_TOTAL_PARTIDA),
        # O cronômetro começa PAUSADO (None). Ele só é retomado dentro de
        # /quiz/estado, depois que a primeira pergunta já foi buscada no
        # banco — assim o tempo gasto processando a requisição (incluindo
        # a consulta ao Postgres) não é descontado do jogador antes mesmo
        # de a pergunta aparecer na tela.
        "cronometro_ativo_desde": None,
        "respondida_atual": False,
        "finalizada": False,
        # identifica esta partida de forma única para que, mesmo se o
        # cliente disparar a finalização mais de uma vez (ex.: cliques
        # repetidos), o banco só grave um registro no ranking.
        "partida_id": str(uuid.uuid4()),
    }
    session.modified = True
    return True


def partida_ativa():
    return session.get("quiz")


def calcular_tempo_restante(quiz_data):
    """Calcula o tempo restante considerando se o cronômetro está ativo ou pausado."""
    tempo_restante = quiz_data["tempo_restante"]
    ativo_desde = quiz_data.get("cronometro_ativo_desde")
    if ativo_desde is not None:
        decorrido = time.time() - ativo_desde
        tempo_restante = max(0.0, tempo_restante - decorrido)
    return tempo_restante


def pausar_cronometro(quiz_data):
    """Congela o tempo restante e marca o cronômetro como pausado."""
    quiz_data["tempo_restante"] = calcular_tempo_restante(quiz_data)
    quiz_data["cronometro_ativo_desde"] = None


def retomar_cronometro(quiz_data):
    """Volta a contar o tempo a partir de agora."""
    quiz_data["cronometro_ativo_desde"] = time.time()


def calcular_bonus_rapidez(quiz_data):
    """Calcula o bônus de tempo (em segundos) por responder rápido e corretamente.

    Quanto mais rápido o jogador responder (dentro de TEMPO_REFERENCIA_RAPIDEZ
    segundos), maior o bônus, até BONUS_MAXIMO_POR_ACERTO. Depois desse tempo
    de referência, o bônus é zero.
    """
    inicio = quiz_data.get("cronometro_ativo_desde")
    if inicio is None:
        return 0.0
    tempo_gasto = time.time() - inicio
    tempo_gasto = max(0.0, min(tempo_gasto, TEMPO_REFERENCIA_RAPIDEZ))
    fracao_rapidez = (TEMPO_REFERENCIA_RAPIDEZ - tempo_gasto) / TEMPO_REFERENCIA_RAPIDEZ
    return round(BONUS_MAXIMO_POR_ACERTO * fracao_rapidez, 1)


def finalizar_partida(quiz_data):
    """Salva o resultado no ranking, calcula a posição e prepara os dados de resultado.

    O INSERT usa "ON CONFLICT (partida_id) DO NOTHING" porque a sessão do
    Flask é um cookie assinado no navegador: se o botão de finalizar for
    clicado várias vezes rapidamente, múltiplas requisições concorrentes
    podem chegar ao servidor com o mesmo cookie "antigo" (antes de qualquer
    resposta atualizá-lo). Sem essa proteção, cada uma dessas requisições
    inseriria uma linha idêntica no ranking. Como o partida_id é o mesmo em
    todas elas (foi gerado uma única vez, no início da partida), o banco
    garante que só a primeira seja realmente gravada.
    """
    apelido = quiz_data["apelido"]
    pontuacao = quiz_data["pontuacao"]
    acertos = quiz_data["acertos"]
    partida_id = quiz_data.get("partida_id")

    _garantir_banco()

    posicao = None
    ranking_proximo = []
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ranking (apelido, pontuacao, acertos, partida_id)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (partida_id) DO NOTHING;
                    """,
                    (apelido, pontuacao, acertos, partida_id),
                )
            conn.commit()

            with conn.cursor() as cur:
                cur.execute(
                    """
                    WITH classificado AS (
                        SELECT
                            apelido, pontuacao, acertos, data_registro, partida_id,
                            ROW_NUMBER() OVER (
                                ORDER BY pontuacao DESC, acertos DESC, data_registro ASC
                            ) AS posicao
                        FROM ranking
                    )
                    SELECT posicao FROM classificado WHERE partida_id = %s;
                    """,
                    (partida_id,),
                )
                linha_posicao = cur.fetchone()
                posicao = linha_posicao["posicao"] if linha_posicao else None

            if posicao is not None:
                with conn.cursor() as cur:
                    # Mostra sempre o pódio (1º-3º) e, além dele, uma "vizinhança"
                    # ao redor da posição real do jogador (em vez de sempre o
                    # topo global), para o resultado fazer sentido mesmo quando
                    # o jogador está longe do topo.
                    inicio_vizinhanca = max(1, posicao - 1)
                    fim_vizinhanca = posicao + 1
                    cur.execute(
                        """
                        WITH classificado AS (
                            SELECT
                                apelido, pontuacao, acertos, data_registro,
                                ROW_NUMBER() OVER (
                                    ORDER BY pontuacao DESC, acertos DESC, data_registro ASC
                                ) AS posicao
                            FROM ranking
                        )
                        SELECT apelido, pontuacao, acertos, posicao
                        FROM classificado
                        WHERE posicao <= 3 OR posicao BETWEEN %s AND %s
                        ORDER BY posicao
                        LIMIT 8;
                        """,
                        (inicio_vizinhanca, fim_vizinhanca),
                    )
                    ranking_proximo = cur.fetchall()
    except Exception as e:
        app.logger.error(f"Erro ao salvar partida no ranking: {e}")

    session["ultimo_resultado"] = {
        "apelido": apelido,
        "pontuacao": pontuacao,
        "acertos": acertos,
        "total_perguntas": TOTAL_PERGUNTAS,
        "posicao": posicao,
        "ranking_proximo": ranking_proximo,
    }
    session.pop("quiz", None)
    session.modified = True


# ---------------------------------------------------------------------------
# Rotas de página
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/iniciar", methods=["POST"])
def iniciar():
    apelido = (request.form.get("apelido") or "").strip()
    apelido = html.escape(apelido)[:TAMANHO_MAX_APELIDO]

    if not apelido:
        return render_template(
            "index.html", erro="Digite um apelido para começar a jogar."
        )

    _garantir_banco()
    try:
        seed_db()
    except Exception as e:
        app.logger.warning(f"Não foi possível verificar/inserir perguntas iniciais: {e}")

    sucesso = nova_partida(apelido)
    if not sucesso:
        return render_template(
            "index.html",
            erro="Não há perguntas suficientes cadastradas no banco para iniciar o quiz.",
        )

    return redirect(url_for("quiz"))


@app.route("/quiz")
def quiz():
    quiz_data = partida_ativa()
    if not quiz_data or quiz_data.get("finalizada"):
        return redirect(url_for("index"))
    return render_template(
        "quiz.html",
        apelido=quiz_data["apelido"],
        total_perguntas=TOTAL_PERGUNTAS,
        tempo_total_partida=TEMPO_TOTAL_PARTIDA,
    )


@app.route("/resultado")
def resultado():
    resultado_data = session.get("ultimo_resultado")
    if not resultado_data:
        return redirect(url_for("index"))
    return render_template("resultado.html", resultado=resultado_data)


@app.route("/ranking")
def ranking_page():
    ranking = buscar_ranking(limite=20)
    apelido_atual = None
    resultado_data = session.get("ultimo_resultado")
    if resultado_data:
        apelido_atual = resultado_data.get("apelido")
    return render_template("ranking.html", ranking=ranking, apelido_atual=apelido_atual)


# ---------------------------------------------------------------------------
# API (usada pelo JavaScript)
# ---------------------------------------------------------------------------

@app.route("/quiz/estado")
def quiz_estado():
    """Retorna a pergunta atual, pontuação e tempo restante da partida."""
    quiz_data = partida_ativa()
    if not quiz_data or quiz_data.get("finalizada"):
        return jsonify({"erro": "Nenhuma partida ativa."}), 400

    tempo_restante = calcular_tempo_restante(quiz_data)
    if tempo_restante <= 0 and quiz_data.get("cronometro_ativo_desde") is not None:
        pausar_cronometro(quiz_data)
        session.modified = True
        finalizar_partida(quiz_data)
        return jsonify({"tempo_esgotado": True, "redirect": url_for("resultado")})

    indice = quiz_data["indice_atual"]
    pergunta_id = quiz_data["perguntas_ids"][indice]
    pergunta = buscar_pergunta_por_id(pergunta_id)
    if pergunta is None:
        return jsonify({"erro": "Pergunta não encontrada."}), 400

    # Só agora, com a pergunta já carregada e prestes a ser enviada ao
    # cliente, é que o cronômetro volta a rodar. Se retomássemos antes da
    # consulta ao banco (como em /quiz/proxima), o tempo gasto nessa
    # consulta e na ida-e-volta da rede seria descontado silenciosamente
    # do jogador antes mesmo de a pergunta aparecer na tela, causando o
    # "salto" no relógio.
    if not quiz_data["respondida_atual"] and quiz_data.get("cronometro_ativo_desde") is None:
        retomar_cronometro(quiz_data)
        session.modified = True

    return jsonify(
        {
            "numero": indice + 1,
            "total": TOTAL_PERGUNTAS,
            "enunciado": pergunta["enunciado"],
            "alternativas": [
                {"id": alt["id"], "texto": alt["texto"]} for alt in pergunta["alternativas"]
            ],
            "tempo_restante": round(tempo_restante),
            "pontuacao_atual": quiz_data["pontuacao"],
            "respondida": quiz_data["respondida_atual"],
        }
    )


@app.route("/quiz/responder", methods=["POST"])
def quiz_responder():
    quiz_data = partida_ativa()
    if not quiz_data or quiz_data.get("finalizada"):
        return jsonify({"erro": "Nenhuma partida ativa."}), 400

    if quiz_data["respondida_atual"]:
        return jsonify({"erro": "Pergunta já respondida."}), 400

    tempo_restante = calcular_tempo_restante(quiz_data)
    if tempo_restante <= 0:
        pausar_cronometro(quiz_data)
        session.modified = True
        finalizar_partida(quiz_data)
        return jsonify({"tempo_esgotado": True, "redirect": url_for("resultado")})

    # O bônus de rapidez e a pausa do cronômetro são calculados AGORA, assim
    # que sabemos que a resposta é válida — antes de fazer a consulta ao
    # banco de dados e de interpretar o JSON. Se isso fosse feito depois da
    # consulta (como antes), a latência da consulta ao Postgres seria
    # contabilizada como "tempo que o jogador levou para responder",
    # reduzindo o bônus e descontando tempo do relógio por um motivo que
    # não tem nada a ver com a velocidade real do jogador.
    bonus_tempo = calcular_bonus_rapidez(quiz_data)
    pausar_cronometro(quiz_data)

    dados = request.get_json(silent=True) or {}
    alternativa_id_enviada = dados.get("alternativa_id")

    indice = quiz_data["indice_atual"]
    pergunta_id = quiz_data["perguntas_ids"][indice]
    pergunta = buscar_pergunta_por_id(pergunta_id)
    if pergunta is None:
        return jsonify({"erro": "Pergunta não encontrada."}), 400

    alternativa_escolhida = None
    alternativa_correta = None
    for alt in pergunta["alternativas"]:
        if alt["correta"]:
            alternativa_correta = alt
        try:
            if int(alt["id"]) == int(alternativa_id_enviada):
                alternativa_escolhida = alt
        except (TypeError, ValueError):
            pass

    acertou = bool(alternativa_escolhida and alternativa_escolhida["correta"])

    if acertou:
        quiz_data["pontuacao"] += PONTOS_POR_ACERTO
        quiz_data["acertos"] += 1
        quiz_data["tempo_restante"] += bonus_tempo
    else:
        quiz_data["erros"] += 1
        bonus_tempo = 0.0

    quiz_data["respondida_atual"] = True
    session.modified = True

    feedback_escolhida = alternativa_escolhida["feedback"] if alternativa_escolhida else None

    return jsonify(
        {
            "acertou": acertou,
            "pontos_ganhos": PONTOS_POR_ACERTO if acertou else 0,
            "pontuacao_total": quiz_data["pontuacao"],
            "feedback_escolhida": feedback_escolhida,
            "alternativa_correta": {
                "id": alternativa_correta["id"],
                "texto": alternativa_correta["texto"],
            },
            "dica_sustentavel": alternativa_correta["feedback"],
            "ultima_pergunta": quiz_data["indice_atual"] + 1 >= TOTAL_PERGUNTAS,
            "tempo_restante": round(quiz_data["tempo_restante"]),
            "bonus_tempo": bonus_tempo,
        }
    )


@app.route("/quiz/proxima", methods=["POST"])
def quiz_proxima():
    quiz_data = partida_ativa()
    if not quiz_data or quiz_data.get("finalizada"):
        return jsonify({"erro": "Nenhuma partida ativa."}), 400

    if not quiz_data["respondida_atual"]:
        return jsonify({"erro": "Responda a pergunta atual antes de continuar."}), 400

    quiz_data["indice_atual"] += 1
    quiz_data["respondida_atual"] = False

    if quiz_data["indice_atual"] >= TOTAL_PERGUNTAS or quiz_data["tempo_restante"] <= 0:
        finalizar_partida(quiz_data)
        return jsonify({"finalizada": True, "redirect": url_for("resultado")})

    # O cronômetro permanece pausado aqui de propósito: só volta a rodar em
    # /quiz/estado, quando a próxima pergunta já estiver pronta para ser
    # enviada (ver comentário lá). Isso evita descontar o tempo gasto
    # buscando a próxima pergunta no banco.
    session.modified = True
    return jsonify({"finalizada": False})


@app.route("/quiz/tempo-esgotado", methods=["POST"])
def quiz_tempo_esgotado():
    """Chamado pelo frontend quando o cronômetro local chega a zero.
    O servidor sempre reconfirma o tempo antes de encerrar a partida."""
    quiz_data = partida_ativa()
    if not quiz_data or quiz_data.get("finalizada"):
        return jsonify({"erro": "Nenhuma partida ativa."}), 400

    tempo_restante = calcular_tempo_restante(quiz_data)
    if tempo_restante > 0:
        return jsonify({"tempo_esgotado": False, "tempo_restante": round(tempo_restante)})

    pausar_cronometro(quiz_data)
    session.modified = True
    finalizar_partida(quiz_data)
    return jsonify({"tempo_esgotado": True, "redirect": url_for("resultado")})


def buscar_ranking(limite=20):
    _garantir_banco()
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT apelido, pontuacao, acertos, data_registro
                    FROM ranking
                    ORDER BY pontuacao DESC, acertos DESC, data_registro ASC
                    LIMIT %s;
                    """,
                    (limite,),
                )
                return cur.fetchall()
    except Exception as e:
        app.logger.error(f"Erro ao buscar ranking: {e}")
        return []


# ---------------------------------------------------------------------------
# Execução local
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    try:
        init_db()
        seed_db()
    except Exception as e:
        print(f"Aviso: não foi possível inicializar o banco automaticamente: {e}")
    app.run(debug=True, port=5000)
