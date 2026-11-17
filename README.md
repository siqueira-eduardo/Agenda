# Legado — Organização e Disciplina

Aplicação web experimental para organização pessoal, estudos, trabalho e rotina familiar. O projeto reúne agenda, tarefas, metas e recursos de apoio por inteligência artificial.

**Nome do aplicativo:** Legado: Organização e Disciplina

## Funcionalidades identificadas no código

- Painel de organização e acompanhamento de atividades.
- Cadastro e acompanhamento de tarefas.
- Organização por áreas: espiritual, estudos, trabalho, saúde, intelectual, financeiro e família.
- Definição de prioridades e recorrências.
- Metas e acompanhamento de progresso.
- Perfis e recursos de organização familiar.
- Assistente de IA baseado na API Gemini.
- Interpretação de descrições em linguagem natural para sugerir dados de tarefas.
- Geração de fala por IA.
- Integração de autenticação Google via Firebase.
- Integração com Google Sheets para criar, consultar e atualizar planilhas.

## Tecnologias identificadas

- React 19
- TypeScript
- Vite
- Firebase Authentication
- Google Sheets API
- Google Gemini API
- lucide-react

## Executar localmente

Requisitos: Node.js e npm.

1. Clone o repositório.
2. Instale as dependências:

   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente em um arquivo `.env.local`. O Vite utiliza `GEMINI_API_KEY` para disponibilizar a chave ao código da aplicação:

   ```env
   GEMINI_API_KEY=sua_chave_gemini
   ```

4. Configure o arquivo `firebase-applet-config.json` com a configuração do seu projeto Firebase e habilite os provedores e APIs necessários para autenticação Google e Google Sheets.
5. Inicie o ambiente de desenvolvimento:

   ```bash
   npm run dev
   ```

6. Para gerar a versão de produção:

   ```bash
   npm run build
   ```

## Configuração e segurança

- Nunca publique chaves privadas, tokens OAuth, credenciais de serviço ou arquivos de ambiente com segredos.
- A configuração cliente do Firebase não substitui regras de segurança no Firebase.
- Revise as permissões OAuth solicitadas pela integração com Google Sheets.
- Não utilize dados pessoais reais ou dados familiares sensíveis em ambiente público ou de demonstração sem controles de acesso, privacidade e segurança adequados.
- A chave da API Gemini deve ser protegida e gerenciada de acordo com o ambiente de implantação. Em aplicações públicas, prefira chamadas por backend para não expor segredos no navegador.

## Estado do projeto

Projeto experimental em evolução. Este README descreve funcionalidades encontradas na estrutura do código; não representa certificação de que todas as integrações externas estejam configuradas ou funcionando em produção.

---
Desenvolvido como projeto de aprendizagem e experimentação com React, TypeScript, Firebase e serviços Google.
