-- Perguntas iniciais do ReAlimenta: quiz educativo sobre desperdício de alimentos.
-- Executado automaticamente por seed_db() em app.py quando a tabela "perguntas" está vazia.

INSERT INTO perguntas (id, enunciado) VALUES
    (1, 'Qual é o destino mais adequado para cascas de frutas e legumes?'),
    (2, 'Alimentos próximos da data de validade em supermercados deveriam ser:'),
    (3, 'Qual a melhor forma de guardar folhas verdes (alface, couve) para durarem mais?'),
    (4, 'O que fazer com pão que está ficando duro?'),
    (5, 'Qual prática ajuda a evitar o desperdício ao fazer compras no mercado?'),
    (6, 'Sobras de arroz e feijão do almoço podem ser:'),
    (7, 'Qual é o principal problema ambiental causado pelo desperdício de alimentos?'),
    (8, 'A data "consumir preferencialmente até" em uma embalagem significa que o alimento:'),
    (9, 'Talos e folhas de brócolis e couve-flor:'),
    (10, 'Qual atitude ajuda a reduzir o desperdício em restaurantes e buffets?');

INSERT INTO alternativas (pergunta_id, texto, correta, feedback) VALUES
    -- Pergunta 1
    (1, 'Jogar no lixo comum', FALSE, 'Cascas viram lixo comum sem necessidade e perdem todo o valor nutricional que ainda têm.'),
    (1, 'Compostar ou aproveitar em receitas', TRUE, 'Cascas e talos podem virar adubo na compostagem ou ingredientes de caldos, farofas e chips caseiros.'),
    (1, 'Queimar no quintal', FALSE, 'Queimar resíduos orgânicos polui o ar e desperdiça um material que poderia virar adubo.'),
    (1, 'Guardar indefinidamente na geladeira', FALSE, 'Cascas guardadas por tempo indeterminado só mofam e acabam no lixo de qualquer forma.'),

    -- Pergunta 2
    (2, 'Descartados imediatamente por segurança', FALSE, 'Descartar de imediato joga fora alimentos ainda próprios para consumo, aumentando o desperdício.'),
    (2, 'Vendidos com desconto ou doados', TRUE, 'Descontos e doações dão um destino aos alimentos antes que vençam, reduzindo o desperdício.'),
    (2, 'Misturados aos alimentos mais novos', FALSE, 'Misturar sem sinalização dificulta o controle de validade e aumenta o risco de perdas.'),
    (2, 'Deixados no mesmo preço no fundo da prateleira', FALSE, 'Sem destaque ou desconto, esses itens tendem a vencer antes de serem vendidos.'),

    -- Pergunta 3
    (3, 'Soltas dentro da geladeira, sem embalagem', FALSE, 'Sem proteção contra o ressecamento do ar da geladeira, as folhas murcham bem mais rápido.'),
    (3, 'Lavadas, secas e guardadas em pote ou saco com um papel-toalha', TRUE, 'O papel-toalha absorve o excesso de umidade e evita que as folhas apodreçam antes da hora.'),
    (3, 'Fora da geladeira, em temperatura ambiente', FALSE, 'Fora da geladeira, folhas verdes murcham e estragam muito mais rápido.'),
    (3, 'Molhadas dentro de um saco plástico fechado', FALSE, 'O excesso de umidade em um saco fechado acelera o apodrecimento das folhas.'),

    -- Pergunta 4
    (4, 'Descartar imediatamente', FALSE, 'Pão duro ainda é totalmente aproveitável e não precisa ir para o lixo.'),
    (4, 'Transformar em farofa, torradas ou pão ralado', TRUE, 'Pão dormido é ótimo para farofas, torradas e pão ralado caseiro, evitando o desperdício.'),
    (4, 'Dar só para os pássaros', FALSE, 'Essa é uma opção, mas antes disso o pão ainda pode ser bem aproveitado na própria cozinha.'),
    (4, 'Guardar fora da embalagem por vários dias', FALSE, 'Sem proteção, o pão resseca e mofa ainda mais rápido.'),

    -- Pergunta 5
    (5, 'Comprar sem planejamento, no impulso', FALSE, 'Compras por impulso costumam gerar excesso de itens que acabam estragando em casa.'),
    (5, 'Fazer uma lista baseada no cardápio da semana', TRUE, 'Planejar as refeições evita comprar mais do que será realmente consumido.'),
    (5, 'Estocar o máximo possível de itens perecíveis', FALSE, 'Excesso de estoque de itens perecíveis aumenta a chance de eles estragarem antes do consumo.'),
    (5, 'Ignorar as datas de validade na hora de escolher', FALSE, 'Ignorar validade pode levar a comprar produtos que vencem antes de serem usados.'),

    -- Pergunta 6
    (6, 'Descartadas no mesmo dia, mesmo estando boas', FALSE, 'Descartar sobras ainda próprias para consumo é desperdício evitável.'),
    (6, 'Guardadas na geladeira e reaproveitadas em até poucos dias', TRUE, 'Bem armazenadas na geladeira, as sobras podem ser reaproveitadas com segurança em outras refeições.'),
    (6, 'Deixadas fora da geladeira até o dia seguinte', FALSE, 'Fora da geladeira por muito tempo, as sobras podem estragar e não são mais seguras para consumo.'),
    (6, 'Misturadas sem critério a outras sobras antigas', FALSE, 'Misturar sobras de datas diferentes sem controle dificulta saber o que ainda está bom para comer.'),

    -- Pergunta 7
    (7, 'Aumento do preço da energia elétrica', FALSE, 'O desperdício de alimentos não é a causa direta do preço da energia elétrica.'),
    (7, 'Emissão de gases de efeito estufa pela decomposição em aterros', TRUE, 'Alimentos descartados em aterros se decompõem e liberam metano, um gás de efeito estufa.'),
    (7, 'Redução da fertilidade do solo agrícola', FALSE, 'O impacto mais direto do desperdício está ligado à decomposição em aterros, não à fertilidade do solo.'),
    (7, 'Aumento da umidade do ar nas cidades', FALSE, 'O desperdício de alimentos não é uma causa relevante de mudanças na umidade do ar.'),

    -- Pergunta 8
    (8, 'Está estragado e não pode mais ser consumido', FALSE, 'Essa data indica qualidade, não que o alimento tenha estragado no dia seguinte.'),
    (8, 'Mantém a melhor qualidade até essa data, mas pode seguir próprio para consumo depois', TRUE, 'É uma indicação de qualidade ótima, diferente da validade de segurança; muitos alimentos seguem bons depois dessa data.'),
    (8, 'Deve ser descartado no mesmo dia indicado', FALSE, 'A data de "consumir preferencialmente até" não exige descarte imediato no dia indicado.'),
    (8, 'É o mesmo que uma data de validade obrigatória', FALSE, 'Essa data é diferente da validade de segurança alimentar; costuma ser mais flexível.'),

    -- Pergunta 9
    (9, 'Não servem para nada e devem ser descartados', FALSE, 'Talos e folhas desses vegetais são comestíveis e continuam com nutrientes.'),
    (9, 'Podem ser refogados, usados em caldos ou farofas', TRUE, 'Talos e folhas de brócolis e couve-flor são comestíveis e ótimos em refogados, caldos e farofas.'),
    (9, 'Só servem como adubo, nunca para comer', FALSE, 'Além de virarem adubo, também podem ser aproveitados diretamente em receitas.'),
    (9, 'Precisam ser descascados e jogados fora antes do cozimento', FALSE, 'Não é necessário descartá-los: eles podem ser aproveitados no preparo da refeição.'),

    -- Pergunta 10
    (10, 'Servir porções bem maiores do que o necessário', FALSE, 'Porções excessivas aumentam a chance de sobras que acabam no lixo.'),
    (10, 'Oferecer porções ajustáveis e reaproveitar sobras com segurança', TRUE, 'Porções sob medida e um plano de reaproveitamento reduzem bastante o volume de comida desperdiçada.'),
    (10, 'Não ter nenhum controle sobre o que sobra no fim do dia', FALSE, 'Sem acompanhar o que sobra, fica impossível ajustar o preparo e evitar desperdício futuro.'),
    (10, 'Preparar sempre o dobro da demanda esperada', FALSE, 'Preparar muito mais do que a demanda esperada tende a gerar sobras que não serão consumidas.');
