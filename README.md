# 🥦 ReAlimenta

Quiz interativo com foco em **educação sobre desperdício de alimentos**. O jogador digita um apelido, responde 10 perguntas de múltipla escolha contra um cronômetro único de 60 segundos para a partida inteira, recebe feedback específico de cada alternativa (com "Dica Sustentável") e disputa posição em um ranking global.

## Tecnologias utilizadas

- **Python 3** + **Flask** (backend e rotas)
- **PostgreSQL** hospedado no **Neon**
- **psycopg 3** (driver de conexão com o PostgreSQL)
- **python-dotenv** (variáveis de ambiente)
- **Bootstrap 5** via CDN + CSS customizado (tema claro, estilo "gamer" arredondado)
- **HTML + CSS + JavaScript puro** (frontend, sem build step)
- Preparado para **deploy na Vercel**

Sem React/Vue/Node e sem autenticação — apenas sessão do Flask.

## Estrutura do projeto

```
realimenta/
├── app.py
├── requirements.txt
├── vercel.json
├── seed.sql
├── .env
├── templates/
│   ├── index.html
│   ├── quiz.html
│   ├── resultado.html
│   └── ranking.html
└── static/
    ├── css/style.css
    ├── js/quiz.js
    ├── js/sound.js
    └── img/
```

> O schema do banco (tabelas `perguntas`, `alternativas` e `ranking`) não vive em um arquivo `.sql` separado — ele é criado direto pelo comando `flask init-db`, descrito mais abaixo.

## Modelo de dados

```
PERGUNTAS (1) ──< (N) ALTERNATIVAS
RANKING (independente, uma linha por partida finalizada)
```

- `perguntas`: `id`, `enunciado`.
- `alternativas`: `id`, `pergunta_id` (FK), `texto`, `correta` (bool), `feedback` (texto específico daquela alternativa).
- `ranking`: `id`, `apelido`, `pontuacao`, `acertos`, `data_registro`, `partida_id` (UUID único, usado para não duplicar registros).

A "Dica Sustentável" exibida na tela de feedback **reaproveita o campo `alternativas.feedback` da alternativa correta** — não existe uma tabela/coluna separada para isso.

## Como funciona a partida

1. O jogador digita um apelido (até 20 caracteres) na tela inicial.
2. O servidor sorteia 10 perguntas do banco (`ORDER BY random()`), busca as alternativas de cada uma via `JOIN` e embaralha a ordem delas — mas guarda na sessão qual `alternativa_id` é a correta, para nunca confiar no que vem do cliente.
3. A partida tem **um único cronômetro de 60 segundos** para as 10 perguntas, controlado por timestamps no backend: ele pausa quando o jogador responde (para exibir o feedback) e só volta a rodar quando a próxima pergunta já está pronta para ser exibida — assim o tempo gasto consultando o banco nunca é descontado do jogador. Se o tempo chegar a zero, a partida é encerrada automaticamente com a pontuação obtida até aquele momento.
4. Cada acerto vale entre `PONTOS_MINIMOS_POR_ACERTO` (10) e `PONTOS_MAXIMOS_POR_ACERTO` (100) pontos, proporcional à velocidade da resposta — quanto mais rápido (dentro da janela de `TEMPO_REFERENCIA_RAPIDEZ`, 14s), mais pontos. Só errar dá 0 pontos. Acertos rápidos também dão um bônus de tempo de até `BONUS_MAXIMO_POR_ACERTO` (7s), somado de volta ao cronômetro da partida. Todas essas constantes ficam no topo de `app.py`.
5. Ao final (10 perguntas respondidas ou tempo esgotado), a partida é salva na tabela `ranking` e a posição do jogador é calculada.

## Rotas principais

| Rota | Método | Descrição |
|---|---|---|
| `/` | GET | Tela inicial (apelido + botão "Como jogar") |
| `/iniciar` | POST | Cria uma nova partida e redireciona para `/quiz` |
| `/quiz` | GET | Tela do quiz (o estado real vem de `/quiz/estado`) |
| `/quiz/estado` | GET | Pergunta atual, alternativas e tempo restante (JSON) |
| `/quiz/responder` | POST | Registra a resposta escolhida e devolve o feedback (JSON) |
| `/quiz/proxima` | POST | Avança para a próxima pergunta ou finaliza a partida (JSON) |
| `/quiz/tempo-esgotado` | POST | Confirma no servidor se o tempo realmente acabou (JSON) |
| `/resultado` | GET | Tela de resultado da última partida finalizada |
| `/ranking` | GET | Ranking global (pódio + tabela completa) |

## Como instalar e rodar localmente

### 1. Pré-requisitos

- Python 3.10+ instalado
- Uma conta gratuita no [Neon](https://neon.tech) (PostgreSQL serverless) — ou qualquer outro PostgreSQL

### 2. Entrar na pasta do projeto

```bash
cd realimenta
```

### 3. Criar e ativar o ambiente virtual

```bash
python -m venv venv

# Linux/Mac
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 4. Instalar as dependências

```bash
pip install -r requirements.txt
```

### 5. Configurar o `.env`

Crie um arquivo `.env` na raiz do projeto com sua string de conexão e uma chave secreta:

```
DATABASE_URL=postgresql://usuario:senha@ep-exemplo.neon.tech/realimenta?sslmode=require
SECRET_KEY=uma-chave-aleatoria-qualquer
```

### 6. Criar as tabelas e (se necessário) popular as perguntas

```bash
flask --app app init-db
flask --app app seed-db
```

- `init-db` cria as tabelas `perguntas`, `alternativas` e `ranking` (se ainda não existirem).
- `seed-db` insere as 10 perguntas de `seed.sql` — **mas só faz isso se a tabela `perguntas` estiver vazia**, então rodar em um banco que já tem perguntas (como o Neon de produção deste projeto, que já guarda partidas, perguntas, respostas e explicações reais) não tem efeito nenhum. Esse comando existe para deixar qualquer banco novo (um Neon recém-criado, um Postgres local de desenvolvimento etc.) pronto para jogar sem precisar cadastrar perguntas manualmente.

> A aplicação também tenta criar as tabelas e popular as perguntas automaticamente na primeira execução, como segurança extra — mas rodar os comandos manualmente é o caminho recomendado.

### 7. Executar localmente

```bash
python app.py
```

Acesse: **http://localhost:5000**

## Como fazer deploy na Vercel

1. Suba o projeto para um repositório Git, garantindo que o `.env` **não** seja versionado.
2. Crie o banco no Neon (se ainda não criou) e copie a `DATABASE_URL`.
3. Importe o repositório na Vercel — o `vercel.json` já configura o runtime Python apontando para `app.py`.
4. Em **Settings → Environment Variables**, configure `DATABASE_URL` e `SECRET_KEY`.
5. Faça o deploy — a criação das tabelas e o seed acontecem automaticamente na primeira requisição, se necessário.
6. Acesse a URL gerada e jogue.

## Visual

O tema visual é claro e arredondado ("gamer fofo", tons de creme com verde, amarelo e roxo como destaque), implementado em `static/css/style.css`:

- Fontes **Baloo 2** (títulos, pontuação, cronômetro, botões) e **Nunito** (textos mais longos, como perguntas e explicações), carregadas via Google Fonts.
- Cards e botões com bordas arredondadas, sombra sólida deslocada (sem blur) e efeito de "pressionado" ao clicar.
- **Pódio customizado** na tela de ranking: 1º, 2º e 3º lugar em degraus de altura diferente (ouro/prata/bronze), com uma faixa de "quase pódio" destacando o 4º e o 5º lugar. A tabela completa continua abaixo, para consulta de todas as posições.
- Layout responsivo: tipografia fluida (`clamp()`) nos títulos principais, alvos de toque com no mínimo 44px, respeito à área segura de notch/ilha em celulares (no botão de mudo) e ajustes extras de espaçamento para telas bem pequenas (≤380px).

## Áudio: trilha sonora e efeitos sonoros

Todo o áudio do jogo é **sintetizado em tempo real via Web Audio API** em `static/js/sound.js` — não existem arquivos `.mp3`/`.wav` no projeto.

- **Trilha sonora**: um loop curto de arpejo 8-bit tocado em volume baixo, iniciado após a primeira interação do usuário na página (os navegadores bloqueiam áudio automático sem isso).
- **Efeitos sonoros**: clique de botão, hover, seleção de alternativa, acerto, erro, avançar pergunta e "tick" do cronômetro.
- **Botão de mudo**: ícone fixo no canto superior direito em todas as páginas, com a preferência salva em `localStorage` — vale para toda a navegação entre páginas, já que o jogo não é uma SPA.

## Segurança e validação

- O servidor **nunca** confia em resposta, tempo ou pontuação vindos do cliente: a alternativa correta e o tempo restante são sempre recalculados no Flask a partir da sessão e de timestamps do servidor.
- Todas as queries usam parâmetros (`%s`), evitando SQL Injection.
- O apelido é limitado a 20 caracteres e sanitizado (`html.escape`) antes de ser salvo/exibido.
- Cliques repetidos em "Próxima pergunta"/finalizar (ou qualquer requisição concorrente) não geram registros duplicados no ranking: cada partida tem um `partida_id` (UUID) único, com `INSERT ... ON CONFLICT (partida_id) DO NOTHING` — não importa quantas requisições concorrentes cheguem, só a primeira grava uma linha. Isso foi testado disparando 8 requisições de finalização em paralelo para a mesma partida: apenas um registro foi salvo no ranking.
- Tratamento de erros para: sessão/partida inexistente, banco sem perguntas suficientes, resposta duplicada na mesma pergunta e falhas de conexão com o PostgreSQL.
