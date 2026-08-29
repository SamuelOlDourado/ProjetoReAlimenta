# 🥦 ReAlimenta

Quiz interativo com foco em **educação sobre desperdício de alimentos**. O jogador digita um apelido, responde perguntas de múltipla escolha com um cronômetro único de 60 segundos para toda a partida, recebe feedback específico de cada alternativa (com "Dica Sustentável") e disputa posição em um ranking global.

## Tecnologias utilizadas

- **Python 3** + **Flask** (backend e rotas)
- **PostgreSQL** hospedado no **Neon**
- **psycopg 3** (driver de conexão com o PostgreSQL)
- **python-dotenv** (variáveis de ambiente)
- **Bootstrap 5** via CDN + CSS customizado (tema escuro/neon)
- **HTML + CSS + JavaScript puro** (frontend)
- Preparado para **deploy na Vercel**

Sem React/Vue/Node e sem autenticação — apenas sessão do Flask.

## Estrutura do projeto

```
realimenta/
├── app.py
├── requirements.txt
├── vercel.json
├── schema.sql
├── seed.sql
├── .env
├── .env.example
├── .gitignore
├── templates/
│   ├── index.html
│   ├── quiz.html
│   ├── resultado.html
│   └── ranking.html
└── static/
    ├── css/style.css
    └── js/quiz.js
```

## Modelo de dados

```
PERGUNTAS (1) ──< (N) ALTERNATIVAS
RANKING (independente, uma linha por partida finalizada)
```

- `perguntas`: `id`, `enunciado`.
- `alternativas`: `id`, `pergunta_id` (FK), `texto`, `correta` (bool), `feedback` (texto específico daquela alternativa).
- `ranking`: `id`, `apelido`, `pontuacao`, `acertos`, `data_registro`.

A "Dica Sustentável" exibida na tela de feedback **reaproveita o campo `alternativas.feedback` da alternativa correta** — não existe uma tabela/coluna separada para isso, evitando alterar o schema sem necessidade.

## Como funciona a partida

1. O jogador digita um apelido na tela inicial.
2. O servidor sorteia 10 perguntas do banco (com `ORDER BY random()`), busca as alternativas de cada uma via `JOIN` e embaralha a ordem das alternativas — mas guarda na sessão qual `alternativa_id` é a correta.
3. A partida tem **um único cronômetro de 60 segundos**, controlado por timestamps no backend: ele pausa quando o jogador responde (para exibir o feedback) e retoma quando clica em "Próxima pergunta". Se chegar a zero, a partida é encerrada automaticamente, salvando a pontuação obtida até aquele momento.
4. Cada acerto vale `PONTOS_POR_ACERTO = 100` (constante fácil de alterar em `app.py`).
5. Ao final (10 perguntas respondidas ou tempo esgotado), a partida é salva na tabela `ranking`, a posição é calculada e o jogador vê o resultado.

## Como instalar e rodar localmente

### 1. Pré-requisitos

- Python 3.10+ instalado
- Uma conta gratuita no [Neon](https://neon.tech) (PostgreSQL serverless)

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

```bash
cp .env.example .env
```

Edite o `.env` com sua string de conexão do Neon e uma chave secreta:

```
DATABASE_URL=postgresql://usuario:senha@ep-exemplo.neon.tech/realimenta?sslmode=require
SECRET_KEY=uma-chave-aleatoria-qualquer
```

### 6. Criar as tabelas e popular as perguntas

```bash
flask --app app init-db
flask --app app seed-db
```

- `init-db` cria as tabelas `perguntas`, `alternativas` e `ranking`.
- `seed-db` insere as 10 perguntas iniciais sobre desperdício de alimentos (só insere se a tabela `perguntas` estiver vazia).

> A aplicação também tenta criar as tabelas e popular as perguntas automaticamente na primeira execução/deploy, como segurança extra — mas rodar os comandos manualmente é o caminho recomendado.

### 7. Executar localmente

```bash
python app.py
```

Acesse: **http://localhost:5000**

## Como fazer deploy na Vercel

1. Suba o projeto para um repositório Git, garantindo que o `.env` **não** seja versionado (já está no `.gitignore`).
2. Crie o banco no Neon (se ainda não criou) e copie a `DATABASE_URL`.
3. Importe o repositório na Vercel — o `vercel.json` já configura o runtime Python (`@vercel/python`) apontando para `app.py`.
4. Em **Settings → Environment Variables**, configure:
   - `DATABASE_URL`
   - `SECRET_KEY`
5. Faça o deploy. Depois do primeiro deploy, rode `schema.sql` e `seed.sql` no SQL Editor do Neon (ou confie na criação/seed automáticos na primeira requisição).
6. Acesse a URL gerada e jogue.

## Visual "gamer" / pixel art

O tema visual foi reforçado com uma camada adicional em `static/css/style.css` (seção "Pixel Art / Gamer", no final do arquivo), sem alterar nenhuma classe usada pelo JavaScript ou pela lógica de páginas:

- Fonte pixelada **"Press Start 2P"** (Google Fonts) para títulos, pontuação, cronômetro e botões; a fonte de leitura (`Share Tech Mono`) foi mantida para textos mais longos (perguntas, explicações, dicas), para não prejudicar a legibilidade.
- Cantos "denteados" estilo 8-bit (via `clip-path`) em painéis, cards, alternativas e botões, com sombra sólida deslocada (sem blur) para simular UI de jogo retrô.
- Cursor do mouse customizado (seta pixelada em SVG embutido no CSS — sem arquivo externo) e um cursor diferente ao passar sobre elementos clicáveis.
- Barra de rolagem estilizada (Chrome/Edge via `::-webkit-scrollbar`, Firefox via `scrollbar-color`).
- Leve efeito de "scanline" no fundo, sutil, para reforçar o clima retrô sem prejudicar a leitura.
- **Pódio customizado** na tela de ranking: 1º, 2º e 3º lugar em degraus de altura diferente (ouro/prata/bronze), com coroa/medalhas, e uma faixa de "quase pódio" destacando o 4º e o 5º lugar. A tabela completa continua abaixo, para consulta de todas as posições.

Nenhum arquivo de imagem/sprite novo foi criado (a imagem de referência enviada foi usada só como inspiração de paleta/composição) — tudo é gerado via CSS puro, então continua leve e fácil de hospedar.

## Áudio: trilha sonora e efeitos sonoros

Todo o áudio do jogo é **sintetizado em tempo real via Web Audio API** em `static/js/sound.js` — não existem arquivos `.mp3`/`.wav` no projeto. Isso significa:

- Nenhuma dependência externa, nenhum peso extra de download, funciona em qualquer navegador moderno e não tem questão de licenciamento de som.
- **Trilha sonora**: um loop curto de arpejo 8-bit (melodia + graves), tocado em volume baixo, iniciado automaticamente após o primeiro clique/toque na página (os navegadores bloqueiam áudio automático sem interação do usuário).
- **Efeitos sonoros**: clique de botão, hover, seleção de alternativa, acerto (arpejo ascendente), erro (tom descendente), avançar pergunta, "tick" nos últimos 10 segundos do cronômetro, e uma pequena fanfarra ao concluir a partida.
- **Botão de mudo**: ícone 🔊/🔇 fixo no canto superior direito em todas as páginas (`data-botao-mudo` em `sound.js`), com a preferência salva em `localStorage` — vale para toda a navegação entre páginas, já que o jogo não é uma SPA.

Se quiser trocar por músicas/efeitos reais no futuro, basta substituir as chamadas em `sound.js` por elementos `<audio>` apontando para arquivos em `static/audio/` — a estrutura de chamadas (`sfx.acerto()`, `sfx.erro()` etc.) já está isolada nesse único arquivo.

## Mecânica de bônus de tempo

O bônus de tempo por rapidez (implementado em `app.py`) foi ajustado para dar um pouco mais de folga sem facilitar demais:

| Constante | Valor anterior | Valor atual |
|---|---|---|
| `TEMPO_REFERENCIA_RAPIDEZ` (janela para ganhar bônus) | 10s | 14s |
| `BONUS_MAXIMO_POR_ACERTO` (bônus máximo por acerto rápido) | 5s | 7s |

O bônus continua decrescendo linearmente até zero conforme o tempo de resposta se aproxima do limite da janela — só o teto e a janela ficaram um pouco mais generosos. Ambas as constantes continuam fáceis de reajustar no topo de `app.py`.

## Segurança e validação

> **Correção importante:** cliques repetidos em "Próxima pergunta"/finalizar (ou qualquer outra causa de requisições concorrentes) não geram mais registros duplicados no ranking. Como a sessão do Flask é um cookie assinado no navegador, requisições quase simultâneas podem chegar ao servidor com o mesmo cookie "antigo" antes de qualquer resposta atualizá-lo — cada uma delas achava que era a finalização legítima da partida. A correção usa um `partida_id` (UUID) gerado uma única vez no início de cada partida e um índice único na coluna `ranking.partida_id`, com `INSERT ... ON CONFLICT (partida_id) DO NOTHING`: não importa quantas requisições concorrentes cheguem, o banco garante que só a primeira grave uma linha. Rode `flask --app app init-db` (ou o `schema.sql`) após atualizar para aplicar essa migração — ela é segura mesmo em bancos já existentes.

> **Resumo do ranking na tela de resultado:** a posição do jogador é calculada com `ROW_NUMBER()` a partir do `partida_id` (mais precisa que a versão anterior, que usava `COUNT`), e a lista mostrada agora é uma **janela ao redor da posição real do jogador** (pódio 1º-3º + vizinhança de ±1 posição), em vez de sempre listar o topo global. Se a posição parecer sempre a mesma entre testes, normalmente é porque o mesmo apelido foi usado em várias partidas de teste e a melhor pontuação anterior continua no topo do ranking — confira `/ranking` para ver o histórico completo.



- O servidor **nunca** confia em resposta, tempo ou pontuação vindos do cliente: a alternativa correta e o tempo restante são sempre recalculados no Flask a partir da sessão e de timestamps do servidor.
- Todas as queries usam parâmetros (`%s`), evitando SQL Injection.
- O apelido é limitado a 20 caracteres e sanitizado (`html.escape`) antes de ser salvo/exibido.
- Tratamento de erros para: sessão/partida inexistente, banco sem perguntas suficientes, e falhas de conexão com o PostgreSQL.

## Observações sobre o design (PDF de referência)

- A identidade visual (fundo escuro, bordas/textos em ciano neon, botões verdes, destaques em amarelo, tipografia monoespaçada) foi reproduzida via CSS puro, sem nenhuma imagem/asset externo — os elementos gráficos triangulares do rodapé também são gerados via CSS.
- Não foram criados sprites, pixel art ou ilustrações novas (conforme solicitado); as classes CSS (`quiz-container`, `quiz-header`, `quiz-alternative`, `feedback-container` etc.) foram organizadas para permitir a adição de assets no futuro sem reestruturar o HTML.
- O botão "COMO JOGAR" da tela inicial foi implementado como um modal simples (Bootstrap) com um resumo das regras, já que o PDF não detalha o conteúdo dessa tela — pode ser ajustado facilmente depois.
