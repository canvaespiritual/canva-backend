
# 📘 Canva Espiritual - Backend

Este é o backend do projeto **Canva Espiritual**, responsável por:
- Receber e processar as respostas do quiz
- Gerar relatórios PDF personalizados
- Integrar com Stripe para pagamentos
- Enviar relatórios por e-mail
- Servir páginas HTML (quiz, pagamento, sucesso, etc.)

---

## 🚀 Como rodar o projeto localmente

```bash
npm install
node servidor.js
```

> Certifique-se de ter o Node.js instalado.

---

## 🌐 Estrutura de Pastas

```
CANVA-BACKEND/
├── public/                 # Páginas HTML públicas (quiz, sucesso, falha, pagamento)
├── relatorio/              # Modelo HTML do relatório PDF
├── routes/                 # Rotas Express (envio de e-mail, stripe, quiz)
├── src/
│   ├── routes/             # Rotas internas da API
│   ├── scripts/            # Scripts auxiliares
│   ├── services/           # Serviços (ex: gerar PDF, envio de e-mail)
│   ├── testes/             # Scripts de testes
│   └── utils/              # Funções utilitárias (formatação, helpers, etc.)
├── temp/                   # Arquivo temporário com dados simulados (`dados.json`)
├── templates/              # (futuramente) Templates de e-mail e relatório
├── .env                    # Variáveis de ambiente (Stripe, email, etc.)
├── package.json            # Dependências e scripts do projeto
├── stripe.js               # Configuração Stripe
├── servidor.js             # Arquivo principal que inicia o servidor Express
```

---

## 🛠️ Variáveis de Ambiente (.env)

Você deve criar um arquivo `.env` com:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
EMAIL_USER=seu@email.com
EMAIL_PASS=sua_senha_de_app
```

---

## 🧪 Testes

- Testes manuais podem ser executados via Postman com os endpoints disponíveis.
- O arquivo `temp/dados.json` pode simular dados para geração de relatórios.

---

## 📦 Produção

Para migrar para produção:

1. Troque as chaves do `.env` para as versões live (Stripe, e-mail real).
2. Use domínio com HTTPS.
3. Configure o envio real de e-mails com domínio corporativo.
4. (Opcional) Use PM2 ou Docker para gerenciar o servidor.

---

## 🙌 Autor

Desenvolvido por Gustavo Prado – Projeto Canva Espiritual ✨


Servidor (Host):
interchange.proxy.rlwy.net

Porta:
41314

Banco de Dados:
railway

Usuário:
postgres

Senha:
TgCPmdDpDYSwQqySyompipFCNScQToAE


subconta Gerson cpf 09592954100
email corretorintegrado1@gmail.com
senha asaas: Crailgra272@


https://api.asaas.com/v3



minha-chave-webhook

código de gerar cpfs sandbox: 
function New-TestCpf {
    $n = 1..9 | ForEach-Object { Get-Random -Minimum 0 -Maximum 10 }

    $soma = 0
    for ($i=0; $i -lt 9; $i++) {
        $soma += $n[$i] * (10 - $i)
    }

    $d1 = 11 - ($soma % 11)
    if ($d1 -ge 10) { $d1 = 0 }

    $soma = 0
    for ($i=0; $i -lt 9; $i++) {
        $soma += $n[$i] * (11 - $i)
    }

    $soma += $d1 * 2

    $d2 = 11 - ($soma % 11)
    if ($d2 -ge 10) { $d2 = 0 }

    $cpf = (($n -join '') + $d1 + $d2)

    return "{0}.{1}.{2}-{3}" -f `
        $cpf.Substring(0,3),
        $cpf.Substring(3,3),
        $cpf.Substring(6,3),
        $cpf.Substring(9,2)
}

1..20 | ForEach-Object { New-TestCpf }

----
