# Central de Apuração — Deputado Estadual ES 2026

Painel para acompanhar a apuração de votos na noite da eleição: monitoramento dos
resultados oficiais, projeção de quociente eleitoral / vagas / cláusula de
desempenho, e apuração paralela com fiscais de urna. Roda inteiramente no
navegador como uma única página HTML — sem servidor próprio.

Esta é a versão para hospedar fora do Claude (por exemplo, no GitHub Pages).
Como não há servidor, os dados compartilhados entre a equipe ficam guardados
numa planilha Google, acessada por um pequeno backend em Google Apps Script.

## Como funciona

- `index.html` — o painel inteiro (HTML + CSS + JavaScript, um arquivo só).
- `apps-script/Code.gs` — o backend, roda dentro do Google Apps Script e lê/escreve
  numa aba da sua planilha. Faz o papel de "banco de dados" do painel.

O navegador de cada pessoa da equipe consulta o Web App do Apps Script a cada
alguns segundos (por padrão, 6s) para buscar atualizações — é uma sincronização
por *polling*, não um push instantâneo como um banco de dados em tempo real de
verdade. Para uma apuração de votos isso é suficiente: uma diferença de alguns
segundos não faz diferença prática.

## Passo a passo para colocar no ar

### 1. Criar a planilha e o backend (Apps Script)

1. Crie uma planilha nova em [sheets.new](https://sheets.new).
2. No menu, vá em **Extensões → Apps Script**.
3. Apague o conteúdo do arquivo `Code.gs` que abrir e cole todo o conteúdo do
   arquivo [`apps-script/Code.gs`](apps-script/Code.gs) deste repositório no lugar.
4. No topo do script, troque o valor de `ACCESS_TOKEN` por uma chave só sua —
   qualquer texto, quanto mais aleatório e difícil de adivinhar, melhor. Essa
   chave funciona como a senha de acesso aos dados; guarde-a com cuidado.
5. Clique em **Implantar → Nova implantação**.
   - Tipo: **App da Web**.
   - Executar como: **Eu** (sua conta Google).
   - Quem pode acessar: **Qualquer pessoa**.
6. O Google vai pedir para autorizar o script — é normal aparecer um aviso de
   "app não verificado" porque é o seu próprio script pessoal; pode continuar
   com segurança (clique em "Avançado" → "Acessar [nome do projeto] (não
   seguro)" caso apareça esse aviso).
7. Copie a **URL do Web App** que aparece (termina em `/exec`). Você vai
   precisar dela, junto com a chave de acesso do passo 4, para conectar o
   painel.

**Sempre que editar o `Code.gs`**, é preciso criar uma nova versão para a
mudança valer: **Implantar → Gerenciar implantações → ✏️ (editar) → Versão:
"Nova versão" → Implantar**. Só salvar o arquivo no editor não é suficiente.

### 2. Publicar o painel no GitHub Pages

1. Suba este repositório para o GitHub (veja a seção "Enviando este repositório
   para o GitHub" mais abaixo se ainda não fez isso).
2. No GitHub, vá em **Settings → Pages**.
3. Em "Source", selecione a branch `main` e a pasta `/ (root)`.
4. Salve — em alguns minutos o painel estará no ar em
   `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

### 3. Conectar o painel à planilha

A URL do Web App e a chave de acesso já vêm embutidas no `index.html` (opção
escolhida pela campanha para conectar sozinho em qualquer aparelho, sem
ninguém precisar colar nada). Se precisar trocar esses valores, procure por
`GAS_URL_PADRAO` e `GAS_TOKEN_PADRAO` perto do início do bloco de script do
`index.html` e atualize ali. Também existe o botão "Usar outra URL/chave
neste navegador" na aba Configuração, caso um navegador específico precise
usar valores diferentes do padrão do código (fica salvo só naquele
navegador).

## Segurança — leia antes de usar em produção

Este é um esquema simples, adequado para uma equipe pequena e de confiança,
**não** é um sistema de autenticação de verdade:

- Qualquer pessoa que tenha a URL do Web App **e** a chave de acesso consegue
  ler e escrever todos os dados — trate as duas informações como uma senha
  compartilhada.
- **Atenção:** nesta versão, a URL e a chave de acesso estão escritas dentro
  do próprio `index.html`. Isso significa que **qualquer pessoa que veja o
  código-fonte deste repositório também vê a chave**. Só use essa
  configuração se o repositório do GitHub for **privado**. Se o repositório
  for público (ou puder vir a ser), o mais seguro é voltar a pedir a chave
  numa tela própria por navegador, sem gravá-la no código.
- Não existe usuário/senha individual nem controle de quem fez qual alteração
  além do que já é registrado nos próprios boletins (campo "fiscal").
- Se quiser revogar o acesso de alguém (ex: perdeu o celular, ou o
  repositório vazou), troque o `ACCESS_TOKEN` no `Code.gs` **e** o
  `GAS_TOKEN_PADRAO` no `index.html`, implante uma nova versão do Apps
  Script, suba o `index.html` atualizado, e avise a equipe para recarregar a
  página (Ctrl+Shift+R) para pegar a chave nova.

## Botão "Atualizar do TSE" (preenchimento automático)

Na aba **Apuração Oficial** existe um botão que busca os votos de Deputado
Estadual do ES direto do arquivo oficial que o TSE publica durante a
apuração, mostra uma prévia, e só grava no painel depois que você clicar em
"Aplicar". Ele nunca substitui o lançamento manual — os dois convivem, e o
lançamento manual continua funcionando normalmente se o botão falhar por
qualquer motivo.

**Como funciona por trás:** o próprio `Code.gs` (rodando no Google, não no
navegador de cada pessoa) busca o arquivo JSON público do TSE — dessa forma
não existe problema de CORS, porque é o servidor do Google conversando com o
servidor do TSE, não o navegador. O painel só chama esse endpoint próprio.

### Antes de usar: descubra a URL do TSE

Segundo a própria documentação técnica do TSE (página "Informações técnicas
sobre a divulgação de resultados 2026", aba FAQ), a URL de cada arquivo de
resultado é montada com peças que só ficam definidas perto da eleição:
`[ambiente]` (que será `"oficial"`), mais um `[ciclo]`, um código de eleição
(`e<ELEIÇÃO>`) e um código de pleito (`p<PLEITO>`) — esses três últimos "poderão
ser obtidos por meio do arquivo de configuração de eleições `ele-c.json`",
segundo o próprio TSE. Ou seja: mesmo o TSE não publica hoje a URL final, só
a receita para montá-la quando a infraestrutura da eleição 2026 for ativada
(normalmente pouco antes dos simulados oficiais de setembro/outubro).

Por isso, em vez de o `Code.gs` tentar montar essa URL sozinho (arriscado, já
que a peça exata pode mudar), ele espera que você cole a **URL completa e
já pronta** assim que ela existir — o jeito mais simples de conseguir isso é
observar o próprio site oficial fazendo essa chamada:

1. Abra `https://resultados.tse.jus.br/` no Chrome.
2. Abra as Ferramentas do Desenvolvedor (F12) → aba **Network** (Rede).
3. No site do TSE, navegue até o resultado de **Deputado Estadual → Espírito
   Santo**.
4. Na aba Network, filtre por "json" e procure a requisição com os votos por
   candidato/partido. Segundo a especificação oficial do arquivo "EA20 —
   resultado unificado", esse arquivo termina em `-u.json` e tem no nome
   `es` (a UF) e `c0007` (código oficial do cargo Deputado Estadual, também
   confirmado na mesma especificação) — algo como `es-c0007-e######-u.json`.
5. Clique com o botão direito na requisição → Copy → Copy link address.
6. Cole essa URL completa em `TSE_URL_RESULTADO`, no topo do `Code.gs`.
7. Salve o `Code.gs`, crie uma **Nova versão** da implantação (mesmo passo de
   sempre), e teste o botão.

Até lá, o botão mostra uma mensagem avisando que a URL ainda não foi
configurada — isso é esperado, não é um bug. Vale a pena repetir esse passo
durante um simulado oficial do TSE (que já usa a infraestrutura real, com
dados de teste) para testar o botão com calma antes da noite da eleição.

Outros detalhes técnicos confirmados na mesma página do TSE, para quem for
mexer no código: o limite de acesso é 100 requisições/segundo por IP (por
isso o botão é sob demanda, não automático); e o campo `snt` no JSON indica
quantas seções ainda não foram totalizadas (`snt=0` = totalização final).

### O que o botão lê do arquivo (schema oficial confirmado)

Depois de pedir para eu ler os PDFs técnicos publicados pelo TSE para cada
arquivo (aba "Documentos" da mesma página), confirmei os nomes de campo
usados no arquivo EA20 (resultado unificado) e ajustei o `Code.gs` para lê-los
diretamente, em vez de adivinhar:

- **Candidato**: `n` (número), `nm`/`nmu` (nome / nome de urna), `st`
  (situação: Eleito, Eleito por QP, Eleito por média, Não eleito, 2º turno,
  Suplente), `vap` (votos computados), `pvap` (percentual).
- **Partido**: `n` (número), `sg` (sigla), `nm` (nome), `tvan`/`tval` (votos
  computados nominais e de legenda — o painel soma os dois para o total do
  partido), `tvtn`/`tvtl` (equivalentes já "validados", usados como reserva
  se os dois primeiros não vierem).
- Os candidatos aparecem aninhados dentro de cada partido (`par[].cand[]`) no
  desenho oficial do arquivo — o código já lê nesse formato, com um formato
  alternativo (lista solta) como reserva, caso o TSE mude isso na prática.
- A situação (`st`) de cada candidato aparece na prévia, na aba Apuração
  Oficial, como contexto extra — não é salva em nenhum lugar do painel.

### Limitações a ter em mente

- Os documentos técnicos do TSE descrevem os *campos* do arquivo com
  segurança, mas não davam (até a última checagem) um exemplo de JSON real
  preenchido nem a URL final pronta — só o "molde". Então, mesmo com os
  nomes de campo corretos, vale testar o botão assim que possível (num
  simulado oficial do TSE, por exemplo) antes de confiar nele na noite da
  eleição.
- O layout exato dos nomes de partido que o TSE devolve (sigla) pode não
  bater 100% com a lista de partidos já cadastrada no painel — se isso
  acontecer, vai aparecer uma linha "duplicada" na tabela de partidos; é só
  apagar/ajustar manualmente na hora, os controles manuais continuam lá.
- Se o TSE mudar o formato do arquivo entre uma eleição e outra, o botão
  mostra um erro claro em vez de aplicar números errados — nesse caso, me
  chame para ajustar o código de leitura.
- Use o botão sob demanda (clique), não deixe automatizado em loop — o TSE
  aplica um limite de 100 requisições por segundo por IP, com bloqueio de 10
  minutos se passar disso.

## Limites do Google Apps Script a ter em mente

Contas Google gratuitas têm cota diária de execução do Apps Script (por volta
de 90 minutos de execução acumulada por dia — contas Google Workspace têm
cotas maiores). Cada sincronização é rápida, mas com muitas pessoas com o
painel aberto ao mesmo tempo, muitas horas seguidas, é possível esgotar a
cota num dia de eleição concorrido. Para reduzir o risco:

- O intervalo de sincronização é de 6 segundos por padrão. Se a equipe for
  grande, considere aumentar esse valor (procure por `intervalMs` /
  `criarClienteGAS` no `index.html`) — um valor maior (ex: 10-15s) reduz a
  carga proporcionalmente.
- Se sua organização/campanha tiver acesso a uma conta Google Workspace, use-a
  para criar a planilha — a cota é bem maior.
- Se a cota estourar durante a apuração, o Apps Script volta a responder
  normalmente no dia seguinte (a cota é diária); não há perda de dados, só
  uma pausa temporária nas atualizações.

## Desenvolvimento local

Como é um arquivo HTML autocontido, basta abrir `index.html` diretamente no
navegador para testar o visual (sem dados compartilhados, já que isso depende
do Web App publicado). Para testar a integração completa, publique o Apps
Script normalmente e conecte como qualquer outra pessoa faria.

## Enviando este repositório para o GitHub

Se você recebeu esta pasta pronta (com o git já inicializado), falta só:

```bash
# crie um repositório vazio no GitHub primeiro (sem README/gitignore), depois:
git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPOSITORIO.git
git branch -M main
git push -u origin main
```

## Metodologia de cálculo

A aba "Metodologia" dentro do próprio painel explica em detalhe as regras
usadas (quociente eleitoral, quociente partidário, distribuição de sobras
pelo método das maiores médias, a exceção do STF de 2024, e a cláusula de
desempenho individual de 10% do QE). O painel é uma ferramenta de projeção
estratégica da campanha — os números oficiais são sempre os divulgados pela
Justiça Eleitoral.
