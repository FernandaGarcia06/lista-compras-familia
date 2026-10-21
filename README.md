# 🛒 Lista de Compras Família

Aplicativo web e mobile (Android) para criação, organização e compartilhamento de listas de compras em família, com comparação de preços entre mercados. Desenvolvido com **React**, **Vite**, **Firebase** (Authentication + Firestore + Hosting) e empacotado como app Android com **Capacitor**.

## ✨ Funcionalidades

### Autenticação
- Cadastro e login com e-mail e senha
- Verificação de e-mail obrigatória (com opção de reenviar o e-mail de confirmação)
- Recuperação de senha ("Esqueci minha senha")

### Lista de compras
- Criação automática de uma lista pessoal para cada usuário
- Adição, edição e exclusão de produtos
- Cada produto tem nome, quantidade e unidade (unidade(s), pacote(s), caixa(s), kg, grama(s), litro(s), garrafa(s), etc.)
- Marcar/desmarcar produtos como "comprados", com barra de progresso da compra
- Resumo com total de produtos, quantos faltam e quantos já foram pegos

### Comparação de preços
- Opção de cadastrar o preço do produto em diferentes mercados (Tenda, Savegnago, Atacadão, Outro)
- Cálculo automático do total por mercado (preço × quantidade)
- Destaque visual do mercado mais barato para cada produto
- Total geral da lista somando sempre o menor preço de cada item

### Compartilhamento de listas (uso em família)
- Geração de um código único de 6 caracteres para compartilhar a lista
- Outro usuário pode entrar na lista digitando o código
- Todos os membros podem visualizar, adicionar, editar, marcar e excluir produtos
- O dono da lista pode "parar de compartilhar" (remove todos os membros e gera um novo código)
- Membros podem sair da lista compartilhada a qualquer momento (uma nova lista pessoal é criada automaticamente)
- Aviso automático quando o dono para de compartilhar e o membro perde o acesso

### Catálogo de produtos
- Catálogo pessoal com produtos usados com frequência, salvo por usuário
- Adicionar, editar e remover itens do catálogo
- Seleção múltipla para adicionar vários itens do catálogo à lista de uma vez
- Itens já presentes na lista atual ficam marcados/bloqueados no catálogo

## 🛠️ Tecnologias

- **React** — construção da interface (hooks: `useState`, `useEffect`, `useMemo`)
- **Vite** — build tool e servidor de desenvolvimento
- **Firebase Authentication** — cadastro, login, verificação de e-mail e redefinição de senha
- **Firebase Firestore** — banco de dados em tempo real (listeners com `onSnapshot`)
- **Firebase Hosting** — publicação da versão web
- **Capacitor** — empacotamento do app como aplicativo Android nativo (já em uso como APK)

## 📁 Estrutura do Projeto

```
lista-compras-familia/
├── android/                     # Projeto Android nativo gerado pelo Capacitor
│   ├── app/
│   ├── gradle/
│   └── ...
├── assets/                      # Ícones e splash screens do app Android
│   ├── icon-background.png
│   ├── icon-foreground.png
│   ├── icon.png
│   ├── splash-dark.png
│   └── splash.png
├── build/                       # Saída do build web (gerada pelo Vite)
├── public/                      # Arquivos públicos estáticos
│   ├── favicon.svg
│   ├── icons.svg
│   └── logo-carrinho.png
├── src/
│   ├── assets/
│   │   ├── hero.png
│   │   ├── logo-carrinho.png
│   │   ├── react.svg
│   │   └── vite.svg
│   ├── App.jsx                  # Componente principal — lista, produtos, compartilhamento, catálogo
│   ├── App.css                  # Estilos da aplicação
│   ├── index.css
│   ├── Login.jsx                 # Tela de login/cadastro
│   ├── firebase.js               # Inicialização do Firebase (Auth + Firestore)
│   └── main.jsx                  # Ponto de entrada da aplicação
├── .firebase/                    # Cache interno do Firebase CLI
├── .firebaserc                   # Configuração do projeto Firebase
├── .gitattributes
├── .gitignore
├── capacitor.config.json         # Configuração do Capacitor (app Android)
├── eslint.config.js
├── firebase.json                 # Configuração do Firebase Hosting
├── index.html
├── package.json
├── package-lock.json
├── README.md
└── vite.config.js
```

## 🔥 Modelo de dados (Firestore)

```
usuarios/{userId}
  ├── email
  ├── listaId
  └── catalogo: [ "Arroz", "Feijão", ... ]

listas/{listaId}
  ├── donoId
  ├── criadoEm
  ├── codigoCompartilhamento
  ├── membros: [ uid1, uid2, ... ]
  └── produtos/{produtoId}
        ├── nome
        ├── quantidade
        ├── unidade
        ├── mercados: [ { local, preco }, ... ]
        ├── comprado
        └── criadoPor

codigosCompartilhamento/{codigo}
  └── listaId
```

As regras de segurança do Firestore garantem que:
- Cada usuário só acessa seus próprios dados em `usuarios/{userId}`
- Apenas usuários com e-mail verificado (`email_verified`) podem ler/escrever
- Produtos de uma lista só podem ser acessados por quem está em `membros`
- Apenas o dono da lista pode gerar/alterar o código de compartilhamento

## 🚀 Como executar o projeto localmente

1. Clone o repositório:
   ```bash
   git clone <url-do-repositorio>
   cd lista-compras-familia
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Crie um arquivo `.env` na raiz do projeto com as credenciais do Firebase:
   ```
   VITE_FIREBASE_API_KEY=xxxxx
   VITE_FIREBASE_AUTH_DOMAIN=xxxxx
   VITE_FIREBASE_PROJECT_ID=xxxxx
   VITE_FIREBASE_STORAGE_BUCKET=xxxxx
   VITE_FIREBASE_MESSAGING_SENDER_ID=xxxxx
   VITE_FIREBASE_APP_ID=xxxxx
   ```

4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

5. Acesse `http://localhost:5173` no navegador

## 📄 Licença

Este projeto está sob a licença MIT.