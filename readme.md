
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
