# 🏎️ CarLog — Diário de Manutenção & Modificações

O **CarLog** é um aplicativo mobile completo desenvolvido em React Native e Expo, projetado para gerenciar o histórico de manutenções, trocas de peças e modificações de veículos. O aplicativo conta com persistência de dados local via **SQLite**, monitoramento de estabilidade da direção através do **Acelerômetro**, captura de coordenadas da oficina via **GPS**, registro fotográfico via **Câmera** e suporte completo a **Modo Claro (Light Mode)** e **Modo Escuro (Dark Mode)**.

## 📝 Trabalho Formativo — Habilitação Técnica em Desenvolvimento de Sistemas (SENAI-SP)
### **Unidade Curricular:** Programação para Dispositivos Móveis (PPDM)

---

## 👥 Identificação da Equipe e Turma
* **Unidade:** SENAI-SP (Serviço Nacional de Aprendizagem Industrial)
* **Curso:** Técnico em Desenvolvimento de Sistemas
* **Componentes da Equipe:**
  * Airam D' Avilla Costa
  * João Marcelo Monteiro de Oliveira
  * Pietro Dipiassa Araya Tapia

---

---

## 📱 Fluxo de Telas (Navegação Interna)

1. **Tela de Login**:
   - Autenticação com e-mail, senha e nome do motorista.
   - Salvamento de preferências e nome do usuário via `AsyncStorage`.
   - Atalhos de login social (Google e Apple).
   - Chave alternadora de tema (Light / Dark).

2. **Dashboard / Tela Principal**:
   - Saudação personalizada (*"Olá, [Nome do Motorista]!"*).
   - **📡 Diagnóstico de Condução**: Leitura em tempo real do sensor Acelerômetro utilizando cálculo de Magnitude Vetorial (`mag = √(x² + y² + z²)`). Exibe *"🎯 Condução Segura"* ou *"⚠️ Impacto Brusco/Pista Irregular Detectada"*.
   - **Histórico SQLite**: Listagem dinâmica de registros contendo foto, modelo, placa, quilometragem, data/hora e coordenadas GPS da oficina (*Lat/Long*).
   - Botões de ação rápida para alternar status (*Pendente* / *Concluído*) e exclusão de registros.
   - Botão Flutuante (FAB) para navegação rápida para o formulário.

3. **Tela de Cadastro (Formulário)**:
   - Entrada de dados: Modelo do Veículo, Placa, Quilometragem Atual e Descrição da Modificação.
   - **📷 Câmera**: Captura de foto do painel, odômetro ou peça trocada com pré-visualização (preview).
   - **📍 GPS**: Mapeamento automático da latitude e longitude do local/oficina no momento do registro.
   - Inserção de dados na tabela do SQLite e acionamento de notificação de confirmação.

---

## 🛠️ Tecnologias Utilizadas

- **Framework**: [React Native](https://reactnative.dev/) + [Expo](https://expo.dev/) (SDK 53+)
- **Navegação**: [Expo Router](https://docs.expo.dev/router/introduction/) (Stack Navigation)
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/)
- **Banco de Dados Local**: `expo-sqlite`
- **Armazenamento de Preferências**: `@react-native-async-storage/async-storage`
- **Sensores e Recursos Nativos**:
  - `expo-sensors`: Leitura do Acelerômetro em tempo real.
  - `expo-location`: Coleta de coordenadas geográficas via GPS.
  - `expo-image-picker`: Integração com Câmera e Galeria.
  - `expo-notifications`: Notificações locais com tratamento de compatibilidade.

---

## 📁 Estrutura de Pastas

O projeto adota uma arquitetura simplificada de ficheiro único para as telas com configuração de layout via Expo Router:

```
📁 Avaliacao_Formativa/
├── 📁 .github/
├── 📁 assets/
├── 📁 docs/                    <-- Capturas de tela (screenshots) e Wireframes
│   ├── wireframe-figma.png
│   ├── tela-light-mode.png
│   └── tela-dark-mode.png
├── 📄 .gitignore
├── 📄 App.tsx     <-- Código-fonte do aplicativo nativo
├── 📄 package.json
└── 📄 README.md                <-- Documentação Técnica Completa do Projeto
```

## 🚀 Como Executar o Projeto

### Pré-requisitos
- **Node.js** instalado na máquina (versão LTS recomendada).
- Aplicativo **Expo Go** instalado no seu smartphone (Android/iOS) ou um emulador configurado.

### Passo a Passo

1. **Clonar o repositório e navegar até a pasta:**
   ```bash
   git clone [https://github.com/seu-usuario/carlog.git](https://github.com/seu-usuario/carlog.git)
   cd carlog

```

2. **Instalar as dependências do projeto:**
```bash
npm install

```


3. **Iniciar o servidor do Expo com limpeza de cache:**
```bash
npx expo start -c

```


4. **Testar no dispositivo:**
* Escaneie o **QR Code** gerado no terminal usando a câmera (iOS) ou abra o aplicativo **Expo Go** e leia o código (Android).



---

## ⚡ Tratamento de Compatibilidade (Expo Go SDK 53+)

A partir do Expo SDK 53, o suporte nativo a notificações push para Android foi alterado no Expo Go. Para garantir estabilidade e evitar que o aplicativo encerre inesperadamente (*crash*), o código conta com um **módulo de isolamento (`try/catch` + `require` dinâmico)** que desativa chamadas incompatíveis e utiliza um simulador (*mock*) em tempo de execução durante os testes.

---

## 📄 Licença

Este projeto foi desenvolvido para fins acadêmicos e demonstrativos. Livre para modificação e aprimoramento.