# Plataforma Metaro

A **Plataforma Metaro** centraliza processos internos e ferramentas utilizadas
pelos diferentes setores da empresa. O repositório reúne a API, a interface web
e o aplicativo Android da solução.

<p align="center">
  <img width="100%" alt="Tela principal da Plataforma Metaro" src="https://github.com/user-attachments/assets/15e1a126-c5fe-40dd-9c9c-ad023c07613c">
</p>

## Componentes

```text
portal-demo/
├── backend/    # API - Java 21, Spring Boot 3.4, Spring Security, JPA, Flyway, PostgreSQL, H2 e Oracle
├── frontend/   # SPA - Angular 21, CoreUI 5, Angular Material, RxJS e SCSS
└── mobile/     # APP - Kotlin, Android SDK 36 e WebView
```

O frontend e o aplicativo Android consomem a mesma API. O aplicativo móvel
encapsula o portal em uma WebView e oferece integrações nativas para arquivos,
PDFs, câmera e links externos.

## Funcionalidades

- [PCP — Nº Série/Plaquetas: especificação funcional, backend e implantação](docs/pcp-serial-plates.md).

- Autenticação por JWT e autorização baseada em perfis.
- Mural eletrônico para comunicados e avisos internos.
- Gerenciamento e compartilhamento de arquivos.
- Integração com PostgreSQL, Oracle, bunny.net e Focco ERP.

## Pré-requisitos

- JDK 21 para o backend.
- Node.js `20.19+`, `22.12+` ou `24+` e npm 10+ para o frontend.
- Android Studio, JDK 17+ e Android SDK 36 para o aplicativo móvel.
- Acesso à rede corporativa ou VPN para funcionalidades que consultam o ERP.

## Execução local

### 1. Backend

No Windows:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

No Linux ou macOS:

```bash
cd backend
./mvnw spring-boot:run
```

Por padrão, a aplicação usa o perfil `dev`:

- API: <http://localhost:8080>
- banco principal: H2 em memória;
- console H2: <http://localhost:8080/h2-console>
- URL JDBC: `jdbc:h2:mem:portal`
- usuário: `sa`
- senha: vazia.

A integração com o ERP usa um segundo `DataSource`. Seus valores de
desenvolvimento ficam em `backend/src/main/resources/application-dev.properties`
e podem ser substituídos pelas variáveis:

```text
EXTERNAL_DATASOURCE_JDBC_URL
EXTERNAL_DATASOURCE_USERNAME
EXTERNAL_DATASOURCE_PASSWORD
EXTERNAL_DATASOURCE_DRIVER_CLASS_NAME
```

### Busca de projetos PDF

A busca consulta dois compartilhamentos no mesmo servidor, `metaro-server2`.
Nos perfis `dev` e `prod`, `app.smb.hostname=192.168.1.250` define esse servidor,
usando `app.smb.username` e `app.smb.password` para ambos os compartilhamentos.
A pasta antiga, `Projetos`, é configurada em `app.smb.legacy-projects-path` e
mantém as subpastas por código. A pasta nova, `Projetos PDF`, é configurada em
`app.smb.projects-path` e contém os PDFs diretamente na raiz.

Na pasta nova, versões com sufixo `_dd.MM.aa_HH.mm.pdf` (ou ano com quatro
dígitos) são omitidas. Complementos como `-ADQ`, `-DET1` e `_FABR1` continuam
visíveis. Ocorrências da pasta antiga são preservadas, mesmo com nomes iguais.
O modal identifica cada origem com o badge `novo` ou `antigo`.

`GET /api/pdf/search?term=60390` retorna objetos com `fileName` e `source`.
Para abrir o resultado, use `GET /api/pdf/{fileName}?source=NEW` ou `source=OLD`.
Sem `source`, a abertura continua usando a pasta antiga. Publique backend e
frontend juntos, pois o formato da resposta da busca mudou.

Os cards de arquivos acessam `\\metaro-server2\Arquivos\TI\Outros\portal`.
Nos dois perfis, `app.smb.files-path=Arquivos` define o compartilhamento;
o backend abre os arquivos na subpasta `TI/Outros/portal`, usando o mesmo
`app.smb.hostname`, usuário e senha da busca de projetos.

### 2. Frontend

```powershell
cd frontend
npm install
npm start
```

O portal estará disponível em <http://localhost:4200> e, no ambiente de
desenvolvimento, consumirá a API em <http://localhost:8080>.

### 3. Aplicativo Android

1. Abra a pasta `mobile` no Android Studio.
2. Aguarde a sincronização do Gradle.
3. Selecione uma variante em **Build Variants**:
   - `homologacaoDebug` para testes;
   - `producaoRelease` para distribuição.
4. Conecte um dispositivo com depuração USB ou use um emulador.
5. Execute o módulo `app`.

Consulte o [`mobile/README.md`](mobile/README.md) para detalhes sobre WebView.

## Documentação da API

Com o backend em execução:

- Swagger UI: <http://localhost:8080/swagger-ui/index.html>
- documento OpenAPI em JSON: <http://localhost:8080/v3/api-docs>

No Swagger, use o botão **Authorize** e informe o token JWT. Os endpoints estão
organizados nos grupos `core`, `modules` e `utilities`.

## Banco de dados e Flyway

O Flyway é o responsável por criar e evoluir o esquema:

```text
backend/src/main/resources/db/
├── migration/  # Migrações aplicadas em todos os ambientes
└── devdata/    # Dados de demonstração exclusivos do perfil dev
```

As migrações seguem o padrão:

```text
V<versão>__<descrição>.sql
```

Exemplo: `V2__create_audit_table.sql`.

O Hibernate não altera o banco em produção: `ddl-auto=validate` apenas verifica
se as entidades correspondem ao esquema. Em um banco preexistente, a primeira
execução pode usar `FLYWAY_BASELINE_ON_MIGRATE=true`; depois da criação do
histórico do Flyway, altere para `false`.

## Organização do backend

O backend adota organização por funcionalidade. Cada módulo concentra suas
camadas no mesmo pacote:

```text
br.com.metaro.portal
├── config
├── core
├── integration
│   └── bunny
├── modules
│   └── general
│       └── memorando
│           ├── controller
│           ├── dto
│           ├── entity
│           ├── repository
│           ├── service
│           └── util
└── util
    ├── picture
    └── video
```

Controllers tratam contratos HTTP, services concentram os casos de uso,
repositories cuidam da persistência e DTOs representam entradas e saídas. Os
métodos devem expressar intenção, evitando nomes genéricos.

Clientes de serviços externos ficam em `integration`; entidades e serviços
reutilizáveis, como `Picture` e `Video`, ficam em `util`. Os módulos de negócio
apenas associam esses recursos aos próprios e aplicam suas regras.

Mais detalhes estão em [`backend/ARCHITECTURE.md`](backend/ARCHITECTURE.md).

## Configuração do backend

As configurações sensíveis ou específicas de ambiente podem ser fornecidas por
variáveis:

| Variável | Finalidade | Padrão de desenvolvimento |
|---|---|---|
| `APP_PROFILE` | Perfil Spring ativo | `dev` |
| `CLIENT_ID` | Identificador OAuth2 | `myclientid` |
| `CLIENT_SECRET` | Segredo OAuth2 | `myclientsecret` |
| `JWT_DURATION` | Duração do token em segundos | `86400` |
| `RATE_LIMIT_ENABLED` | Ativa a limitação de requisições | `true` |
| `RATE_LIMIT_CAPACITY` | Requisições permitidas por identidade em cada período | `100` |
| `RATE_LIMIT_REFILL_PERIOD` | Período de renovação do limite | `1m` |
| `RATE_LIMIT_MAX_CLIENTS` | Máximo de identidades mantidas no cache local | `1000` |
| `CORS_ORIGINS` | Origens permitidas pelo CORS | `http://localhost:4200` |
| `IMAGE_PATH` | Diretório de imagens | Configuração local |
| `FLYWAY_BASELINE_ON_MIGRATE` | Adoção de banco preexistente | `true` |
| `BUNNY_STREAM_API_KEY` | Chave da API do Bunny Stream | Sem valor |
| `BUNNY_STREAM_LIBRARY_ID` | Biblioteca de vídeos do Bunny | Sem valor |
| `BUNNY_STREAM_EMBED_BASE_URL` | URL-base do player | Player oficial |

## Testes e builds

Backend:

```powershell
cd backend
.\mvnw.cmd test
```

Frontend:

```powershell
cd frontend
npm test
npm run build
```

Android no Windows:

```powershell
cd mobile
.\gradlew.bat assembleHomologacaoDebug
```

## Limitação de requisições

A API aplica *rate limiting* para reduzir abuso, tentativas automatizadas de
login e sobrecarga causada por excesso de requisições. Por padrão, cada
identidade pode realizar até 100 requisições por minuto:

- usuários autenticados são identificados pelo `userId` presente no JWT;
- o endpoint de login e as rotas públicas são limitados pelo endereço IP;
- usuários que compartilham uma VPN, proxy ou NAT mantêm limites independentes
  depois da autenticação;
- documentação OpenAPI, Swagger UI, WebSocket e console H2 não consomem o limite.

Quando o limite é excedido, a API responde com `429 Too Many Requests`. A
resposta inclui `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` e
`X-RateLimit-Reset`, permitindo que o cliente determine quando tentar novamente.

Os contadores ficam em memória e são locais a cada instância do backend.

## Segurança

- Tokens JWT concedem acesso apenas enquanto estiverem válidos.
- A limitação de requisições complementa a autenticação e não substitui firewall,
  monitoramento, bloqueio de origem ou proteção no gateway.
- O acesso ao ERP deve ficar restrito à rede corporativa ou VPN.
- O aplicativo Android ainda permite HTTP apenas para os domínios configurados.
- Chaves do frontend ficam acessíveis ao navegador e não devem ser tratados
  como credenciais confidenciais.

## Contribuições

Diretor do projeto: [Daniel Rodrigues de Vargas](https://github.com/dan1el074)

Este projeto é de uso interno da Metaro. Mudanças devem ser revisadas por
desenvolvedores autorizados e acompanhar as convenções descritas neste arquivo e
na documentação de arquitetura.

## Licença

Projeto privado. Todos os direitos reservados à Metaro.
