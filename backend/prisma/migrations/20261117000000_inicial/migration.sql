-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "status_cliente" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "status_conta" AS ENUM ('ATIVA', 'TOKEN_INVALIDO', 'TOKEN_EXPIRANDO', 'ERRO_SYNC', 'PAUSADA');

-- CreateEnum
CREATE TYPE "categoria_meta" AS ENUM ('MARKETING', 'MARKETING_LITE', 'UTILITY', 'AUTHENTICATION', 'AUTHENTICATION_INTERNATIONAL', 'SERVICE', 'REFERRAL_CONVERSION', 'OUTRA');

-- CreateEnum
CREATE TYPE "tipo_preco" AS ENUM ('REGULAR', 'FREE_CUSTOMER_SERVICE', 'FREE_ENTRY_POINT', 'OUTRO');

-- CreateEnum
CREATE TYPE "qualidade_numero" AS ENUM ('GREEN', 'YELLOW', 'RED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "origem_sync" AS ENUM ('CICLO', 'ADMIN', 'CLIENTE');

-- CreateEnum
CREATE TYPE "status_execucao" AS ENUM ('EXECUTANDO', 'OK', 'ERRO', 'IGNORADA');

-- CreateTable
CREATE TABLE "cliente" (
    "id" UUID NOT NULL,
    "companyid" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "token_chatfast_cifrado" TEXT NOT NULL,
    "token_chatfast_ultimos4" CHAR(4) NOT NULL,
    "status" "status_cliente" NOT NULL DEFAULT 'ATIVO',
    "inativo_desde" DATE,
    "alerta_chatfast" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conta_waba" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "companyid" UUID NOT NULL,
    "waba_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "token_cifrado" TEXT NOT NULL,
    "token_ultimos4" CHAR(4) NOT NULL,
    "token_expira_em" TIMESTAMPTZ(6),
    "moeda" CHAR(3) NOT NULL,
    "fuso" TEXT NOT NULL DEFAULT 'America/Fortaleza',
    "status" "status_conta" NOT NULL DEFAULT 'ATIVA',
    "sem_custo_meta" BOOLEAN NOT NULL DEFAULT false,
    "historico_desde" DATE,
    "ultimo_sync_em" TIMESTAMPTZ(6),
    "ultimo_erro" TEXT,
    "desatualizado_desde" TIMESTAMPTZ(6),
    "sync_em_andamento_desde" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "conta_waba_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "numero" (
    "id" UUID NOT NULL,
    "conta_waba_id" UUID NOT NULL,
    "companyid" UUID NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "display_phone_number" TEXT NOT NULL,
    "verified_name" TEXT,
    "qualidade" "qualidade_numero" NOT NULL DEFAULT 'UNKNOWN',
    "coleta_ativa" BOOLEAN NOT NULL DEFAULT true,
    "nao_encontrado_na_meta" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "numero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumo_diario" (
    "id" BIGSERIAL NOT NULL,
    "companyid" UUID NOT NULL,
    "conta_waba_id" UUID NOT NULL,
    "numero_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "categoria" "categoria_meta" NOT NULL,
    "tipo_preco" "tipo_preco" NOT NULL,
    "pais" VARCHAR(2) NOT NULL DEFAULT '',
    "tier" TEXT NOT NULL DEFAULT '',
    "volume" INTEGER NOT NULL,
    "custo" DECIMAL(14,6),
    "moeda" CHAR(3) NOT NULL,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "consumo_diario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_diarias" (
    "id" BIGSERIAL NOT NULL,
    "companyid" UUID NOT NULL,
    "conta_waba_id" UUID NOT NULL,
    "numero_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "enviadas" INTEGER NOT NULL,
    "entregues" INTEGER NOT NULL,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mensagens_diarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotacao" (
    "id" UUID NOT NULL,
    "valor" DECIMAL(10,4) NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "criado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cotacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execucao_sync" (
    "id" UUID NOT NULL,
    "companyid" UUID NOT NULL,
    "conta_waba_id" UUID NOT NULL,
    "origem" "origem_sync" NOT NULL,
    "status" "status_execucao" NOT NULL,
    "inicio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" TIMESTAMPTZ(6),
    "janela_de" DATE NOT NULL,
    "janela_ate" DATE NOT NULL,
    "linhas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,

    CONSTRAINT "execucao_sync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" BIGSERIAL NOT NULL,
    "companyid" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cliente_companyid_key" ON "cliente"("companyid");

-- CreateIndex
CREATE UNIQUE INDEX "conta_waba_waba_id_key" ON "conta_waba"("waba_id");

-- CreateIndex
CREATE INDEX "conta_waba_companyid_idx" ON "conta_waba"("companyid");

-- CreateIndex
CREATE UNIQUE INDEX "numero_phone_number_id_key" ON "numero"("phone_number_id");

-- CreateIndex
CREATE INDEX "numero_companyid_idx" ON "numero"("companyid");

-- CreateIndex
CREATE INDEX "consumo_diario_companyid_data_idx" ON "consumo_diario"("companyid", "data");

-- CreateIndex
CREATE UNIQUE INDEX "consumo_diario_chave" ON "consumo_diario"("numero_id", "data", "categoria", "tipo_preco", "pais", "tier");

-- CreateIndex
CREATE INDEX "mensagens_diarias_companyid_data_idx" ON "mensagens_diarias"("companyid", "data");

-- CreateIndex
CREATE UNIQUE INDEX "mensagens_diarias_chave" ON "mensagens_diarias"("numero_id", "data");

-- CreateIndex
CREATE UNIQUE INDEX "cotacao_vigente_desde_key" ON "cotacao"("vigente_desde");

-- CreateIndex
CREATE INDEX "execucao_sync_conta_waba_id_inicio_idx" ON "execucao_sync"("conta_waba_id", "inicio" DESC);

-- CreateIndex
CREATE INDEX "auditoria_companyid_criado_em_idx" ON "auditoria"("companyid", "criado_em" DESC);

-- AddForeignKey
ALTER TABLE "conta_waba" ADD CONSTRAINT "conta_waba_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numero" ADD CONSTRAINT "numero_conta_waba_id_fkey" FOREIGN KEY ("conta_waba_id") REFERENCES "conta_waba"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumo_diario" ADD CONSTRAINT "consumo_diario_conta_waba_id_fkey" FOREIGN KEY ("conta_waba_id") REFERENCES "conta_waba"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumo_diario" ADD CONSTRAINT "consumo_diario_numero_id_fkey" FOREIGN KEY ("numero_id") REFERENCES "numero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_diarias" ADD CONSTRAINT "mensagens_diarias_conta_waba_id_fkey" FOREIGN KEY ("conta_waba_id") REFERENCES "conta_waba"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_diarias" ADD CONSTRAINT "mensagens_diarias_numero_id_fkey" FOREIGN KEY ("numero_id") REFERENCES "numero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucao_sync" ADD CONSTRAINT "execucao_sync_conta_waba_id_fkey" FOREIGN KEY ("conta_waba_id") REFERENCES "conta_waba"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

