-- CreateTable
CREATE TABLE "grupo_custo" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "preco_brl" DECIMAL(10,4) NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grupo_custo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grupo_custo_nome_key" ON "grupo_custo"("nome");

-- Grupo padrão: Standard, R$ 0,06 por mensagem cobrada
INSERT INTO "grupo_custo" ("id", "nome", "preco_brl", "atualizado_em")
VALUES ('00000000-0000-0000-0000-000000000001', 'Standard', 0.06, CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "cliente" ADD COLUMN "grupo_custo_id" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_grupo_custo_id_fkey" FOREIGN KEY ("grupo_custo_id") REFERENCES "grupo_custo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
