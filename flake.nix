{
  description = "Hospital CRM — reproducible dev shell (Node/TS, Postgres, Redis, k8s, Terraform)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
      in {
        devShells.default = pkgs.mkShell {
          name = "hospital-crm-dev";

          buildInputs = with pkgs; [
            # --- Language toolchain ---
            nodejs_20
            pnpm
            prisma-engines_6

            # --- Datastores (local) ---
            postgresql_16
            redis

            # --- Crypto / TLS ---
            openssl
            jq

            # --- DevOps / Infra ---
            terraform
            kubectl
            kubernetes-helm
            k9s
            kind            # local k8s cluster
            skaffold
            awscli2
            docker-client
            docker-compose

            # --- Shell + ergonomics ---
            zsh
            git
            direnv
            bashInteractive
          ];

          shellHook = ''
            export PGDATA="$PWD/.pgdata"
            export PGHOST="$PWD/.pgsock"
            export PGPORT=5433
            export PGUSER="hospital"
            export PGPASSWORD="hospital_dev"
            export PGDATABASE="hospital_crm"
            export DATABASE_URL="postgresql://$PGUSER:$PGPASSWORD@localhost:$PGPORT/$PGDATABASE"

            export REDIS_HOST=127.0.0.1
            export REDIS_PORT=6380
            export REDIS_URL="redis://$REDIS_HOST:$REDIS_PORT"

            # API auth/session defaults for local development.
            export SESSION_SECRET="dev-session-secret-at-least-32-characters"
            export ACCESS_TOKEN_TTL_SEC=900
            export REFRESH_TOKEN_TTL_SEC=2592000
            export CORS_ORIGINS=""

            # Prisma on NixOS: use engines from nixpkgs instead of downloading
            # unsupported linux-nixos precompiled artifacts.
            export PRISMA_SCHEMA_ENGINE_BINARY="${pkgs.prisma-engines_6}/bin/schema-engine"
            export PRISMA_QUERY_ENGINE_BINARY="${pkgs.prisma-engines_6}/bin/query-engine"
            export PRISMA_FMT_BINARY="${pkgs.prisma-engines_6}/bin/prisma-fmt"
            export PRISMA_CLI_QUERY_ENGINE_TYPE="binary"
            export PRISMA_CLIENT_ENGINE_TYPE="binary"
            export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

            # JWT signing key for QR prescription payloads (regenerated per shell if absent)
            if [ ! -f .secrets/jwt_private.pem ]; then
              mkdir -p .secrets
              ${pkgs.openssl}/bin/openssl genpkey -algorithm RSA \
                -out .secrets/jwt_private.pem -pkeyopt rsa_keygen_bits:2048 2>/dev/null
              ${pkgs.openssl}/bin/openssl rsa -pubout \
                -in .secrets/jwt_private.pem \
                -out .secrets/jwt_public.pem 2>/dev/null
              echo "[flake] generated dev JWT keypair under .secrets/"
            fi
            export JWT_PRIVATE_KEY_PATH="$PWD/.secrets/jwt_private.pem"
            export JWT_PUBLIC_KEY_PATH="$PWD/.secrets/jwt_public.pem"

            echo ""
            echo "Hospital CRM dev shell ready."
            echo "  Run: ./scripts/bootstrap.zsh   to start DBs + migrate + seed"
            echo "  Then: cd services/core-api && pnpm dev"
            echo ""
          '';
        };
      });
}
