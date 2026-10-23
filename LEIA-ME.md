# FIGHT ELEITORAL — Petistas × Bolsonaristas

Luta 3D de boxe controlada pelo público via Pix. Os dois lutadores nunca se derrotam: quem decide quanto cada um bate é a torcida.

## Como o Pix vira golpe (Pix de qualquer valor)

- **Cada R$ 1 = 1 soco** (centavos acumulam: R$ 0,50 + R$ 0,50 = 1 soco). O soco sai **na hora** que o Pix chega; quanto mais socos na fila, mais rápido ele bate.
- **Pix maior solta especial maior** (vale o valor de UM Pix):

| Pix | Vermelho (PETISTAS) | Amarelo (BOLSONARISTAS) |
|---|---|---|
| R$ 5+ | PAI DA MENTIRA (joga um boneco do Pinóquio) | MULHERES DE BIQUÍNI (ele se distrai e leva uppercut) |
| R$ 10+ | VACINA (seringa gigante) | É SÓ UMA GRIPEZINHA (espirro com catarro e vírus) |
| R$ 20+ | COICE DO JUMENTO | ARMINHA (de tinta) |
| R$ 30+ | CHUVA DE MORTADELA | METRALHADORA DE TINTA |
| R$ 50+ | CASA TRIPLEX (gigante, com chuva de triplex) | BOMBARDEIO DE TINTA |

  Exemplo: Pix de R$ 27 = 27 socos + o especial de R$ 20.
- Essa tabela aparece na tela do jogo, no painel de cada lado. A linha pisca quando alguém libera aquele nível.
- **Assim que o Pix chega**: aparece em letras grandes o **primeiro nome** de quem mandou, o valor e o que ele liberou, e o locutor fala o nome.

## Rounds e vitórias

- **Rounds de 60 segundos.** Vence o round quem deu **mais golpes** (= mais reais). Empate → quem mandou mais Pix. Round sem nenhum Pix não conta.
- No fim de cada round aparece o **ranking de vitórias** (fica salvo mesmo se reiniciar o servidor).
- O painel do meio mostra **quem bateu mais no round** (cabo de guerra), as viradas e o **maior Pix do round** com o nome. Nos últimos 10 segundos chama quem está perdendo.
- A vida nunca zera (mínimo 4%), recupera quando ninguém bate e enche de novo a cada round.

## Personagens e falas

- **Treinadores**: Karl Marx no corner do vermelho, Trump no corner do amarelo. Comemoram, se desesperam e gritam pra galera mandar Pix.
- **Falas do vermelho** ao bater: "Toma tarifaço!", "Toma, companheiro!", "Vou alugar um triplex na sua cabeça!", "Quero que até seu pai vote em mim!"
- **Falas do amarelo** ao bater: "Viva a pátria!", "Toma uma gripezinha!" (espirra meleca verde), "O meu histórico de atleta!"
- **Luta parada**: o vermelho chama "Companheiro, manda o Pix pra eu dar uma vacina nele!" e o amarelo "Manda o Pix pra eu enfiar mortadela nesse ladrão!"
- **Arquibancada**: esquerda com camisas e bandeiras vermelhas; direita com camisas amarelas e bandeiras do Brasil.

## 1. Hospedar de graça na Vercel — recomendado

O jogo e o painel ficam num endereço `https://....vercel.app`: não precisa instalar nada no PC e o painel abre no celular de qualquer lugar (até no 4G). O placar, os rounds e os totais ficam guardados num banco grátis (Upstash), então **não zeram** sozinhos.

1. **GitHub** — crie uma conta grátis em https://github.com/signup.
2. Clique em **New** (novo repositório), nome `fight-eleitoral`, marque **Private** e clique em **Create repository**.
3. Na página do repositório, clique em **uploading an existing file**, arraste **todos os arquivos e as pastas `public`, `api` e `lib`** e clique em **Commit changes**.
4. **Vercel** — crie uma conta grátis em https://vercel.com/signup escolhendo **Continue with GitHub** (plano **Hobby**).
5. Na Vercel: **Add New → Project**, importe o repositório `fight-eleitoral`.
   - Antes de clicar em Deploy, abra **Environment Variables** e crie `TOKEN_ADMIN` com uma **senha sua** (é a senha do Painel do Pix).
   - Clique em **Deploy**.
6. **Banco grátis**: no projeto, abra a aba **Storage → Create Database → Upstash (Redis)**, escolha o plano **Free** e conecte ao projeto `fight-eleitoral`. Depois vá em **Deployments**, clique nos **⋯** do último deploy e em **Redeploy** (para ele enxergar o banco).
7. Pronto:
   - Jogo (OBS): `https://SEU-PROJETO.vercel.app/?limpo`
   - Painel do Pix (celular): `https://SEU-PROJETO.vercel.app/painel?token=SUA_SENHA`

Se o jogo mostrar "SERVIDOR COM PROBLEMA: Banco não configurado", falta o passo 6 (ou o Redeploy depois dele).

Como funciona na Vercel: o jogo e o painel consultam o servidor a cada ~0,7 s, então o anúncio e o golpe aparecem praticamente na hora.

Limites do plano grátis:
- O Upstash grátis tem um limite de comandos por mês. Com jogo + painel abertos, cada hora de live gasta uns 9 mil — dá para várias lives por mês. Acompanhe o uso no painel do Upstash e **feche o jogo e o painel quando a live acabar**.
- Para mudar algo depois (frases, valores, nomes), edite o arquivo no GitHub: a Vercel publica a nova versão sozinha.

## 1b. Rodar no próprio PC (alternativa)

1. Instale o **Node.js LTS**: https://nodejs.org (sem ele o servidor não roda — foi por isso que os Pix de teste não fizeram nada).
2. Dê dois cliques em **`iniciar.bat`**.
3. A janela preta mostra os endereços. Deixe ela aberta durante a live.

## 2. Colocar na live (OBS)

- Fonte **Navegador** com `https://SEU-PROJETO.vercel.app/?limpo` (ou `http://localhost:3000/?limpo` rodando no PC).
- **1920×1080** (horizontal) ou **1080×1920** (vertical); o jogo se ajusta sozinho.
- Marque **"Controlar áudio via OBS"** para o som, as falas e o locutor irem para a live.

## 3. Receber os Pix — Painel do Pix

O QR Code dos dois lados é o seu Pix do Inter (sem valor fixo). Quem paga escolhe o valor e escreve **PETISTA** ou **BOLSONARISTA** na mensagem.

Como é o mesmo QR para os dois lados e a conta pessoa física do Inter não avisa nenhum programa quando um Pix cai, **você lança cada Pix no Painel**:

1. Abra o **Painel do Pix** no celular: na Vercel é `https://SEU-PROJETO.vercel.app/painel?token=SUA_SENHA`; rodando no PC, use o link "no celular, mesmo Wi-Fi" que aparece na janela do servidor (se o Windows perguntar do firewall, permita em rede privada).
2. Caiu um Pix no app do Inter: digite o **valor**, o **primeiro nome** e toque no **lado** que a pessoa escreveu na mensagem.
3. O painel mostra antes o que aquele valor libera, e depois o placar, o relógio e os últimos Pix.

## 4. Deixar automático (opcional)

Para o jogo receber os Pix sozinho, precisa de um banco ou intermediador que **avise o servidor** (webhook) com a mensagem do Pix:

- **Conta PJ/MEI com API Pix** (Inter Empresas, Efí, Sicoob...): cadastre o webhook da chave para
  `https://SEU-ENDERECO/webhook/pix?token=SEU_tokenWebhook`. O servidor lê a mensagem para saber o lado e o nome do pagador quando o banco manda.
- **Qualquer ferramenta** que envie: `{ "lado": "vermelho", "valor": 12.5, "nome": "Fulano", "id": "id-unico" }`

Na Vercel, crie também a variável `TOKEN_WEBHOOK` (outra senha) e o endereço do webhook fica `https://SEU-PROJETO.vercel.app/webhook/pix?token=TOKEN_WEBHOOK`. Rodando no PC, o banco precisa alcançar o seu computador — use um túnel e pegue o endereço `https://...`:

```bash
cloudflared tunnel --url http://localhost:3000
```

## 5. Personalizar (config.json — no PC reinicie o servidor; na Vercel basta salvar no GitHub)

- `niveis`: valores mínimos de cada especial (`[5, 10, 20, 30, 50]`).
- `reaisPorSoco`: quantos reais valem 1 soco (padrão 1).
- `times`: nome de cada lado, palavra da mensagem e nome dos especiais.
- `duracaoRound`: segundos por round.
- `"mostrarChave": true` mostra a chave Pix por escrito no jogo.
- Frases dos lutadores e treinadores: bloco `JOGO` no topo de `public/index.html`.

## 6. Testar sem pagar

- No jogo: teclas **1** a **0**, **Z** e **X** mandam Pix de teste de vários valores (aperte **H** pra ver a lista). Só afetam a tela onde você apertou.
- Para o teste contar nos rounds: use o Painel do Pix.
- Abrindo `public/index.html` direto (sem servidor) o jogo roda em demonstração.

## Segurança

- Não mostre na live o link do painel (tem o `tokenAdmin`) nem o `tokenWebhook`.
- Totais e vitórias ficam em `dados/estado.json`; o botão "Zerar" do painel limpa tudo.
