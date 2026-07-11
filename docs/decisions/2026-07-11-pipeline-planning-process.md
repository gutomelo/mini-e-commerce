# How the Build Pipeline Was Planned / Como a Pipeline de Construção Foi Planejada

> Bilingual document: American English first, Português do Brasil below.
> Documento bilíngue: inglês americano primeiro, português do Brasil abaixo.

---

## English (US)

### Purpose

This document records **how** the Claude Code AI build pipeline for Mini E-Commerce was designed on 2026-07-11 — the planning method used and the decisions that shaped it — so the reasoning stays auditable as the project grows. The resulting design lives in the [pipeline spec](../specs/2026-07-11-claude-code-pipeline-design.md).

### Planning method

The pipeline was designed before any application code existed, following a structured five-step process:

1. **Plan Mode.** The session entered Claude Code's Plan Mode, a read-only phase where no files can be changed. This forced the design to be fully explored and approved before implementation.
2. **Context exploration.** The repository state was surveyed first: only the 8 installed best-practice skills, the engineering rules (`.claude/rules/rules-global.md`), and a stub `CLAUDE.md` existed — a greenfield for the pipeline.
3. **Brainstorming skill.** The `brainstorming` skill drove requirement discovery: clarifying questions asked **one at a time**, each as a multiple-choice prompt with trade-offs and a marked recommendation. Five decisions came out of this (see the decision log below).
4. **Design and approval gate.** The complete design was written to a plan file and approved by the user through the Plan Mode exit gate. Only then did implementation start — mirroring the same "no code before an approved spec" rule the pipeline itself enforces.
5. **Implementation with verification.** Every artifact was built, then verified: 18 automated checks against the hook scripts (sample payloads for secrets blocking, commit-message validation, session context, formatting no-ops), JSON validation of `settings.json`, and a placeholder scan of all documents. Work was committed in Conventional Commits that passed through the newly created commit hook — the pipeline validated itself.

### Decision log

| # | Decision | Options considered | Chosen | Rationale |
|---|----------|--------------------|--------|-----------|
| 1 | Roadmap slicing | (a) walking skeleton + one phase per service; (b) strictly per service; (c) vertical feature slices | **(a)** | Proves cross-service integration early (`docker compose up` green in Phase 1) while keeping each later phase focused on a single stack — better context for specialist agents and reviewers. |
| 2 | Agent granularity | (a) 5 stack specialists + reviewer; (b) compact team of 3; (c) no subagents | **(a)** | Each agent carries only its stack's skills and rules, producing focused context and demonstrating role-based orchestration — a portfolio goal in itself. |
| 3 | Enforcement hooks | Any subset of: post-edit formatting, secrets protection, Conventional Commits validation, session phase context | **All four** | Hooks are deterministic — they enforce the rules regardless of model behavior. Formatting removes noise, secrets protection enforces the security rule, commit validation guards history, session context keeps every session aware of the current phase. |
| 4 | Checklist gating | (a) blocking gate with automated verification; (b) advisory verification; (c) manual checkboxes | **(a)** | Mirrors a real Definition of Done: a phase is `Done` only when every verification command passes, and the next phase cannot start before that. Honest state over convenient state. |
| 5 | Workflow orchestration | (a) 5 dedicated skills; (b) 1 skill with subcommands; (c) conventions only | **(a)** | Single Responsibility applied to the process itself: each workflow step (`/create-spec`, `/plan-phase`, `/implement-phase`, `/verify-phase`, `/project-status`) is independently discoverable, documented, and replaceable. |

### Supporting decisions made during implementation

- **Spec location:** `docs/specs/` (project convention) instead of the brainstorming skill's default `docs/superpowers/specs/`.
- **Hook payload parsing:** `jq → python3 → sed` fallback chain, because the development machine has no `jq`. Commit validation **fails open** when a message cannot be extracted (commitlint will enforce it again at the git level from Phase 0), and only acts when `git commit` sits in command position — preventing false blocks on commands that merely mention it.
- **Fly.io topology** (single container with a supervisor vs. one Fly app per service): explicitly deferred to the Phase 8 spec as an open question, rather than guessed now.
- **Language policy:** every artifact in American English, recorded in `CLAUDE.md` (this document is bilingual by explicit user request).

### Outcome

22 files created across `.claude/` (5 workflow skills, 6 agents, 4 hooks, `settings.json`) and `docs/` (roadmap, 2 templates, Phase 00 checklist, pipeline spec), plus the `CLAUDE.md` workflow guide — delivered in commits `08a1374` and `1c6810b`, both validated by the pipeline's own commit hook.

---

## Português (Brasil)

### Objetivo

Este documento registra **como** a pipeline de construção com IA (Claude Code) do Mini E-Commerce foi projetada em 11/07/2026 — o método de planejamento utilizado e as decisões que a moldaram — para que o raciocínio permaneça auditável conforme o projeto cresce. O design resultante está no [spec da pipeline](../specs/2026-07-11-claude-code-pipeline-design.md).

### Método de planejamento

A pipeline foi projetada antes de existir qualquer código de aplicação, seguindo um processo estruturado em cinco etapas:

1. **Plan Mode.** A sessão entrou no Plan Mode do Claude Code, uma fase somente leitura em que nenhum arquivo pode ser alterado. Isso obrigou o design a ser totalmente explorado e aprovado antes da implementação.
2. **Exploração de contexto.** O estado do repositório foi levantado primeiro: existiam apenas as 8 skills de boas práticas instaladas, as regras de engenharia (`.claude/rules/rules-global.md`) e um `CLAUDE.md` mínimo — um terreno limpo para a pipeline.
3. **Skill de brainstorming.** A skill `brainstorming` conduziu a descoberta de requisitos: perguntas de esclarecimento feitas **uma por vez**, cada uma em formato de múltipla escolha com trade-offs e uma recomendação marcada. Cinco decisões saíram desse processo (ver o registro de decisões abaixo).
4. **Design e portão de aprovação.** O design completo foi escrito em um arquivo de plano e aprovado pelo usuário através do portão de saída do Plan Mode. Só então a implementação começou — espelhando a mesma regra de "nenhum código antes de um spec aprovado" que a própria pipeline impõe.
5. **Implementação com verificação.** Cada artefato foi construído e depois verificado: 18 checagens automatizadas contra os scripts de hook (payloads de exemplo para bloqueio de secrets, validação de mensagem de commit, contexto de sessão e no-ops de formatação), validação do JSON de `settings.json` e varredura de placeholders em todos os documentos. O trabalho foi commitado em Conventional Commits que passaram pelo hook de commit recém-criado — a pipeline validou a si mesma.

### Registro de decisões

| # | Decisão | Opções consideradas | Escolhida | Justificativa |
|---|---------|---------------------|-----------|---------------|
| 1 | Fatiamento do roadmap | (a) walking skeleton + uma fase por serviço; (b) estritamente por serviço; (c) fatias verticais de funcionalidade | **(a)** | Comprova a integração entre serviços cedo (`docker compose up` verde na Fase 1) e mantém cada fase posterior focada em uma única stack — melhor contexto para os agentes especialistas e revisores. |
| 2 | Granularidade dos agentes | (a) 5 especialistas por stack + revisor; (b) time compacto de 3; (c) sem subagentes | **(a)** | Cada agente carrega apenas as skills e regras da sua stack, produzindo contexto focado e demonstrando orquestração por papéis — um objetivo do portfolio em si. |
| 3 | Hooks de enforcement | Qualquer subconjunto de: formatação pós-edição, proteção de secrets, validação de Conventional Commits, contexto de fase na sessão | **Todos os quatro** | Hooks são determinísticos — impõem as regras independentemente do comportamento do modelo. Formatação elimina ruído, proteção de secrets aplica a regra de segurança, validação de commits protege o histórico e o contexto de sessão mantém cada sessão ciente da fase atual. |
| 4 | Controle do checklist | (a) gate bloqueante com verificação automatizada; (b) verificação advisory; (c) checkboxes manuais | **(a)** | Espelha um Definition of Done real: uma fase só fica `Done` quando todos os comandos de verificação passam, e a próxima fase não pode começar antes disso. Estado honesto acima de estado conveniente. |
| 5 | Orquestração do workflow | (a) 5 skills dedicadas; (b) 1 skill com subcomandos; (c) apenas convenções | **(a)** | Responsabilidade Única aplicada ao próprio processo: cada etapa do workflow (`/create-spec`, `/plan-phase`, `/implement-phase`, `/verify-phase`, `/project-status`) é descobrível, documentada e substituível de forma independente. |

### Decisões de apoio tomadas durante a implementação

- **Local dos specs:** `docs/specs/` (convenção do projeto) em vez do padrão `docs/superpowers/specs/` da skill de brainstorming.
- **Parsing do payload dos hooks:** cadeia de fallback `jq → python3 → sed`, porque a máquina de desenvolvimento não tem `jq`. A validação de commit **falha aberta** quando a mensagem não pode ser extraída (o commitlint voltará a impor a regra no nível do git a partir da Fase 0) e só age quando `git commit` está em posição de comando — evitando bloqueios falsos em comandos que apenas o mencionam.
- **Topologia no Fly.io** (container único com supervisor vs. um app Fly por serviço): explicitamente adiada para o spec da Fase 8 como questão aberta, em vez de decidida por palpite agora.
- **Política de idioma:** todos os artefatos em inglês americano, registrada no `CLAUDE.md` (este documento é bilíngue por solicitação explícita do usuário).

### Resultado

22 arquivos criados em `.claude/` (5 skills de workflow, 6 agentes, 4 hooks, `settings.json`) e `docs/` (roadmap, 2 templates, checklist da Fase 00, spec da pipeline), além do guia de workflow no `CLAUDE.md` — entregues nos commits `08a1374` e `1c6810b`, ambos validados pelo próprio hook de commit da pipeline.
