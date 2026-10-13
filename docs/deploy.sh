#!/bin/bash

set -Eeuo pipefail

CONFIG_FILE="/etc/portal-deploy.conf"

[[ -r "$CONFIG_FILE" ]] || {
    echo "Configuração ausente: $CONFIG_FILE"
    exit 1
}

source "$CONFIG_FILE"

REQUIRED_VARIABLES=(
    ENVIRONMENT DEPLOY_BRANCH PROJECT_DIR APP_DIR THUMBNAIL_DIR NGINX_DIR
    DATABASE_NAME APP_SERVICE NGINX_SERVICE BACKUP_ROOT
    BACKUP_KEEP LOG_ROOT BACKEND_HEALTH_URL BACKEND_HEALTH_TIMEOUT
    BACKEND_HEALTH_INTERVAL FRONTEND_HEALTH_URL
)

for VARIABLE in "${REQUIRED_VARIABLES[@]}"; do
    [[ -n "${!VARIABLE:-}" ]] || {
        echo "Variável ausente: $VARIABLE"
        exit 1
    }
done

[[ "$BACKUP_KEEP" =~ ^[1-9][0-9]*$ ]] || {
    echo "BACKUP_KEEP inválido"
    exit 1
}

[[ "$BACKEND_HEALTH_TIMEOUT" =~ ^[1-9][0-9]*$ ]] || {
    echo "BACKEND_HEALTH_TIMEOUT inválido"
    exit 1
}

[[ "$BACKEND_HEALTH_INTERVAL" =~ ^[1-9][0-9]*$ ]] || {
    echo "BACKEND_HEALTH_INTERVAL inválido"
    exit 1
}

[[ "$DEPLOY_BRANCH" == "main" || "$DEPLOY_BRANCH" == "prod" || "$DEPLOY_BRANCH" == "test" ]] || {
    echo "Branch não permitida: $DEPLOY_BRANCH"
    exit 1
}

[[ "$THUMBNAIL_DIR" == "$APP_DIR/"* ]] || {
    echo "Diretório de thumbnails inválido: $THUMBNAIL_DIR"
    exit 1
}

BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
PROD_CONFIG="$BACKEND_DIR/src/main/resources/application-prod.properties"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
RELEASE_BACKUP="$BACKUP_ROOT/$TIMESTAMP"
LOG_FILE="$LOG_ROOT/deploy-$TIMESTAMP.log"

NEW_JAR="$APP_DIR/app.jar.new-$TIMESTAMP"
NEW_FRONTEND="$NGINX_DIR.new-$TIMESTAMP"
OLD_FRONTEND="$NGINX_DIR.old-$TIMESTAMP"

APP_STOPPED=false
ARTIFACTS_REPLACED=false

exec 9>"$LOG_ROOT/portal-operation.lock"

flock -n 9 || {
    echo "Já existe um deploy ou rollback em execução"
    exit 1
}

exec > >(tee -a "$LOG_FILE") 2>&1

message() {
    echo
    echo -e "[\e[32mDEPLOY\e[0m] $1"
}

abort_deploy() {
    EXIT_CODE="${2:-1}"
    trap - ERR

    echo
    echo -e "[\e[31mERRO\e[0m] $1"

    if [[ "$APP_STOPPED" == "true" &&
          "$ARTIFACTS_REPLACED" == "false" ]]; then
        echo "Reiniciando o backend original..."
        sudo systemctl start "$APP_SERVICE" || true
    fi

    if [[ "$ARTIFACTS_REPLACED" == "true" ]]; then
        echo "Os artefatos já foram alterados."
        echo "Use rollback.sh com o backup: $TIMESTAMP"
    fi

    journalctl -u "$APP_SERVICE" -n 50 --no-pager || true

    echo "Log: $LOG_FILE"
    exit "$EXIT_CODE"
}

trap 'abort_deploy "Falha inesperada na linha $LINENO" "$?"' ERR

message "Iniciando deploy"
echo "Ambiente: $ENVIRONMENT"
echo "Branch: $DEPLOY_BRANCH"
echo "Data: $(date)"
echo "Log: $LOG_FILE"

sudo -v

message "Validando ambiente"

[[ -d "$PROJECT_DIR/.git" ]] ||
    abort_deploy "Repositório não encontrado"

[[ -s "$PROD_CONFIG" ]] ||
    abort_deploy "application-prod.properties ausente"

grep -qx "spring.jpa.hibernate.ddl-auto=none" "$PROD_CONFIG" ||
    abort_deploy "ddl-auto precisa estar como none"

grep -qx \
    "spring.jpa.defer-datasource-initialization=false" \
    "$PROD_CONFIG" ||
    abort_deploy "defer-datasource-initialization precisa ser false"

SERVICE_ENVIRONMENT="$(
    systemctl show "$APP_SERVICE" -p Environment --value
)"

grep -qw "APP_PROFILE=prod" <<< "$SERVICE_ENVIRONMENT" ||
    abort_deploy "APP_PROFILE=prod não está configurado"

grep -qw \
    "FLYWAY_BASELINE_ON_MIGRATE=false" \
    <<< "$SERVICE_ENVIRONMENT" ||
    abort_deploy "O baseline do Flyway precisa estar desativado"

message "Atualizando o código"

cd "$PROJECT_DIR"

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    git status --short
    abort_deploy "Existem alterações em arquivos versionados"
fi

git fetch --prune origin "$DEPLOY_BRANCH"
git switch --detach "origin/$DEPLOY_BRANCH"

echo "Commit:"
git log --oneline -1

message "Build do frontend"

cd "$FRONTEND_DIR"

npm ci
npm run build -- --configuration production

[[ -d "$FRONTEND_DIR/dist/portal-demo/browser" ]] ||
    abort_deploy "Build do frontend não foi encontrado"

message "Build e testes do backend"

cd "$BACKEND_DIR"

APP_PROFILE=dev mvn clean package

mapfile -t JAR_FILES < <(
    find "$BACKEND_DIR/target" \
        -maxdepth 1 \
        -type f \
        -name "*.jar" \
        ! -name "*.jar.original"
)

[[ "${#JAR_FILES[@]}" -eq 1 ]] ||
    abort_deploy "Não foi encontrado um único JAR"

BUILT_JAR="${JAR_FILES[0]}"

unzip -p "$BUILT_JAR" \
    BOOT-INF/classes/application-prod.properties |
    grep -x \
        "spring.jpa.hibernate.ddl-auto=none" \
        > /dev/null ||
    abort_deploy "Configuração incorreta dentro do JAR"

unzip -l "$BUILT_JAR" |
    grep "BOOT-INF/classes/db/migration/" \
        > /dev/null ||
    abort_deploy "Migrations ausentes no JAR"

sha256sum "$BUILT_JAR"

message "Preparando os novos artefatos"

sudo install \
    -d \
    -o metaro \
    -g metaro \
    -m 750 \
    "$THUMBNAIL_DIR"

sudo install \
    -o metaro \
    -g metaro \
    -m 640 \
    "$BUILT_JAR" \
    "$NEW_JAR"

sudo install \
    -d \
    -o www-data \
    -g www-data \
    -m 775 \
    "$NEW_FRONTEND"

sudo cp -a \
    "$FRONTEND_DIR/dist/portal-demo/browser/." \
    "$NEW_FRONTEND/"

sudo chown -R www-data:www-data "$NEW_FRONTEND"

message "Criando backup $TIMESTAMP"

mkdir -p "$RELEASE_BACKUP"
chmod 700 "$RELEASE_BACKUP"

sudo install \
    -o metaro \
    -g metaro \
    -m 600 \
    "$APP_DIR/app.jar" \
    "$RELEASE_BACKUP/app.jar"

cp "$PROD_CONFIG" \
   "$RELEASE_BACKUP/application-prod.properties"

chmod 600 \
    "$RELEASE_BACKUP/application-prod.properties"

sudo cp -a \
    "$NGINX_DIR" \
    "$RELEASE_BACKUP/frontend"

sudo systemctl stop "$APP_SERVICE"
APP_STOPPED=true

sudo -u postgres pg_dump \
    --format=custom \
    --create \
    "$DATABASE_NAME" \
    > "$RELEASE_BACKUP/database.dump"

chmod 600 "$RELEASE_BACKUP/database.dump"

printf '%s\n' \
    "timestamp=$TIMESTAMP" \
    "environment=$ENVIRONMENT" \
    "branch=$DEPLOY_BRANCH" \
    "previous_commit=$(git rev-parse HEAD)" \
    > "$RELEASE_BACKUP/manifest.txt"

touch "$RELEASE_BACKUP/READY"

message "Publicando o backend"

sudo mv "$NEW_JAR" "$APP_DIR/app.jar"
ARTIFACTS_REPLACED=true

sudo systemctl start "$APP_SERVICE"
APP_STOPPED=false

BACKEND_READY=false
BACKEND_HEALTH_DEADLINE=$((SECONDS + BACKEND_HEALTH_TIMEOUT))
BACKEND_HEALTH_NEXT_STATUS=$((SECONDS + 30))

message "Aguardando o backend por até ${BACKEND_HEALTH_TIMEOUT}s"

while (( SECONDS < BACKEND_HEALTH_DEADLINE )); do
    if systemctl is-active --quiet "$APP_SERVICE" &&
       curl --fail --silent --output /dev/null \
           --connect-timeout 1 --max-time 2 \
           "$BACKEND_HEALTH_URL"; then
        BACKEND_READY=true
        break
    fi

    if (( SECONDS >= BACKEND_HEALTH_NEXT_STATUS )); then
        echo "Backend ainda está inicializando ($((BACKEND_HEALTH_TIMEOUT - BACKEND_HEALTH_DEADLINE + SECONDS))s decorridos)..."
        BACKEND_HEALTH_NEXT_STATUS=$((BACKEND_HEALTH_NEXT_STATUS + 30))
    fi

    BACKEND_HEALTH_REMAINING=$((BACKEND_HEALTH_DEADLINE - SECONDS))
    (( BACKEND_HEALTH_REMAINING > 0 )) || break
    (( BACKEND_HEALTH_REMAINING < BACKEND_HEALTH_INTERVAL )) &&
        sleep "$BACKEND_HEALTH_REMAINING" ||
        sleep "$BACKEND_HEALTH_INTERVAL"
done

[[ "$BACKEND_READY" == "true" ]] ||
    abort_deploy "O novo backend não iniciou corretamente"

message "Publicando o frontend"

sudo mv "$NGINX_DIR" "$OLD_FRONTEND"
sudo mv "$NEW_FRONTEND" "$NGINX_DIR"

sudo nginx -t

if systemctl is-active --quiet "$NGINX_SERVICE"; then
    sudo systemctl reload "$NGINX_SERVICE"
else
    sudo systemctl start "$NGINX_SERVICE"
fi

curl --fail --silent --location --output /dev/null \
    "$FRONTEND_HEALTH_URL"

[[ "$OLD_FRONTEND" == "$NGINX_DIR.old-$TIMESTAMP" ]] ||
    abort_deploy "Diretório temporário inesperado"

sudo rm -rf -- "$OLD_FRONTEND"

touch "$RELEASE_BACKUP/DEPLOY_SUCCESS"

message "Removendo backups excedentes"

mapfile -t AVAILABLE_BACKUPS < <(
    find "$BACKUP_ROOT" \
        -mindepth 1 \
        -maxdepth 1 \
        -type d \
        -name "????????-??????" \
        -printf "%f\n" |
    sort -r
)

for ((
    INDEX=BACKUP_KEEP;
    INDEX<${#AVAILABLE_BACKUPS[@]};
    INDEX++
)); do
    BACKUP_NAME="${AVAILABLE_BACKUPS[$INDEX]}"

    [[ "$BACKUP_NAME" =~ ^[0-9]{8}-[0-9]{6}$ ]] ||
        continue

    BACKUP_TO_REMOVE="$BACKUP_ROOT/$BACKUP_NAME"

    [[ "$BACKUP_TO_REMOVE" == "$BACKUP_ROOT/"* ]] ||
        abort_deploy "Caminho de limpeza inválido"

    sudo rm -rf -- "$BACKUP_TO_REMOVE"
    echo "Removido: $BACKUP_NAME"
done

trap - ERR

message "Deploy concluído com sucesso"

echo "Commit: $(git rev-parse --short HEAD)"
echo "Backup: $RELEASE_BACKUP"
echo "Log: $LOG_FILE"

systemctl is-active "$APP_SERVICE"
systemctl is-active "$NGINX_SERVICE"

sudo -u postgres psql \
    -d "$DATABASE_NAME" \
    -c "SELECT version, description, success
        FROM flyway_schema_history
        ORDER BY installed_rank;"
