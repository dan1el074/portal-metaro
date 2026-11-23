# Organizacao da aplicacao

O projeto segue uma organizacao **por funcionalidade**. Cada modulo de negocio
deve concentrar suas camadas no mesmo pacote:

```text
br.com.metaro.portal
|-- config
|-- integration
|   `-- bunny
|-- core
|   |-- controller
|   |-- dto
|   |-- entities
|   |-- repositories
|   `-- services
|-- modules
|   |-- quality
|   |   `-- checklist
|   |       |-- controller
|   |       |-- dto
|   |       |-- entity
|   |       |-- repository
|   |       `-- service
|   `-- general
|       `-- memorando
|           |-- controller
|           |-- dto
|           |-- entity
|           |-- repository
|           |-- service
|           `-- util
`-- util
    |-- erp
    |-- picture
    `-- video
```

## Convencoes

- Pacotes usam letras minusculas e nomes no singular.
- Controllers apenas traduzem HTTP para chamadas da camada de servico.
- Services concentram casos de uso e limites transacionais.
- Repositories tratam exclusivamente da persistencia.
- DTOs representam contratos de entrada e saida; entidades JPA nao devem ser
  expostas diretamente pela API.
- Objetos de transferencia sao classes DTO; a aplicacao nao utiliza a palavra-chave record.
- Metodos descrevem a intencao: `listMemorandos`, `getMemorando`,
  `createMemorando` e `returnMemorandoToDraft`, em vez de nomes genericos ou
  ambiguos.

O modulo `memorando` foi normalizado como referencia para a migracao gradual
dos demais modulos. Essa abordagem evita uma alteracao massiva de pacotes sem
ganho funcional imediato.

O modulo `quality/checklist` usa o mesmo desenho por funcionalidade. As
configuracoes editaveis ficam nas entidades atuais, enquanto cada fluxo guarda
snapshots de categoria e modelo. Assim, alteracoes administrativas valem para
novos fluxos sem reescrever inspecoes ja iniciadas. Transicoes de registro,
geracao de sucessores, revisoes, tratamentos e auditoria pertencem aos services
e sao executadas em transacoes.

## Integracoes e recursos compartilhados

- `integration/bunny` contem apenas o cliente HTTP e as propriedades do Bunny
  Stream. Esse pacote nao conhece modulos de negocio.
- `util/video` concentra entidade, repositorio, ciclo de vida e DTOs
  reutilizaveis de video.
- Modulos como `stepFlow` associam um `Video` ao proprio agregado e aplicam
  suas regras de autorizacao. A entidade compartilhada nao referencia classes
  dos modulos consumidores.
- `util/picture` cumpre o mesmo papel para imagens e deve ser evoluido
  gradualmente para reduzir referencias reversas aos modulos.
- `util/erp` e a unica camada que conhece o segundo `DataSource`, SQL do
  Oracle e DTOs retornados pelo ERP. `stepFlow` mantem apenas a regra local de
  saldo produzido; `memorando` consome a consulta compartilhada de linhas do
  pedido.

## Imagens e thumbnails

As imagens sao armazenadas no diretorio configurado por
`app.server.image-path` (`IMAGE_PATH`). A entidade `Picture` guarda o caminho
da imagem original em `path` e o caminho da miniatura em `thumb`. A coluna
`thumb` foi adicionada pela migracao `V7__add_picture_thumbnail.sql` e pode ser
nula para manter compatibilidade com imagens criadas anteriormente.

O endpoint `GET /images/{id}/thumb` implementa a geracao sob demanda:

1. Se `Picture.thumb` aponta para um arquivo existente, esse arquivo e
   retornado.
2. Se `thumb` esta nulo ou o arquivo nao existe, o backend le a imagem
   original, gera uma miniatura JPEG de no maximo 240 pixels no maior lado e
   persiste o novo caminho em `Picture.thumb`.
3. A miniatura usa o mesmo nome de arquivo da imagem original, mas fica no
   diretorio irmao `thumbs`.

```text
servidor/
|-- imagens/
|   `-- STEP_FLOW....jpg
`-- thumbs/
    `-- STEP_FLOW....jpg
```

Na pagina `/general/step-flow`, os componentes de offcanvas usam esse endpoint
somente para os previews de imagens. O link do card continua apontando para
`GET /images/{id}`, preservando a visualizacao da imagem original. Videos
continuam usando o fluxo de preview do provedor de video e nao geram arquivos
nesse diretorio.

Ao excluir uma `Picture`, os arquivos original e thumbnail sao removidos. Ao
substituir a imagem original, a thumbnail anterior e apagada e o atributo
`thumb` volta a ser nulo para que uma versao atualizada seja criada no proximo
preview.

## E-mail

O perfil `dev` usa `localhost:1025` por padrao e espera um capturador SMTP
local. Para enviar mensagens reais, configure as variaveis abaixo antes de
iniciar a aplicacao:

- `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME` e `MAIL_PASSWORD`.
- `MAIL_SMTP_AUTH`, `MAIL_SMTP_SSL` e `MAIL_SMTP_STARTTLS`.
- `MAIL_CONNECTION_TIMEOUT`, `MAIL_READ_TIMEOUT` e `MAIL_WRITE_TIMEOUT`.

Falhas sao registradas por destinatario e nao interrompem as notificacoes dos
demais usuarios envolvidos no memorando.

## Banco de dados

O Flyway e o unico responsavel por alterar o esquema. Em producao, o Hibernate
usa `ddl-auto=validate` e falha cedo quando as entidades divergem do banco. No
perfil `dev`, a validacao fica desabilitada porque o H2 reporta tipos temporais
de forma diferente do PostgreSQL; mesmo assim, o Hibernate nunca cria tabelas.

- `db/migration`: migracoes de esquema aplicadas em todos os ambientes.
- `db/devdata`: dados de demonstracao aplicados apenas com o perfil `dev`.

Para um banco ja existente, a primeira inicializacao usa
`FLYWAY_BASELINE_ON_MIGRATE=true`. Depois que a tabela de historico for criada,
configure essa variavel como `false`.

## OpenAPI

- Swagger UI: `/swagger-ui.html`
- Documento OpenAPI: `/v3/api-docs`
- Grupos: `core`, `modules` e `utilities`

Use o botao **Authorize** do Swagger UI para informar um token JWT.
