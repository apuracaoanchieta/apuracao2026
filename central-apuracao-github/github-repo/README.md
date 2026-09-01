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

Na primeira vez que qualquer pessoa da equipe abrir o link do painel, vai
aparecer uma tela pedindo a **URL do Web App** e a **chave de acesso** — cole
os dois valores dos passos 6 e 4 acima e clique em Conectar. Isso fica salvo
só naquele navegador (cada pessoa faz esse passo uma vez); para trocar depois,
use o botão "Reconfigurar conexão" na aba Configuração.

## Segurança — leia antes de usar em produção

Este é um esquema simples, adequado para uma equipe pequena e de confiança,
**não** é um sistema de autenticação de verdade:

- Qualquer pessoa que tenha a URL do Web App **e** a chave de acesso consegue
  ler e escrever todos os dados — trate as duas informações como uma senha
  compartilhada. Não cole nem a URL nem a chave em grupos abertos do WhatsApp,
  redes sociais, ou em qualquer lugar público.
- **Não coloque a URL nem a chave de acesso dentro do código do `index.html`**
  antes de subir para o GitHub, especialmente se o repositório for público —
  por isso o painel pede essas informações numa tela própria, guardadas só no
  navegador de cada pessoa, em vez de vir escrito no código-fonte.
- Não existe usuário/senha individual nem controle de quem fez qual alteração
  além do que já é registrado nos próprios boletins (campo "fiscal").
- Se quiser revogar o acesso de alguém (ex: perdeu o celular), troque o
  `ACCESS_TOKEN` no `Code.gs`, implante uma nova versão, e reenvie a nova
  chave só para quem deve continuar com acesso.

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
